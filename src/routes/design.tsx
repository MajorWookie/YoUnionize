import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Group,
  Select,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  TextInput,
  Title,
  useMantineColorScheme,
} from '@mantine/core'
import {
  IconCash,
  IconCompass,
  IconMoon,
  IconSparkles,
  IconSun,
} from '@tabler/icons-react'
import { MarkdownContent } from '~/components/MarkdownContent'
import {
  EmptyState,
  Eyebrow,
  MetricCard,
  PageHeader,
  SectionHeader,
  SkeletonCard,
  StatGrid,
} from '~/components/primitives'
import { chartPalette } from '~/theme/tokens'
import cardClasses from '~/theme/Card.module.css'

const PALETTES = ['navy', 'terracotta', 'slate', 'green', 'red', 'amber'] as const
const SHADES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const

const PROSE_FIXTURE = `# Apple's compensation story, FY 2024

The CEO took home **$74.6 million** in 2024 — about **1,447 times** the median Apple employee, who earned $51,500. That ratio rose 16% year over year, primarily on equity grants that vest over the next four years.

## How the pay breaks down

CEO Tim Cook's compensation has four major components:

- **Salary**: $3.0 million (flat year over year)
- **Bonus**: $12.0 million (2× target, on operating-income performance)
- **Stock awards**: $58.1 million (RSUs, three-year cliff vest)
- **Other**: $1.5 million (security, retirement, perks)

The stock award is the headline item — it's roughly 78% of total comp, and its value depends on Apple's share price three years from now.

## What this means for employees

> Pay-ratio disclosures don't tell you *whether* you're being paid fairly. They tell you the gap between you and the top, and let you decide what to do about it.

For an Apple software engineer earning, say, $200,000 in total comp, the CEO-to-IC ratio is closer to 373× — still extreme, but a different number than the company-wide 1,447×. The headline ratio uses *median* employee pay, which Apple's disclosure puts at $51,500 — that figure includes retail-store employees, who skew the median lower.

### Try the math yourself

\`\`\`
ceo_comp / your_comp = personal_pay_ratio
\`\`\`

| Role | Median comp | Personal ratio |
|------|-------------|----------------|
| Retail | $48,000 | 1,554× |
| Engineer | $200,000 | 373× |
| Director | $400,000 | 187× |

Read [Apple's full proxy statement](https://example.com) for the source numbers.
`

