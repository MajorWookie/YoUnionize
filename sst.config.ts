/// <reference path="./.sst/platform/config.d.ts" />

/**
 * SST v3 Infrastructure-as-Code for Union
 *
 * Resources:
 *   - ECS Fargate service (One web app)
 *   - CloudFront distribution
 *   - Lambda function (background filing ingestion)
 *   - Secrets management
 *
 * Database, auth, and storage are provided by Supabase (external).
 *
 * Stages:
 *   - dev        → local Supabase only (no AWS resources deployed)
 *   - staging    → minimal ECS task
 *   - production → scaled ECS tasks
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
    // Local development uses Supabase CLI exclusively.
    if (isDev) {
      console.info('[SST] Dev stage — no AWS resources. Use `supabase start` + `bun dev` for local dev.')
      return
    }

    // ── Secrets ─────────────────────────────────────────────────────────

    const secrets = {
      secApiKey: new sst.Secret('SecApiKey'),
      anthropicApiKey: new sst.Secret('AnthropicApiKey'),
      postmarkApiKey: new sst.Secret('PostmarkApiKey'),
      supabaseUrl: new sst.Secret('SupabaseUrl'),
      supabaseAnonKey: new sst.Secret('SupabaseAnonKey'),
      supabaseServiceRoleKey: new sst.Secret('SupabaseServiceRoleKey'),
      databaseUrl: new sst.Secret('DatabaseUrl'),
    }

    // ── VPC (for Lambda egress to Supabase) ───────────────────────────

    const vpc = new sst.aws.Vpc('Vpc', {
      nat: 'ec2',
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
      DATABASE_URL: secrets.databaseUrl.value,
      SUPABASE_URL: secrets.supabaseUrl.value,
      SUPABASE_ANON_KEY: secrets.supabaseAnonKey.value,
      SUPABASE_SERVICE_ROLE_KEY: secrets.supabaseServiceRoleKey.value,
      SEC_API_KEY: secrets.secApiKey.value,
      ANTHROPIC_API_KEY: secrets.anthropicApiKey.value,
      POSTMARK_API_KEY: secrets.postmarkApiKey.value,
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
      handler: 'src/server/lambda/migrate.handler',
      runtime: 'nodejs22.x',
      memory: '512 MB',
      timeout: '300 seconds',
      environment: {
        DATABASE_URL: secrets.databaseUrl.value,
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
      ingestionWorkerArn: ingestionWorker.arn,
    }
  },
})
