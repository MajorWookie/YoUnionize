import { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Container,
  Grid,
  Group,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconPencil, IconUserCircle } from '@tabler/icons-react'
import { extractErrorMessage, fetchWithRetry } from '@younionize/api-client'
import { useAuth } from '@younionize/hooks'
import { CompanyTypeahead } from '~/components/CompanyTypeahead'
import {
  EmptyState,
  Eyebrow,
  PageHeader,
  SectionHeader,
  SkeletonCard,
} from '~/components/primitives'
import {
  COST_OF_LIVING_FIELDS,
  COST_OF_LIVING_GROUPS,
  ORG_LEVELS,
  type CostOfLivingKey,
} from '~/lib/onboarding-constants'

interface UserProfile {
  jobTitle: string | null
  orgLevelCode: string | null
  grossAnnualPay: number | null
  companyTicker: string | null
}

type CostOfLiving = Record<CostOfLivingKey, number | null>

const EMPTY_COST: CostOfLiving = COST_OF_LIVING_FIELDS.reduce(
  (acc, f) => ({ ...acc, [f.key]: null }),
  {} as CostOfLiving,
)

export function ProfilePage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [jobTitle, setJobTitle] = useState('')
  const [orgLevel, setOrgLevel] = useState('')
  const [companyTicker, setCompanyTicker] = useState('')
  const [grossAnnualPay, setGrossAnnualPay] = useState<number | null>(null)
  const [cost, setCost] = useState<CostOfLiving>(EMPTY_COST)

  const [editingProfile, setEditingProfile] = useState(false)
  const [editingCost, setEditingCost] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingCost, setSavingCost] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchWithRetry('/api/user/me')
      if (!res.ok) throw new Error('Failed to load profile')
      const data = await res.json()

      const p: UserProfile | null = data.profile ?? null
      if (p) {
        setJobTitle(p.jobTitle ?? '')
        setOrgLevel(p.orgLevelCode ?? '')
        setCompanyTicker(p.companyTicker ?? '')
        setGrossAnnualPay(p.grossAnnualPay)
      }

      const c = data.costOfLiving as Partial<CostOfLiving> | null
      if (c) {
        setCost({ ...EMPTY_COST, ...c })
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
      const body = {
        jobTitle: jobTitle || null,
        orgLevelCode: orgLevel || null,
        companyTicker: companyTicker || null,
        grossAnnualPay,
      }
      const res = await fetchWithRetry('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(
          extractErrorMessage(data) || `Save failed (${res.status})`,
        )
      }
      setEditingProfile(false)
      notifications.show({ message: 'Profile saved', color: 'green' })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Save failed'
      notifications.show({ message: msg, color: 'red' })
    } finally {
      setSavingProfile(false)
    }
  }

  const saveCost = async () => {
    setSavingCost(true)
    try {
      const res = await fetchWithRetry('/api/user/cost-of-living', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cost),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(
          extractErrorMessage(data) || `Save failed (${res.status})`,
        )
      }
      setEditingCost(false)
      notifications.show({ message: 'Cost of living saved', color: 'green' })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Save failed'
      notifications.show({ message: msg, color: 'red' })
    } finally {
      setSavingCost(false)
    }
  }

  const updateCostField = useCallback(
    (key: CostOfLivingKey, value: number | null) => {
      setCost((prev) => ({ ...prev, [key]: value }))
    },
    [],
  )

  const orgLabel = ORG_LEVELS.find((o) => o.value === orgLevel)?.label
  const formatMoney = (value: number | null, suffix = '') =>
    value != null ? `$${value.toLocaleString('en-US')}${suffix}` : null

  const hasEmploymentData = Boolean(
    jobTitle || orgLevel || companyTicker || grossAnnualPay != null,
  )
  const hasCostData = Object.values(cost).some((v) => v != null)

  if (loading) {
    return (
      <Container size="lg" py="xl">
        <Stack gap="xl">
          <PageHeader title="Profile" />
          <Grid gutter="lg">
            <Grid.Col span={{ base: 12, md: 8 }}>
              <Stack gap="lg">
                <SkeletonCard rows={4} />
                <SkeletonCard rows={6} />
              </Stack>
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 4 }}>
              <Stack gap="md">
                <SkeletonCard rows={2} />
              </Stack>
            </Grid.Col>
          </Grid>
        </Stack>
      </Container>
    )
  }

  return (
    <Container size="lg" py="xl">
      <Stack gap="xl">
        <PageHeader
          title="Profile"
          description="Keep your job, pay, and cost of living up to date so YoUnionize can tailor insights to you."
        />

        {error ? <Alert color="red">{error}</Alert> : null}

        <Grid gutter="lg">
          <Grid.Col span={{ base: 12, md: 8 }}>
            <Stack gap="xl">
              {/* ── Employment ─────────────────────────────────── */}
              <Stack gap="sm">
                <SectionHeader
                  title="Employment"
                  action={
                    !editingProfile && hasEmploymentData ? (
                      <Button
                        variant="default"
                        size="xs"
                        leftSection={<IconPencil size={12} />}
                        onClick={() => setEditingProfile(true)}
                      >
                        Edit
                      </Button>
                    ) : null
                  }
                />
                {editingProfile ? (
                  <EmploymentEditCard
                    jobTitle={jobTitle}
                    setJobTitle={setJobTitle}
                    orgLevel={orgLevel}
                    setOrgLevel={setOrgLevel}
                    companyTicker={companyTicker}
                    setCompanyTicker={setCompanyTicker}
                    grossAnnualPay={grossAnnualPay}
                    setGrossAnnualPay={setGrossAnnualPay}
                    onCancel={() => setEditingProfile(false)}
                    onSave={saveProfile}
                    saving={savingProfile}
                  />
                ) : !hasEmploymentData ? (
                  <EmptyState
                    icon={<IconUserCircle size={28} stroke={1.5} />}
                    title="Tell us about your job"
                    description="Add your role, company, and pay so we can benchmark you against peers and personalize your insights."
                    action={
                      <Button onClick={() => setEditingProfile(true)}>
                        Set up employment
                      </Button>
                    }
                  />
                ) : (
                  <Card>
                    <Stack gap="md">
                      <ProfileRow
                        label="Job title"
                        value={jobTitle || 'Not set'}
                      />
                      <ProfileRow
                        label="Level"
                        value={orgLabel ?? 'Not set'}
                      />
                      <ProfileRow
                        label="Company"
                        value={companyTicker || 'Not linked'}
                      />
                      <ProfileRow
                        label="Gross annual pay"
                        value={formatMoney(grossAnnualPay) ?? 'Not set'}
                      />
                    </Stack>
                  </Card>
                )}
              </Stack>

              {/* ── Cost of living ─────────────────────────────── */}
              <Stack gap="sm">
                <SectionHeader
                  title="Cost of living"
                  description="Monthly amounts. Used to compare your take-home against your local norm."
                  action={
                    !editingCost && hasCostData ? (
                      <Button
                        variant="default"
                        size="xs"
                        leftSection={<IconPencil size={12} />}
                        onClick={() => setEditingCost(true)}
                      >
                        Edit
                      </Button>
                    ) : null
                  }
                />
                {editingCost ? (
                  <CostEditCard
                    cost={cost}
                    updateCostField={updateCostField}
                    onCancel={() => setEditingCost(false)}
                    onSave={saveCost}
                    saving={savingCost}
                  />
                ) : !hasCostData ? (
                  <EmptyState
                    title="No monthly costs yet"
                    description="Add your monthly expenses to unlock take-home and pay-fairness comparisons."
                    action={
                      <Button onClick={() => setEditingCost(true)}>
                        Add costs
                      </Button>
                    }
                  />
                ) : (
                  <CostViewCard cost={cost} formatMoney={formatMoney} />
                )}
              </Stack>
            </Stack>
          </Grid.Col>

          {/* ── Sidebar ─────────────────────────────────────── */}
          <Grid.Col span={{ base: 12, md: 4 }}>
            <Stack gap="md">
              <Card>
                <Stack gap={4}>
                  <Eyebrow>Account</Eyebrow>
                  <Text size="sm" fw={600} mt="xs">
                    {user?.name || 'User'}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {user?.email || ''}
                  </Text>
                </Stack>
              </Card>

              <Card>
                <Stack gap={4}>
                  <Eyebrow>Privacy</Eyebrow>
                  <Text size="sm" c="dimmed" mt="xs">
                    Your pay and cost-of-living data are stored privately.
                    Never shared with employers, never sold.
                  </Text>
                </Stack>
              </Card>
            </Stack>
          </Grid.Col>
        </Grid>
      </Stack>
    </Container>
  )
}

