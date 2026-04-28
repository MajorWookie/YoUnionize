import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@younionize/hooks'
import { Button, H2, H4, Paragraph, Separator, Spinner, YStack } from 'tamagui'
import { ScreenContainer } from '~/interface/layout/ScreenContainer'
import { Card } from '~/interface/display/Card'
import { LoadingState } from '~/interface/display/LoadingState'
import { ErrorState } from '~/interface/display/ErrorState'
import { TextField } from '~/interface/form/TextField'
import { SelectField } from '~/interface/form/SelectField'
import { CurrencyInput } from '~/interface/form/CurrencyInput'
import { useToast } from '~/interface/feedback/ToastProvider'
import { extractErrorMessage, fetchWithRetry } from '~/lib/api-client'
import { CompanyTypeahead } from '~/features/onboarding/CompanyTypeahead'
import {
  ORG_LEVELS,
  COST_OF_LIVING_FIELDS,
  type CostOfLivingKey,
} from '~/features/onboarding/constants'

interface UserProfile {
  jobTitle: string | null
  orgLevelCode: string | null
  grossAnnualPay: number | null
  companyTicker: string | null
}

interface UserCostOfLiving {
  rentMortgage: number | null
  internet: number | null
  mobilePhone: number | null
  utilities: number | null
  studentLoans: number | null
  consumerDebt: number | null
  carLoan: number | null
  groceries: number | null
  gym: number | null
  entertainment: number | null
  clothing: number | null
  savingsTarget: number | null
  other: number | null
}

