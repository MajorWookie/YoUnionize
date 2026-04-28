import { relations } from 'drizzle-orm'
import {
  users,
  userProfiles,
  userCostOfLiving,
  companies,
  filingSummaries,
  filingSections,
  executiveCompensation,
  insiderTrades,
  directors,
  compensationAnalyses,
} from './schema'

export const usersRelations = relations(users, ({ one, many }) => ({
  profile: one(userProfiles, {
    fields: [users.id],
    references: [userProfiles.userId],
  }),
  costOfLiving: one(userCostOfLiving, {
    fields: [users.id],
    references: [userCostOfLiving.userId],
  }),
  compensationAnalyses: many(compensationAnalyses),
}))

export const userProfilesRelations = relations(userProfiles, ({ one }) => ({
  user: one(users, {
    fields: [userProfiles.userId],
    references: [users.id],
  }),
}))

export const userCostOfLivingRelations = relations(userCostOfLiving, ({ one }) => ({
  user: one(users, {
    fields: [userCostOfLiving.userId],
    references: [users.id],
  }),
}))

export const companiesRelations = relations(companies, ({ many }) => ({
  filings: many(filingSummaries),
  executiveCompensation: many(executiveCompensation),
  insiderTrades: many(insiderTrades),
  directors: many(directors),
}))

export const filingSummariesRelations = relations(filingSummaries, ({ one, many }) => ({
  company: one(companies, {
    fields: [filingSummaries.companyId],
    references: [companies.id],
  }),
  executiveCompensation: many(executiveCompensation),
  sections: many(filingSections),
}))

export const filingSectionsRelations = relations(filingSections, ({ one }) => ({
  filing: one(filingSummaries, {
    fields: [filingSections.filingId],
    references: [filingSummaries.id],
  }),
}))

export const executiveCompensationRelations = relations(executiveCompensation, ({ one }) => ({
  company: one(companies, {
    fields: [executiveCompensation.companyId],
    references: [companies.id],
  }),
  filingSummary: one(filingSummaries, {
    fields: [executiveCompensation.filingSummaryId],
    references: [filingSummaries.id],
  }),
}))

export const insiderTradesRelations = relations(insiderTrades, ({ one }) => ({
  company: one(companies, {
    fields: [insiderTrades.companyId],
    references: [companies.id],
  }),
}))

export const directorsRelations = relations(directors, ({ one }) => ({
  company: one(companies, {
    fields: [directors.companyId],
    references: [companies.id],
  }),
}))

export const compensationAnalysesRelations = relations(compensationAnalyses, ({ one }) => ({
  user: one(users, {
    fields: [compensationAnalyses.userId],
    references: [users.id],
  }),
}))
