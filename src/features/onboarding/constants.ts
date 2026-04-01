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

export const COST_OF_LIVING_FIELDS = [
  { key: 'rentMortgage', label: 'Rent / Mortgage' },
  { key: 'internet', label: 'Internet' },
  { key: 'mobilePhone', label: 'Mobile Phone' },
  { key: 'utilities', label: 'Utilities (electric, gas, water)' },
  { key: 'studentLoans', label: 'Student Loans' },
  { key: 'consumerDebt', label: 'Consumer Debt (credit cards, personal loans)' },
  { key: 'carLoan', label: 'Car Loan / Payment' },
  { key: 'groceries', label: 'Groceries' },
  { key: 'gym', label: 'Gym / Fitness' },
  { key: 'entertainment', label: 'Entertainment / Going Out' },
  { key: 'clothing', label: 'Clothing' },
  { key: 'savingsTarget', label: 'Savings Target' },
  { key: 'other', label: 'Other' },
] as const

export type CostOfLivingKey = (typeof COST_OF_LIVING_FIELDS)[number]['key']
