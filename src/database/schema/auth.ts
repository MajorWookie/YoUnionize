import { boolean, pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core'

/**
 * Better Auth managed tables.
 * Column names use camelCase to match better-auth's default Kysely adapter expectations.
 */

export const authUser = pgTable('user', {
  id: text('id').primaryKey(),
  name: varchar('name', { length: 200 }).notNull(),
  email: varchar('email', { length: 200 }).notNull().unique(),
  emailVerified: boolean('emailVerified').default(false).notNull(),
  image: text('image'),
  createdAt: timestamp('createdAt', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updatedAt', { mode: 'string' }).defaultNow().notNull(),
})

export const authAccount = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('accountId').notNull(),
  providerId: text('providerId').notNull(),
  userId: text('userId')
    .notNull()
    .references(() => authUser.id, { onDelete: 'cascade' }),
  accessToken: text('accessToken'),
  refreshToken: text('refreshToken'),
  idToken: text('idToken'),
  accessTokenExpiresAt: timestamp('accessTokenExpiresAt', { mode: 'string' }),
  refreshTokenExpiresAt: timestamp('refreshTokenExpiresAt', { mode: 'string' }),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('createdAt', { mode: 'string' }).notNull(),
  updatedAt: timestamp('updatedAt', { mode: 'string' }).notNull(),
})

export const authSession = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expiresAt', { mode: 'string' }).notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('createdAt', { mode: 'string' }).notNull(),
  updatedAt: timestamp('updatedAt', { mode: 'string' }).notNull(),
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
  userId: text('userId')
    .notNull()
    .references(() => authUser.id, { onDelete: 'cascade' }),
})

export const authVerification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expiresAt', { mode: 'string' }).notNull(),
  createdAt: timestamp('createdAt', { mode: 'string' }),
  updatedAt: timestamp('updatedAt', { mode: 'string' }),
})