// ── Subcomponents ──────────────────────────────────────────────────────

function ProfileRow({ label, value }: { label: string; value: string }) {
  const placeholder =
    value === 'Not set' || value === 'Not linked' || value === '—'
  return (
    <Group justify="space-between" wrap="nowrap" gap="md">
      <Text size="sm" c="dimmed">
        {label}
      </Text>
      <Text
        size="sm"
        fw={placeholder ? 400 : 500}
        c={placeholder ? 'dimmed' : undefined}
        fs={placeholder ? 'italic' : undefined}
      >
        {value}
      </Text>
    </Group>
  )
}

interface EmploymentEditProps {
  jobTitle: string
  setJobTitle: (v: string) => void
  orgLevel: string
  setOrgLevel: (v: string) => void
  companyTicker: string
  setCompanyTicker: (v: string) => void
  grossAnnualPay: number | null
  setGrossAnnualPay: (v: number | null) => void
  onCancel: () => void
  onSave: () => void
  saving: boolean
}

function EmploymentEditCard({
  jobTitle,
  setJobTitle,
  orgLevel,
  setOrgLevel,
  companyTicker,
  setCompanyTicker,
  grossAnnualPay,
  setGrossAnnualPay,
  onCancel,
  onSave,
  saving,
}: EmploymentEditProps) {
  return (
    <Card>
      <Stack gap="md">
        <TextInput
          label="Job title"
          placeholder="e.g. Software Engineer"
          value={jobTitle}
          onChange={(e) => {
            const value = e.currentTarget.value
            setJobTitle(value)
          }}
        />
        <Select
          label="Organization level"
          placeholder="Select your level…"
          data={[...ORG_LEVELS]}
          value={orgLevel || null}
          onChange={(v) => setOrgLevel(v ?? '')}
          clearable
        />
        <CompanyTypeahead
          value={companyTicker}
          onSelect={(t) => setCompanyTicker(t)}
        />
        <NumberInput
          label="Gross annual pay"
          placeholder="85,000"
          prefix="$"
          thousandSeparator=","
          allowNegative={false}
          hideControls
          value={grossAnnualPay ?? ''}
          onChange={(v) =>
            setGrossAnnualPay(typeof v === 'number' ? v : null)
          }
        />
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={onSave} loading={saving}>
            Save
          </Button>
        </Group>
      </Stack>
    </Card>
  )
}

