import { useState, useCallback } from 'react'
import { useRouter } from 'expo-router'
import { Button, H2, Paragraph, Spinner, View, XStack, YStack } from 'tamagui'
import { ScreenContainer } from '~/interface/layout/ScreenContainer'
import { TextField } from '~/interface/form/TextField'
import { SelectField } from '~/interface/form/SelectField'
import { CurrencyInput } from '~/interface/form/CurrencyInput'
import { CompanyTypeahead } from '~/features/onboarding/CompanyTypeahead'
import {
  ORG_LEVELS,
  PAY_FREQUENCIES,
  COST_OF_LIVING_FIELDS,
  type CostOfLivingKey,
} from '~/features/onboarding/constants'

const TOTAL_STEPS = 3

export default function OnboardingScreen() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Step 1: Job info
  const [jobTitle, setJobTitle] = useState('')
  const [orgLevel, setOrgLevel] = useState('')
  const [companyTicker, setCompanyTicker] = useState('')

  // Step 2: Pay
  const [grossAnnualPay, setGrossAnnualPay] = useState<number | null>(null)
  const [payFrequency, setPayFrequency] = useState('')

  // Step 3: Cost of living
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

  const updateCostField = useCallback((key: CostOfLivingKey, value: number | null) => {
    setCostOfLiving((prev) => ({ ...prev, [key]: value }))
  }, [])

  const saveProfile = async () => {
    const body: Record<string, unknown> = {}
    if (jobTitle) body.jobTitle = jobTitle
    if (orgLevel) body.orgLevelCode = orgLevel
    if (companyTicker) body.companyTicker = companyTicker
    if (grossAnnualPay != null) body.grossAnnualPay = grossAnnualPay

    await fetch('/api/user/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  const saveCostOfLiving = async () => {
    const hasValues = Object.values(costOfLiving).some((v) => v != null)
    if (!hasValues) return

    await fetch('/api/user/cost-of-living', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(costOfLiving),
    })
  }

  const handleNext = async () => {
    setError(null)
    setSaving(true)

    try {
      if (step === 1) {
        await saveProfile()
        setStep(2)
      } else if (step === 2) {
        await saveProfile()
        setStep(3)
      } else {
        await saveCostOfLiving()
        router.replace('/discover')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleSkip = async () => {
    if (step < TOTAL_STEPS) {
      setStep(step + 1)
    } else {
      router.replace('/discover')
    }
  }

  return (
    <ScreenContainer>
      <YStack gap="$4" maxWidth={480} alignSelf="center" width="100%" paddingVertical="$4">
        {/* Progress indicator */}
        <XStack gap="$2" justifyContent="center" marginBottom="$2">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => (
            <View
              key={i}
              height={4}
              flex={1}
              maxWidth={80}
              borderRadius={2}
              backgroundColor={i < step ? '$color9' : '$color4'}
            />
          ))}
        </XStack>

        <Paragraph color="$color8" textAlign="center" fontSize={13}>
          Step {step} of {TOTAL_STEPS}
        </Paragraph>

        {error && (
          <Paragraph color="$negative" textAlign="center">
            {error}
          </Paragraph>
        )}

        {step === 1 && (
          <StepJob
            jobTitle={jobTitle}
            setJobTitle={setJobTitle}
            orgLevel={orgLevel}
            setOrgLevel={setOrgLevel}
            companyTicker={companyTicker}
            setCompanyTicker={setCompanyTicker}
          />
        )}

        {step === 2 && (
          <StepPay
            grossAnnualPay={grossAnnualPay}
            setGrossAnnualPay={setGrossAnnualPay}
            payFrequency={payFrequency}
            setPayFrequency={setPayFrequency}
          />
        )}

        {step === 3 && (
          <StepCostOfLiving
            values={costOfLiving}
            onChange={updateCostField}
          />
        )}

        {/* Actions */}
        <XStack justifyContent="space-between" marginTop="$2">
          <Button variant="outlined" onPress={handleSkip} disabled={saving}>
            Skip for now
          </Button>
          <Button theme="accent" onPress={handleNext} disabled={saving}>
            {saving ? (
              <Spinner size="small" />
            ) : step === TOTAL_STEPS ? (
              'Finish'
            ) : (
              'Next'
            )}
          </Button>
        </XStack>
      </YStack>
    </ScreenContainer>
  )
}

function StepJob({
  jobTitle,
  setJobTitle,
  orgLevel,
  setOrgLevel,
  companyTicker,
  setCompanyTicker,
}: {
  jobTitle: string
  setJobTitle: (v: string) => void
  orgLevel: string
  setOrgLevel: (v: string) => void
  companyTicker: string
  setCompanyTicker: (v: string) => void
}) {
  return (
    <YStack gap="$3">
      <H2 textAlign="center">Tell us about your job</H2>
      <Paragraph color="$color8" textAlign="center" marginBottom="$2">
        This helps us tailor compensation insights to your role.
      </Paragraph>

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
    </YStack>
  )
}

function StepPay({
  grossAnnualPay,
  setGrossAnnualPay,
  payFrequency,
  setPayFrequency,
}: {
  grossAnnualPay: number | null
  setGrossAnnualPay: (v: number | null) => void
  payFrequency: string
  setPayFrequency: (v: string) => void
}) {
  return (
    <YStack gap="$3">
      <H2 textAlign="center">What do you earn?</H2>
      <Paragraph color="$color8" textAlign="center" marginBottom="$2">
        Your pay is stored securely and never shared with your employer.
      </Paragraph>

      <CurrencyInput
        label="Gross Annual Pay"
        value={grossAnnualPay}
        onValueChange={setGrossAnnualPay}
        placeholder="85,000"
      />

      <SelectField
        label="Pay Frequency"
        value={payFrequency || null}
        onValueChange={setPayFrequency}
        options={[...PAY_FREQUENCIES]}
        placeholder="How often are you paid?"
      />
    </YStack>
  )
}

function StepCostOfLiving({
  values,
  onChange,
}: {
  values: Record<CostOfLivingKey, number | null>
  onChange: (key: CostOfLivingKey, value: number | null) => void
}) {
  return (
    <YStack gap="$3">
      <H2 textAlign="center">What does it cost you to live?</H2>
      <Paragraph color="$color8" textAlign="center" marginBottom="$2">
        Monthly amounts. This unlocks a true picture of your take-home pay.
      </Paragraph>

      {COST_OF_LIVING_FIELDS.map((field) => (
        <CurrencyInput
          key={field.key}
          label={field.label}
          value={values[field.key]}
          onValueChange={(v) => onChange(field.key, v)}
        />
      ))}
    </YStack>
  )
}