export default function ProfileScreen() {
  const { user, signOut } = useAuth()
  const { showToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Profile fields
  const [jobTitle, setJobTitle] = useState('')
  const [orgLevel, setOrgLevel] = useState('')
  const [companyTicker, setCompanyTicker] = useState('')
  const [grossAnnualPay, setGrossAnnualPay] = useState<number | null>(null)

  // Cost of living
  const [costOfLiving, setCostOfLiving] = useState<Record<CostOfLivingKey, number | null>>({
    rentMortgage: null,
    internet: null,
    mobilePhone: null,
    utilities: null,
    studentLoans: null,
    consumerDebt: null,
    carLoan: null,
    groceries: null,
    gym: null,
    entertainment: null,
    clothing: null,
    savingsTarget: null,
    other: null,
  })

  // Editing state
  const [editingProfile, setEditingProfile] = useState(false)
  const [editingCOL, setEditingCOL] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingCOL, setSavingCOL] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchWithRetry('/api/user/me')
      if (!res.ok) throw new Error('Failed to load profile')
      const data = await res.json()

      const p: UserProfile | null = data.profile
      if (p) {
        setJobTitle(p.jobTitle ?? '')
        setOrgLevel(p.orgLevelCode ?? '')
        setCompanyTicker(p.companyTicker ?? '')
        setGrossAnnualPay(p.grossAnnualPay)
      }

      const c: UserCostOfLiving | null = data.costOfLiving
      if (c) {
        setCostOfLiving({
          rentMortgage: c.rentMortgage,
          internet: c.internet,
          mobilePhone: c.mobilePhone,
          utilities: c.utilities,
          studentLoans: c.studentLoans,
          consumerDebt: c.consumerDebt,
          carLoan: c.carLoan,
          groceries: c.groceries,
          gym: c.gym,
          entertainment: c.entertainment,
          clothing: c.clothing,
          savingsTarget: c.savingsTarget,
          other: c.other,
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const saveProfile = async () => {
    setSavingProfile(true)
    try {
      const body: Record<string, unknown> = {
        jobTitle: jobTitle || null,
        orgLevelCode: orgLevel || null,
        companyTicker: companyTicker || null,
        grossAnnualPay: grossAnnualPay,
      }
      const res = await fetchWithRetry('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(extractErrorMessage(data))
      }
      setEditingProfile(false)
      showToast('Profile saved', 'success')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Save failed'
      setError(msg)
      showToast(msg, 'error')
    } finally {
      setSavingProfile(false)
    }
  }

  const saveCOL = async () => {
    setSavingCOL(true)
    try {
      const res = await fetchWithRetry('/api/user/cost-of-living', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(costOfLiving),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(extractErrorMessage(data))
      }
      setEditingCOL(false)
      showToast('Cost of living saved', 'success')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Save failed'
      setError(msg)
      showToast(msg, 'error')
    } finally {
      setSavingCOL(false)
    }
  }

  const updateCostField = useCallback((key: CostOfLivingKey, value: number | null) => {
    setCostOfLiving((prev) => ({ ...prev, [key]: value }))
  }, [])

  if (loading) {
    return (
      <ScreenContainer>
        <LoadingState message="Loading profile..." />
      </ScreenContainer>
    )
  }

  if (error && !jobTitle && !grossAnnualPay) {
    return (
      <ScreenContainer>
        <ErrorState message={error} onRetry={fetchData} />
      </ScreenContainer>
    )
  }

  const orgLabel = ORG_LEVELS.find((o) => o.value === orgLevel)?.label

  return (
    <ScreenContainer>
      <YStack mb="$4">
        <H2>Profile</H2>
      </YStack>

      {/* Account info */}
      <Card mb="$4" gap="$2">
        <Paragraph fontWeight="600" fontSize={16}>
          {user?.name ?? 'User'}
        </Paragraph>
        <Paragraph color="$color8" fontSize={14}>
          {user?.email ?? ''}
        </Paragraph>
      </Card>

      <Separator my="$3" />

      {/* Employment Details */}
      <YStack mb="$4" gap="$3">
        <H4>Employment Details</H4>

        {editingProfile ? (
          <Card gap="$3">
            <TextField
              label="Job Title"
              value={jobTitle}
              onChangeText={setJobTitle}
              placeholder="e.g. Software Engineer"
            />

            <SelectField
              label="Organization Level"
              value={orgLevel || null}
              onValueChange={setOrgLevel}
              options={[...ORG_LEVELS]}
              placeholder="Select your level..."
            />

            <CompanyTypeahead
              value={companyTicker}
              onSelect={(ticker) => setCompanyTicker(ticker)}
            />

            <CurrencyInput
              label="Gross Annual Pay"
              value={grossAnnualPay}
              onValueChange={setGrossAnnualPay}
              placeholder="85,000"
            />

            {error && (
              <Paragraph color="$negative" fontSize={13}>
                {error}
              </Paragraph>
            )}

            <Button theme="accent" onPress={saveProfile} disabled={savingProfile}>
              {savingProfile ? <Spinner size="small" /> : 'Save'}
            </Button>
            <Button variant="outlined" onPress={() => setEditingProfile(false)}>
              Cancel
            </Button>
          </Card>
        ) : (
          <Card gap="$2">
            <ProfileRow label="Job Title" value={jobTitle || 'Not set'} />
            <ProfileRow label="Level" value={orgLabel ?? 'Not set'} />
            <ProfileRow label="Company" value={companyTicker || 'Not linked'} />
            <ProfileRow
              label="Gross Annual Pay"
              value={
                grossAnnualPay != null
                  ? `$${Math.round(grossAnnualPay / 100).toLocaleString('en-US')}`
                  : 'Not set'
              }
            />
            <Button
              size="$3"
              variant="outlined"
              mt="$2"
              onPress={() => setEditingProfile(true)}
            >
              Edit
            </Button>
          </Card>
        )}
      </YStack>

      <Separator my="$3" />

      {/* Cost of Living */}
      <YStack mb="$4" gap="$3">
        <H4>Cost of Living</H4>
        <Paragraph color="$color8" fontSize={13}>
          Monthly amounts — used for compensation fairness analysis.
        </Paragraph>

        {editingCOL ? (
          <Card gap="$3">
            {COST_OF_LIVING_FIELDS.map((field) => (
              <CurrencyInput
                key={field.key}
                label={field.label}
                value={costOfLiving[field.key]}
                onValueChange={(v) => updateCostField(field.key, v)}
              />
            ))}

            {error && (
              <Paragraph color="$negative" fontSize={13}>
                {error}
              </Paragraph>
            )}

            <Button theme="accent" onPress={saveCOL} disabled={savingCOL}>
              {savingCOL ? <Spinner size="small" /> : 'Save'}
            </Button>
            <Button variant="outlined" onPress={() => setEditingCOL(false)}>
              Cancel
            </Button>
          </Card>
        ) : (
          <Card gap="$2">
            {COST_OF_LIVING_FIELDS.map((field) => {
              const v = costOfLiving[field.key]
              return (
                <ProfileRow
                  key={field.key}
                  label={field.label}
                  value={v != null ? `$${Math.round(v / 100).toLocaleString('en-US')}/mo` : '-'}
                />
              )
            })}
            <Button
              size="$3"
              variant="outlined"
              mt="$2"
              onPress={() => setEditingCOL(true)}
            >
              Edit
            </Button>
          </Card>
        )}
      </YStack>

      <Separator my="$3" />

      {/* About */}
      <Card mb="$4" gap="$2">
        <Paragraph fontWeight="600">About YoUnion</Paragraph>
        <Paragraph color="$color8" fontSize={13} lineHeight={20}>
          YoUnion helps employees understand their compensation in context. We analyze
          public SEC filings — executive pay, financial performance, risk factors — and
          use AI to translate complex financial documents into plain language so you can
          make informed decisions about your career and pay.
        </Paragraph>
      </Card>

      {/* Sign out */}
      <YStack mt="$2" mb="$6">
        <Button size="$4" theme="red" onPress={signOut}>
          Sign Out
        </Button>
      </YStack>
    </ScreenContainer>
  )
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  const isPlaceholder = value === 'Not set' || value === 'Not linked' || value === '-'
  return (
    <YStack gap={2} py="$1">
      <Paragraph fontSize={12} color="$color8" fontWeight="500">
        {label}
      </Paragraph>
      <Paragraph
        fontSize={14}
        color={isPlaceholder ? '$color7' : '$color12'}
        fontWeight={isPlaceholder ? '400' : '500'}
      >
        {value}
      </Paragraph>
    </YStack>
  )
}