interface CostViewProps {
  cost: CostOfLiving
  formatMoney: (value: number | null, suffix?: string) => string | null
}

function CostViewCard({ cost, formatMoney }: CostViewProps) {
  return (
    <Card>
      <Stack gap="lg">
        {COST_OF_LIVING_GROUPS.map((group) => {
          const fields = COST_OF_LIVING_FIELDS.filter(
            (f) => f.group === group.id,
          )
          return (
            <Stack key={group.id} gap="sm">
              <Eyebrow>{group.label}</Eyebrow>
              <Stack gap="xs">
                {fields.map((field) => (
                  <ProfileRow
                    key={field.key}
                    label={field.label}
                    value={formatMoney(cost[field.key], '/mo') ?? 'Not set'}
                  />
                ))}
              </Stack>
            </Stack>
          )
        })}
      </Stack>
    </Card>
  )
}

interface CostEditProps {
  cost: CostOfLiving
  updateCostField: (key: CostOfLivingKey, value: number | null) => void
  onCancel: () => void
  onSave: () => void
  saving: boolean
}

function CostEditCard({
  cost,
  updateCostField,
  onCancel,
  onSave,
  saving,
}: CostEditProps) {
  return (
    <Card>
      <Stack gap="lg">
        {COST_OF_LIVING_GROUPS.map((group) => {
          const fields = COST_OF_LIVING_FIELDS.filter(
            (f) => f.group === group.id,
          )
          return (
            <Stack key={group.id} gap="sm">
              <Eyebrow>{group.label}</Eyebrow>
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
                      updateCostField(
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
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={onSave} loading={saving}>
            Save
          </Button>
        </Group>
      </Stack>
    </Card>
  )
}
