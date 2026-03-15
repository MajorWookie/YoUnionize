import { betterAuth } from 'better-auth'
import { Pool } from 'pg'
import { getDb } from '@union/postgres'
import { users, userProfiles } from '~/database/schema'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgresql://union:union@localhost:5433/union',
})

export const auth = betterAuth({
  database: pool,

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },

  session: {
    freshAge: 60 * 60 * 24 * 2, // 2 days
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minutes
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url }) => {
      // TODO: Replace with Postmark transactional email
      console.info('[Auth] Verification email stub:', {
        to: user.email,
        verificationUrl: url,
      })
    },
  },

  databaseHooks: {
    user: {
      create: {
        after: async (authUserRecord) => {
          // Create matching row in our app's users table
          const db = getDb()
          try {
            await db.insert(users).values({
              id: authUserRecord.id,
              email: authUserRecord.email,
              name: authUserRecord.name,
            })

            await db.insert(userProfiles).values({
              userId: authUserRecord.id,
            })

            console.info('[Auth] Created app user and profile for:', authUserRecord.email)
          } catch (error) {
            console.info('[Auth] Error creating app user record:', error)
          }
        },
      },
    },
  },
})

export type Auth = typeof auth
