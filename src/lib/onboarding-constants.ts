/**
 * Onboarding form options. Copied verbatim from
 * src/features/onboarding/constants.ts so the iOS and web flows stay
 * in lockstep without crossing the workspace boundary.
 */

export const ORG_LEVELS = [
  { label: 'Individual Contributor', value: 'ic' },
  { label: 'Team Lead', value: 'team_lead' },
  { label: 'Manager', value: 'manager' },
  { label: 'Senior Manager', value: 'senior_manager' },
  { label: 'Director', value: 'director' },
  { label: 'VP', value: 'vp' },
  { label: 'SVP', value: 'svp' },
  { label: 'C-Suite', value: 'c_suite' },
] as const

export const PAY_FREQUENCIES = [
  { label: 'Weekly', value: 'weekly' },
  { label: 'Biweekly', value: 'biweekly' },
  { label: 'Semi-monthly', value: 'semi_monthly' },
  { label: 'Monthly', value: 'monthly' },
] as const

/**
 * Groups for the cost-of-living step. Ordering here determines the order
 * sections render in. Each `COST_OF_LIVING_FIELDS` entry references one
 * of these via its `group` key.
 */
export const COST_OF_LIVING_GROUPS = [
  { id: 'housing', label: 'Housing & utilities' },
  { id: 'debt', label: 'Debt payments' },
  { id: 'living', label: 'Daily living' },
  { id: 'discretionary', label: 'Discretionary & savings' },
] as const

export type CostOfLivingGroupId = (typeof COST_OF_LIVING_GROUPS)[number]['id']

export const COST_OF_LIVING_FIELDS = [
  { key: 'rentMortgage', label: 'Rent / Mortgage', group: 'housing' },
  { key: 'internet', label: 'Internet', group: 'housing' },
  { key: 'mobilePhone', label: 'Mobile Phone', group: 'housing' },
  { key: 'utilities', label: 'Utilities (electric, gas, water)', group: 'housing' },
  { key: 'studentLoans', label: 'Student Loans', group: 'debt' },
  { key: 'consumerDebt', label: 'Consumer Debt (credit cards, personal loans)', group: 'debt' },
  { key: 'carLoan', label: 'Car Loan / Payment', group: 'debt' },
  { key: 'groceries', label: 'Groceries', group: 'living' },
  { key: 'gym', label: 'Gym / Fitness', group: 'living' },
  { key: 'entertainment', label: 'Entertainment / Going Out', group: 'discretionary' },
  { key: 'clothing', label: 'Clothing', group: 'discretionary' },
  { key: 'savingsTarget', label: 'Savings Target', group: 'discretionary' },
  { key: 'other', label: 'Other', group: 'discretionary' },
] as const satisfies ReadonlyArray<{
  key: string
  label: string
  group: CostOfLivingGroupId
}>

export type CostOfLivingKey = (typeof COST_OF_LIVING_FIELDS)[number]['key']