export function DesignPage() {
  const { colorScheme, toggleColorScheme } = useMantineColorScheme()

  return (
    <Stack gap="xl">
      <PageHeader
        eyebrow="Internal"
        title="Design foundations"
        description="Phase 0b reference surface. Use this page to verify that theme tokens, primitives, prose, and Mantine components render correctly across light and dark modes."
        actions={
          <ActionIcon
            variant="subtle"
            size="lg"
            onClick={toggleColorScheme}
            aria-label="Toggle color scheme"
          >
            {colorScheme === 'dark' ? <IconSun size={18} /> : <IconMoon size={18} />}
          </ActionIcon>
        }
      />

      <Tabs defaultValue="tokens" keepMounted={false}>
        <Tabs.List mb="lg">
          <Tabs.Tab value="tokens">Tokens</Tabs.Tab>
          <Tabs.Tab value="primitives">Primitives</Tabs.Tab>
          <Tabs.Tab value="components">Mantine</Tabs.Tab>
          <Tabs.Tab value="prose">Prose</Tabs.Tab>
          <Tabs.Tab value="charts">Charts</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="tokens">
          <Stack gap="xl">
            <section>
              <SectionHeader
                title="Color palettes"
                description="Six custom palettes plus Mantine built-ins. Index 6 is the default light-mode primary shade; index 4 is the dark-mode primary shade."
              />
              <Stack gap="md">
                {PALETTES.map((palette) => (
                  <div key={palette}>
                    <Text size="sm" fw={600} mb={6} tt="capitalize">
                      {palette}
                    </Text>
                    <Group gap={4} wrap="nowrap">
                      {SHADES.map((shade) => (
                        <div
                          key={shade}
                          style={{
                            flex: 1,
                            height: 56,
                            background: `var(--mantine-color-${palette}-${shade})`,
                            borderRadius: 6,
                            display: 'flex',
                            alignItems: 'flex-end',
                            justifyContent: 'center',
                            paddingBottom: 4,
                            color: shade >= 5 ? 'white' : 'var(--mantine-color-text)',
                            fontSize: 11,
                            fontWeight: 600,
                          }}
                        >
                          {shade}
                        </div>
                      ))}
                    </Group>
                  </div>
                ))}
              </Stack>
            </section>

            <section>
              <SectionHeader
                title="Typography scale"
                description="Inter Variable for chrome and headings; Source Serif 4 reserved for prose surfaces."
              />
              <Card>
                <Stack gap="md">
                  <Title order={1}>Heading 1 — 36px / 700</Title>
                  <Title order={2}>Heading 2 — 28px / 700</Title>
                  <Title order={3}>Heading 3 — 22px / 600</Title>
                  <Title order={4}>Heading 4 — 18px / 600</Title>
                  <Title order={5}>Heading 5 — 15px / 600</Title>
                  <Title order={6}>Heading 6 — 13px / 600</Title>
                  <Group gap="lg" align="baseline">
                    <Text fz="xl">xl — 20px</Text>
                    <Text fz="lg">lg — 18px</Text>
                    <Text fz="md">md — 16px</Text>
                    <Text fz="sm">sm — 14px</Text>
                    <Text fz="xs">xs — 12px</Text>
                  </Group>
                </Stack>
              </Card>
            </section>

            <section>
              <SectionHeader
                title="Radius & spacing"
                description="The radius scale eliminates the hardcoded 5/6 literals from the chart layer."
              />
              <SimpleGrid cols={{ base: 2, sm: 5 }}>
                {(['xs', 'sm', 'md', 'lg', 'xl'] as const).map((r) => (
                  <Card key={r} style={{ borderRadius: `var(--mantine-radius-${r})` }}>
                    <Text fz="xs" c="dimmed" ta="center">
                      radius={r}
                    </Text>
                  </Card>
                ))}
              </SimpleGrid>
            </section>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="primitives">
          <Stack gap="xl">
            <section>
              <SectionHeader title="PageHeader" />
              <Card>
                <PageHeader
                  eyebrow="My Pay"
                  title="Are you being paid fairly?"
                  description="Compare your compensation against your peers and your local cost of living. The verdict appears below in plain language."
                  actions={
                    <Button variant="light" leftSection={<IconSparkles size={14} />}>
                      Refresh analysis
                    </Button>
                  }
                />
              </Card>
            </section>

            <section>
              <SectionHeader title="SectionHeader" />
              <Card>
                <SectionHeader
                  title="Recent filings"
                  description="The last 12 months of SEC submissions for this company."
                  action={<Button variant="subtle" size="xs">See all</Button>}
                />
                <Text c="dimmed" size="sm">
                  (section content would go here)
                </Text>
              </Card>
            </section>

            <section>
              <SectionHeader title="MetricCard / StatGrid" description="Tabular numerics in Inter; deltas color-coded." />
              <StatGrid>
                <MetricCard
                  label="Median pay"
                  value="$58,712"
                  delta={{ value: '+4.2% YoY', direction: 'up' }}
                />
                <MetricCard
                  label="CEO comp"
                  value="$24.1M"
                  delta={{ value: '+12% YoY', direction: 'up' }}
                />
                <MetricCard
                  label="Pay ratio"
                  value="412×"
                  delta={{ value: '-3% YoY', direction: 'down' }}
                  hint="vs. median worker"
                />
                <MetricCard label="Employees" value="42,300" delta={{ value: 'Flat', direction: 'flat' }} />
              </StatGrid>
            </section>

            <section>
              <SectionHeader title="EmptyState" />
              <EmptyState
                icon={<IconCompass size={28} stroke={1.5} />}
                title="No saved companies yet"
                description="Search for a company in Discover to see its compensation story alongside yours."
                action={<Button variant="filled">Browse companies</Button>}
              />
            </section>

            <section>
              <SectionHeader title="SkeletonCard" />
              <SimpleGrid cols={{ base: 1, sm: 3 }}>
                <SkeletonCard />
                <SkeletonCard rows={5} />
                <SkeletonCard withMedia />
              </SimpleGrid>
            </section>

            <section>
              <SectionHeader title="Eyebrow" />
              <Card>
                <Eyebrow>Featured story</Eyebrow>
                <Title order={3} mt="xs">
                  How Apple's pay ratio actually breaks down
                </Title>
              </Card>
            </section>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="components">
          <Stack gap="xl">
            <section>
              <SectionHeader title="Buttons" />
              <Stack gap="sm">
                <Group>
                  <Button>Primary</Button>
                  <Button variant="light">Light</Button>
                  <Button variant="subtle">Subtle</Button>
                  <Button variant="outline">Outline</Button>
                  <Button variant="filled" color="red">
                    Danger
                  </Button>
                  <Button variant="light" color="terracotta">
                    Terracotta
                  </Button>
                </Group>
                <Group>
                  <Button size="xs">xs</Button>
                  <Button size="sm">sm (default)</Button>
                  <Button size="md">md</Button>
                  <Button size="lg">lg</Button>
                </Group>
              </Stack>
            </section>

            <section>
              <SectionHeader title="Cards" description="Flat-editorial default + opt-in interactive variant." />
              <SimpleGrid cols={{ base: 1, sm: 2 }}>
                <Card>
                  <Title order={4} mb="xs">
                    Default Card
                  </Title>
                  <Text size="sm" c="dimmed">
                    withBorder, no shadow, padding=lg, radius=md.
                  </Text>
                </Card>
                <Card className={cardClasses.interactive}>
                  <Title order={4} mb="xs">
                    Interactive Card
                  </Title>
                  <Text size="sm" c="dimmed">
                    Hover me — translates and lifts a shadow.
                  </Text>
                </Card>
              </SimpleGrid>
            </section>

            <section>
              <SectionHeader title="Badges" />
              <Group>
                <Badge>Default</Badge>
                <Badge color="green">Success</Badge>
                <Badge color="red">Danger</Badge>
                <Badge color="amber">Warning</Badge>
                <Badge color="terracotta">Accent</Badge>
                <Badge variant="filled">Filled</Badge>
                <Badge variant="outline">Outline</Badge>
              </Group>
            </section>

            <section>
              <SectionHeader title="Form inputs" />
              <SimpleGrid cols={{ base: 1, sm: 2 }}>
                <TextInput label="Email" placeholder="you@example.com" />
                <Select
                  label="Pay frequency"
                  placeholder="Select"
                  data={['Weekly', 'Bi-weekly', 'Monthly', 'Annually']}
                />
              </SimpleGrid>
            </section>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="prose">
          <SectionHeader
            title="MarkdownContent prose"
            description="Source Serif 4 body, Inter headings, 65ch measure, terracotta blockquote rule, sans bold inside serif body, zebra tables."
          />
          <Card>
            <MarkdownContent>{PROSE_FIXTURE}</MarkdownContent>
          </Card>
        </Tabs.Panel>

        <Tabs.Panel value="charts">
          <Stack gap="xl">
            <section>
              <SectionHeader
                title="Chart palette"
                description="Ten consistent colors for categorical data series. Use chartPalette[i] from src/theme/tokens.ts."
              />
              <Group gap="sm">
                {chartPalette.map((token, i) => (
                  <div
                    key={token}
                    style={{
                      width: 80,
                      height: 80,
                      background: `var(--mantine-color-${token.replace('.', '-')})`,
                      borderRadius: 8,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    <span style={{ fontSize: 10, opacity: 0.85 }}>{i}</span>
                    <span>{token}</span>
                  </div>
                ))}
              </Group>
            </section>

            <section>
              <SectionHeader
                title="Income statement ramps"
                description="Sequential ramps (CSS variable form) consumed by IncomeStatementSunburst via src/lib/income-data-extractor.ts."
              />
              <Stack gap="md">
                <RampSwatch label="revenueRamp (navy)" colors={['navy.3', 'navy.5', 'navy.6', 'navy.7', 'navy.8']} />
                <RampSwatch
                  label="opexRamp (terracotta + amber)"
                  colors={['terracotta.4', 'terracotta.5', 'terracotta.6', 'terracotta.7', 'amber.6', 'amber.7']}
                />
                <RampSwatch
                  label="incomeWaterfall"
                  colors={['terracotta.6', 'slate.5', 'red.5', 'green.5', 'red.5', 'grape.5', 'green.6', 'red.6']}
                />
              </Stack>
            </section>

            <section>
              <SectionHeader title="Quick links" />
              <Group>
                <Button
                  component="a"
                  href="/discover"
                  variant="subtle"
                  leftSection={<IconCompass size={14} />}
                >
                  Open Discover
                </Button>
                <Button
                  component="a"
                  href="/my-pay"
                  variant="subtle"
                  leftSection={<IconCash size={14} />}
                >
                  Open My Pay
                </Button>
              </Group>
            </section>
          </Stack>
        </Tabs.Panel>
      </Tabs>
    </Stack>
  )
}

function RampSwatch({ label, colors }: { label: string; colors: string[] }) {
  return (
    <div>
      <Text size="xs" c="dimmed" fw={600} mb={4}>
        {label}
      </Text>
      <Group gap={2} wrap="nowrap">
        {colors.map((token, i) => (
          <div
            key={`${token}-${i}`}
            style={{
              flex: 1,
              height: 36,
              background: `var(--mantine-color-${token.replace('.', '-')})`,
              borderRadius: 4,
            }}
            title={token}
          />
        ))}
      </Group>
    </div>
  )
}
