import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert,
  Button,
  Card,
  Container,
  Group,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Stepper,
  Text,
  TextInput,
} from '@mantine/core'
import { fetchWithRetry } from '@younionize/api-client'
import { CompanyTypeahead } from '~/components/CompanyTypeahead'
import { PageHeader, TrustStrip } from '~/components/primitives'
import {
  COST_OF_LIVING_FIELDS,
  COST_OF_LIVING_GROUPS,
  ORG_LEVELS,
  PAY_FREQUENCIES,
  type CostOfLivingKey,
} from '~/lib/onboarding-constants'

interface JobFields {
  jobTitle: string
  orgLevel: string
  companyTicker: string
}

interface PayFields {
  grossAnnualPay: number | null
  payFrequency: string
}

type CostOfLiving = Record<CostOfLivingKey, number | null>

const EMPTY_COST: CostOfLiving = COST_OF_LIVING_FIELDS.reduce(
  (acc, f) => ({ ...acc, [f.key]: null }),
  {} as CostOfLiving,
)

const STEP_DESCRIPTIONS = [
  'First, your job. Role and company so we can find your peers.',
  "Now your pay. We'll use this to estimate take-home and compare you to peers.",
  'Last, your monthly costs. Optional, but unlocks better insights.',
] as const

export function OnboardingPage() {
  const navigate = useNavigate()
  const [active, setActive] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [job, setJob] = useState<JobFields>({
    jobTitle: '',
    orgLevel: '',
    companyTicker: '',
  })
  const [pay, setPay] = useState<PayFields>({
    grossAnnualPay: null,
    payFrequency: '',
  })
  const [cost, setCost] = useState<CostOfLiving>(EMPTY_COST)

  const saveProfile = async () => {
    const body: Record<string, unknown> = {}
    if (job.jobTitle) body.jobTitle = job.jobTitle
    if (job.orgLevel) body.orgLevelCode = job.orgLevel
    if (job.companyTicker) body.companyTicker = job.companyTicker
    if (pay.grossAnnualPay != null) body.grossAnnualPay = pay.grossAnnualPay
    if (Object.keys(body).length === 0) return

    const res = await fetchWithRetry('/api/user/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`Profile save failed (${res.status})`)
  }

  const saveCostOfLiving = async () => {
    const hasValues = Object.values(cost).some((v) => v != null)
    if (!hasValues) return
    const res = await fetchWithRetry('/api/user/cost-of-living', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cost),
    })
    if (!res.ok) throw new Error(`Cost of living save failed (${res.status})`)
  }

  const handleNext = async () => {
    setError(null)
    setSaving(true)
    try {
      if (active === 0) {
        await saveProfile()
        setActive(1)
      } else if (active === 1) {
        await saveProfile()
        setActive(2)
      } else {
        await saveCostOfLiving()
        navigate('/discover')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleSkip = () => {
    if (active < 2) setActive(active + 1)
    else navigate('/discover')
  }

  const isLast = active === 2
  const updateCost = (key: CostOfLivingKey, value: number | null) =>
    setCost((prev) => ({ ...prev, [key]: value }))

  return (
    <Container size="md" py="xl">
      <Stack gap="xl">
        <PageHeader
          title="Welcome to YoUnionize"
          description={STEP_DESCRIPTIONS[active]}
        />

        <Stepper
          active={active}
          onStepClick={(step) => step <= active && setActive(step)}
          allowNextStepsSelect={false}
        >
          <Stepper.Step label="Your job" description="Role & company">
            <Card mt="md">
              <Stack gap="md">
                <TextInput
                  label="Job title"
                  placeholder="e.g. Software Engineer"
                  value={job.jobTitle}
                  onChange={(e) => {
                    // Read synchronously — React clears `currentTarget` after
                    // the handler returns, so the setState updater can't
                    // safely access `e.currentTarget.value` later.
                    const value = e.currentTarget.value
                    setJob((p) => ({ ...p, jobTitle: value }))
                  }}
                />
                <Select
                  label="Organization level"
                  placeholder="Select your level…"
                  data={[...ORG_LEVELS]}
                  value={job.orgLevel || null}
                  onChange={(v) => setJob((p) => ({ ...p, orgLevel: v ?? '' }))}
                  clearable
                />
                <CompanyTypeahead
                  value={job.companyTicker}
                  onSelect={(ticker) =>
                    setJob((p) => ({ ...p, companyTicker: ticker }))
                  }
                />
                <TrustStrip>
                  Used to benchmark your role against peers in your sector.
                  Never shared with employers.
                </TrustStrip>
              </Stack>
            </Card>
          </Stepper.Step>

          <Stepper.Step label="Your pay" description="Compensation">
            <Card mt="md">
              <Stack gap="md">
                <NumberInput
                  label="Gross annual pay"
                  placeholder="85,000"
                  prefix="$"
                  thousandSeparator=","
                  allowNegative={false}
                  hideControls
                  value={pay.grossAnnualPay ?? ''}
                  onChange={(v) =>
                    setPay((p) => ({
                      ...p,
                      grossAnnualPay: typeof v === 'number' ? v : null,
                    }))
                  }
                />
                <Select
                  label="Pay frequency"
                  placeholder="How often are you paid?"
                  data={[...PAY_FREQUENCIES]}
                  value={pay.payFrequency || null}
                  onChange={(v) =>
                    setPay((p) => ({ ...p, payFrequency: v ?? '' }))
                  }
                  clearable
                />
                <TrustStrip>
                  Stored privately. Used only to estimate your take-home and
                  compare you to peers — never shared.
                </TrustStrip>
              </Stack>
            </Card>
          </Stepper.Step>

          <Stepper.Step
            label="Cost of living"
            description="Monthly expenses"
          >
            <Card mt="md">
              <Stack gap="lg">
                <Text size="sm" c="dimmed">
                  Monthly amounts. Leave any field blank to skip.
                </Text>
                {COST_OF_LIVING_GROUPS.map((group) => {
                  const fields = COST_OF_LIVING_FIELDS.filter(
                    (f) => f.group === group.id,
                  )
                  return (
                    <Stack key={group.id} gap="sm">
                      <Text
                        size="xs"
                        fw={600}
                        c="dimmed"
                        tt="uppercase"
                        lts="0.04em"
                      >
                        {group.label}
                      </Text>
                      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                        {fields.map((field) => (
                          <NumberInput
                            key={field.key}
                            label={field.label}
                            prefix="$"
                            thousandSeparator=","
                            allowNegative={false}
                            hideControls
                            value={cost[field.key] ?? ''}
                            onChange={(v) =>
                              updateCost(
                                field.key,
                                typeof v === 'number' ? v : null,
                              )
                            }
                          />
                        ))}
                      </SimpleGrid>
                    </Stack>
                  )
                })}
                <TrustStrip>
                  Used only to compare your monthly outgoings against typical
                  patterns in your area. Never leaves your account.
                </TrustStrip>
              </Stack>
            </Card>
          </Stepper.Step>
        </Stepper>

        {error ? <Alert color="red">{error}</Alert> : null}

        <Group justify="space-between">
          <Button variant="default" onClick={handleSkip} disabled={saving}>
            {isLast ? 'Skip & finish' : 'Skip for now'}
          </Button>
          <Button onClick={handleNext} loading={saving}>
            {isLast ? 'Finish' : 'Next'}
          </Button>
        </Group>
      </Stack>
    </Container>
  )
}
