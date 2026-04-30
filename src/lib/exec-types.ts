/**
 * Executive + director data shapes returned on /api/companies/:ticker/detail.
 * Shared by company route, LeadershipSection, CeoSpotlightCard, and
 * the executive detail page.
 */

export interface Executive {
  id: string
  name: string
  title: string
  fiscalYear: number
  totalCompensation: number
  salary: number | null
  bonus: number | null
  stockAwards: number | null
  optionAwards: number | null
  nonEquityIncentive: number | null
  otherCompensation: number | null
  changeInPensionValue: number | null
  ceoPayRatio: string | null
}

export interface Director {
  id: string
  name: string
  title: string
  isIndependent: boolean | null
  committees: unknown
  tenureStart: string | null
  age: number | null
  directorClass?: string | null
  qualifications?: unknown
  role?: string | null
}
