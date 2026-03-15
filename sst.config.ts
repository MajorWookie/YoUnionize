/// <reference path="./.sst/platform/config.d.ts" />

/**
 * SST v3 Infrastructure-as-Code for Union
 *
 * Resources:
 *   - Aurora Serverless v2 (PostgreSQL 16 + pgvector)
 *   - S3 bucket (filing caches, future file storage)
 *   - ECS Fargate service (One web app)
 *   - CloudFront distribution
 *   - Lambda function (background filing ingestion)
 *   - Secrets management
 *
 * Stages:
 *   - dev        → local Docker only (no AWS resources deployed)
 *   - staging    → minimal Aurora, single ECS task
 *   - production → scaled Aurora, multi-AZ, larger ECS tasks
 */

export default $config({
  app(input) {
    return {
      name: 'union',
      removal: input?.stage === 'production' ? 'retain' : 'remove',
      home: 'aws',
      providers: {
        aws: {
          region: 'us-east-1',
        },
      },
    }
  },

  async run() {
    const { execSync } = await import('node:child_process')

    const stage = $app.stage
    const isProd = stage === 'production'
    const isStaging = stage === 'staging'
    const isDev = !isProd && !isStaging

    // ── Dev stage: no AWS resources ─────────────────────────────────────
    // Local development uses docker-compose exclusively.
    if (isDev) {
      console.info('[SST] Dev stage — no AWS resources. Use docker-compose for local dev.')
      return
    }

    // ── Secrets ─────────────────────────────────────────────────────────

    const secrets = {
      secApiKey: new sst.Secret('SecApiKey'),
      anthropicApiKey: new sst.Secret('AnthropicApiKey'),
      betterAuthSecret: new sst.Secret('BetterAuthSecret'),
      postmarkApiKey: new sst.Secret('PostmarkApiKey'),
    }

    // ── VPC ─────────────────────────────────────────────────────────────

    const vpc = new sst.aws.Vpc('Vpc', {
      // EC2 NAT for Lambda VPC access (~$3/mo)
      nat: 'ec2',
    })

    // ── Aurora Serverless v2 (PostgreSQL 16 + pgvector) ─────────────────

    const database = new sst.aws.Aurora('Postgres', {
      vpc,
      engine: 'postgres',
      database: 'union',
      version: '16.8',
      scaling: isProd
        ? { min: '0.5 ACU', max: '8 ACU' }
        : { min: '0 ACU', max: '2 ACU' },
      transform: {
        cluster: {
          backupRetentionPeriod: isProd ? 14 : 3,
          preferredBackupWindow: '04:00-05:00',
          deletionProtection: isProd,
          finalSnapshotIdentifier: $interpolate`union-${$app.stage}-postgres-final-${Date.now()}`,
        },
        clusterParameterGroup: {
          parameters: [
            // Enable pgvector via shared_preload_libraries
            {
              name: 'shared_preload_libraries',
              value: 'pg_stat_statements',
              applyMethod: 'pending-reboot',
            },
            // Log slow queries (>1s)
            {
              name: 'log_min_duration_statement',
              value: '1000',
              applyMethod: 'pending-reboot',
            },
            // Log DDL statements
            {
              name: 'log_statement',
              value: 'ddl',
              applyMethod: 'pending-reboot',
            },
            // Connection limits
            {
              name: 'max_connections',
              value: isProd ? '200' : '50',
              applyMethod: 'pending-reboot',
            },
            // Idle timeout (30s)
            {
              name: 'idle_session_timeout',
              value: '30000',
              applyMethod: 'pending-reboot',
            },
          ],
        },
      },
    })

    const databaseUrl = $interpolate`postgres://${database.username}:${database.password}@${database.host}:${database.port}/${database.database}`

    // ── S3 Bucket (filing caches, future file storage) ──────────────────

    const bucket = new sst.aws.Bucket('Storage', {
      public: false,
    })

    // ── ECS Cluster ─────────────────────────────────────────────────────

    const cluster = new sst.aws.Cluster('Cluster', {
      vpc,
      transform: {
        cluster: {
          settings: [
            {
              name: 'containerInsights',
              value: 'enhanced',
            },
          ],
        },
      },
    })

    // ── Shared environment for all services ─────────────────────────────

    const gitSha = execSync('git rev-parse HEAD').toString().trim()

    const commonEnv = {
      NODE_ENV: 'production',
      DATABASE_URL: databaseUrl,
      SEC_API_KEY: secrets.secApiKey.value,
      ANTHROPIC_API_KEY: secrets.anthropicApiKey.value,
      BETTER_AUTH_SECRET: secrets.betterAuthSecret.value,
      POSTMARK_API_KEY: secrets.postmarkApiKey.value,
      S3_BUCKET: bucket.name,
      GIT_SHA: gitSha,
    }

    // ── Web App (ECS Fargate + CloudFront) ──────────────────────────────

    const webApp = new sst.aws.Service('WebApp', {
      cluster,
      image: {
        context: '.',
        dockerfile: 'Dockerfile',
      },
      architecture: 'arm64',
      cpu: isProd ? '2 vCPU' : '0.5 vCPU',
      memory: isProd ? '4 GB' : '1 GB',
      capacity: isStaging ? 'spot' : undefined,
      link: [database, bucket],
      environment: {
        ...commonEnv,
        ONE_SERVER_URL: isProd
          ? 'https://union.app'
          : `https://${stage}.union.app`,
        NODE_OPTIONS: isProd ? '--max-old-space-size=3072' : '--max-old-space-size=512',
      },
      scaling: {
        min: 1,
        max: isProd ? 4 : 1,
      },
      health: {
        command: ['CMD-SHELL', 'curl -f http://localhost:3000/api/health || exit 1'],
        interval: '15 seconds',
        retries: 5,
        startPeriod: '120 seconds',
      },
      logging: {
        retention: isProd ? '4 weeks' : '1 week',
      },
      loadBalancer: {
        public: true,
        health: {
          '3000/http': {
            path: '/api/health',
            interval: '15 seconds',
          },
        },
        rules: [
          { listen: '80/http', forward: '3000/http' },
          { listen: '443/https', forward: '3000/http' },
        ],
      },
    })

    // ── Lambda: Background Filing Ingestion ─────────────────────────────
    // Triggered via SQS or direct invocation to run long-running
    // SEC filing ingestion + AI summarization jobs outside the web process.

    const ingestionWorker = new sst.aws.Function('IngestionWorker', {
      vpc,
      link: [database, bucket],
      handler: 'src/server/lambda/ingestion.handler',
      runtime: 'nodejs22.x',
      architecture: 'arm64',
      memory: '1024 MB',
      timeout: '900 seconds',
      environment: {
        ...commonEnv,
      },
      logging: {
        retention: isProd ? '4 weeks' : '1 week',
      },
    })

    // ── Lambda: Database Migrator ────────────────────────────────────────
    // Runs Drizzle migrations at deploy time.

    const migrator = new sst.aws.Function('DatabaseMigrator', {
      vpc,
      link: [database],
      handler: 'src/server/lambda/migrate.handler',
      runtime: 'nodejs22.x',
      memory: '512 MB',
      timeout: '300 seconds',
      environment: {
        DATABASE_URL: databaseUrl,
      },
    })

    // Run migrations on every deploy
    new aws.lambda.Invocation('MigratorInvocation', {
      input: Date.now().toString(),
      functionName: migrator.name,
    })

    // ── Outputs ─────────────────────────────────────────────────────────

    return {
      webUrl: webApp.url,
      databaseHost: database.host,
      bucketName: bucket.name,
      ingestionWorkerArn: ingestionWorker.arn,
    }
  },
})
