import { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  Container,
  Divider,
  Group,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { extractErrorMessage, fetchWithRetry } from '@younionize/api-client'
import { useAuth } from '@younionize/hooks'
import { CompanyTypeahead } from '~/components/CompanyTypeahead'
import {
  COST_OF_LIVING_FIELDS,
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

  if (loading) {
    return (
      <Container size="md" py="xl">
        <Text>Loading profile…</Text>
      </Container>
    )
  }

  const orgLabel = ORG_LEVELS.find((o) => o.value === orgLevel)?.label
  const formatMoney = (value: number | null, suffix = '') =>
    value != null ? `$${value.toLocaleString('en-US')}${suffix}` : null

  return (
    <Container size="md" py="xl">
      <Stack gap="lg">
        <Title order={2}>Profile</Title>

        {error && <Alert color="red">{error}</Alert>}

        <Card withBorder padding="md">
          <Stack gap={4}>
            <Text fw={600} size="md">
              {user?.name ?? 'User'}
            </Text>
            <Text c="slate.7" size="sm">
              {user?.email ?? ''}
            </Text>
          </Stack>
        </Card>

        <Divider />

        <Stack gap="sm">
          <Title order={4}>Employment Details</Title>

          {editingProfile ? (
            <Card withBorder padding="md">
              <Stack gap="md">
                <TextInput
                  label="Job Title"
                  placeholder="e.g. Software Engineer"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.currentTarget.value)}
                />
                <Select
                  label="Organization Level"
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
                  label="Gross Annual Pay"
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
                  <Button
                    variant="default"
                    onClick={() => setEditingProfile(false)}
                    disabled={savingProfile}
                  >
                    Cancel
                  </Button>
                  <Button onClick={saveProfile} loading={savingProfile}>
                    Save
                  </Button>
                </Group>
              </Stack>
            </Card>
          ) : (
            <Card withBorder padding="md">
              <Stack gap="xs">
                <ProfileRow label="Job Title" value={jobTitle || 'Not set'} />
                <ProfileRow label="Level" value={orgLabel ?? 'Not set'} />
                <ProfileRow
                  label="Company"
                  value={companyTicker || 'Not linked'}
                />
                <ProfileRow
                  label="Gross Annual Pay"
                  value={formatMoney(grossAnnualPay) ?? 'Not set'}
                />
                <Group mt="xs">
                  <Button
                    variant="default"
                    onClick={() => setEditingProfile(true)}
                  >
                    Edit
                  </Button>
                </Group>
              </Stack>
            </Card>
          )}
        </Stack>

        <Divider />

        <Stack gap="sm">
          <Title order={4}>Cost of Living</Title>
          <Text size="sm" c="slate.7">
            Monthly amounts — used for compensation fairness analysis.
          </Text>

          {editingCost ? (
            <Card withBorder padding="md">
              <Stack gap="md">
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                  {COST_OF_LIVING_FIELDS.map((field) => (
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
                <Group justify="flex-end" gap="sm">
                  <Button
                    variant="default"
                    onClick={() => setEditingCost(false)}
                    disabled={savingCost}
                  >
                    Cancel
                  </Button>
                  <Button onClick={saveCost} loading={savingCost}>
                    Save
                  </Button>
                </Group>
              </Stack>
            </Card>
          ) : (
            <Card withBorder padding="md">
              <Stack gap="xs">
                {COST_OF_LIVING_FIELDS.map((field) => (
                  <ProfileRow
                    key={field.key}
                    label={field.label}
                    value={formatMoney(cost[field.key], '/mo') ?? '—'}
                  />
                ))}
                <Group mt="xs">
                  <Button variant="default" onClick={() => setEditingCost(true)}>
                    Edit
                  </Button>
                </Group>
              </Stack>
            </Card>
          )}
        </Stack>

        <Divider />

        <Card withBorder padding="md">
          <Stack gap="xs">
            <Text fw={600}>About YoUnionize</Text>
            <Text size="sm" c="slate.7">
              YoUnionize helps employees understand their compensation in
              context. We analyze public SEC filings — executive pay, financial
              performance, risk factors — and use AI to translate complex
              financial documents into plain language so you can make informed
              decisions about your career and pay.
            </Text>
          </Stack>
        </Card>
      </Stack>
    </Container>
  )
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  const placeholder =
    value === 'Not set' || value === 'Not linked' || value === '—'
  return (
    <Box>
      <Text size="xs" c="slate.7" fw={500}>
        {label}
      </Text>
      <Text
        size="sm"
        c={placeholder ? 'slate.6' : undefined}
        fw={placeholder ? 400 : 500}
      >
        {value}
      </Text>
    </Box>
  )
}
