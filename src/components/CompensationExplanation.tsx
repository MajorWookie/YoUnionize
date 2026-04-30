import {
  Accordion,
  Alert,
  Badge,
  Group,
  List,
  Stack,
  Text,
  Title,
} from '@mantine/core'

/**
 * Educational content explaining how named executives are compensated under
 * SEC disclosure rules. Sits on the executive detail page so the comp
 * breakdown numbers don't read as a black box. Plain-language with examples
 * of what each line item typically includes.
 */
export function CompensationExplanation() {
  return (
    <Stack gap="md">
      <div>
        <Title order={3}>How executive compensation works</Title>
        <Text size="sm" c="slate.7" mt={4}>
          Public companies disclose pay for their named executives under SEC
          Item 402. Total compensation is the sum of the categories below —
          but the headline number doesn't tell the whole story.
        </Text>
      </div>

      <Accordion variant="separated" multiple>
        <Accordion.Item value="salary">
          <Accordion.Control>
            <Group gap="xs">
              <Badge color="navy" variant="light" size="sm">
                Cash
              </Badge>
              <Text fw={600}>Base Salary</Text>
            </Group>
          </Accordion.Control>
          <Accordion.Panel>
            <Text size="sm">
              Fixed annual cash, paid out across the year like any other
              salary. For most named executives this is the smallest piece
              of total comp — often under 10% for CEOs of large public
              companies. Set by the Compensation Committee and disclosed in
              the proxy statement.
            </Text>
          </Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item value="bonus">
          <Accordion.Control>
            <Group gap="xs">
              <Badge color="navy" variant="light" size="sm">
                Cash
              </Badge>
              <Text fw={600}>Bonus</Text>
            </Group>
          </Accordion.Control>
          <Accordion.Panel>
            <Text size="sm">
              Discretionary cash awards that are <em>not</em> tied to
              pre-set performance metrics (those go in Non-Equity Incentive
              below). Often a signing bonus, retention bonus, or one-time
              award for a specific event. Many companies report $0 here.
            </Text>
          </Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item value="stock">
          <Accordion.Control>
            <Group gap="xs">
              <Badge color="green" variant="light" size="sm">
                Equity
              </Badge>
              <Text fw={600}>Stock Awards</Text>
            </Group>
          </Accordion.Control>
          <Accordion.Panel>
            <Stack gap="xs">
              <Text size="sm">
                The grant-date <em>fair value</em> of restricted stock units
                (RSUs) and performance share units (PSUs) issued during the
                year — usually the largest component for a CEO.
              </Text>
              <Text size="sm">
                <Text span fw={600}>
                  Important:
                </Text>{' '}
                this is the value at grant time. It is{' '}
                <em>not</em> what the executive actually pocketed if the
                stock price moved, or whether they hit performance hurdles.
                Vesting typically takes 3–4 years; PSUs only pay out if
                performance targets (revenue, TSR, EPS) are met.
              </Text>
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item value="options">
          <Accordion.Control>
            <Group gap="xs">
              <Badge color="green" variant="light" size="sm">
                Equity
              </Badge>
              <Text fw={600}>Option Awards</Text>
            </Group>
          </Accordion.Control>
          <Accordion.Panel>
            <Text size="sm">
              The Black-Scholes (or similar model) value of stock options
              granted during the year. Options give the executive the right
              to buy shares at a fixed strike price for a fixed term —
              valuable only if the stock price rises above strike. Less
              common than stock awards in modern comp design, but still
              used at many tech and growth companies.
            </Text>
          </Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item value="incentive">
          <Accordion.Control>
            <Group gap="xs">
              <Badge color="navy" variant="light" size="sm">
                Cash
              </Badge>
              <Text fw={600}>Non-Equity Incentive</Text>
            </Group>
          </Accordion.Control>
          <Accordion.Panel>
            <Text size="sm">
              Cash bonuses paid for hitting <em>pre-defined</em> performance
              targets — typically annual operating metrics like revenue,
              EBITDA, free cash flow, or strategic milestones. The
              committee sets the targets and threshold/target/max payout
              levels at the start of the year and pays out based on actual
              results.
            </Text>
          </Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item value="pension">
          <Accordion.Control>
            <Group gap="xs">
              <Badge color="slate" variant="light" size="sm">
                Deferred
              </Badge>
              <Text fw={600}>Change in Pension Value &amp; NQDC Earnings</Text>
            </Group>
          </Accordion.Control>
          <Accordion.Panel>
            <Text size="sm">
              The actuarial change in the present value of the executive's
              pension benefits, plus above-market earnings on
              non-qualified deferred compensation accounts. Often appears
              for long-tenured executives at older companies; less common
              at newer firms that don't offer pensions.
            </Text>
          </Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item value="other">
          <Accordion.Control>
            <Group gap="xs">
              <Badge color="orange" variant="light" size="sm">
                Perks
              </Badge>
              <Text fw={600}>Other Compensation (the perks bucket)</Text>
            </Group>
          </Accordion.Control>
          <Accordion.Panel>
            <Stack gap="xs">
              <Text size="sm">
                A catch-all for non-cash, non-equity benefits. The single
                line item on the summary table is itemized in a footnote
                in the proxy statement and{' '}
                <Text span fw={600}>
                  often includes:
                </Text>
              </Text>
              <List size="sm" spacing={2}>
                <List.Item>
                  <Text span fw={500}>Personal security:</Text> bodyguards,
                  residential security, secure transport — common for
                  CEOs of high-profile companies (e.g. Meta, Tesla)
                </List.Item>
                <List.Item>
                  <Text span fw={500}>Personal use of corporate aircraft:</Text>{' '}
                  charged at the IRS-imputed rate, not the actual cost,
                  which can run hundreds of thousands per year
                </List.Item>
                <List.Item>
                  <Text span fw={500}>Financial planning &amp; tax preparation:</Text>{' '}
                  reimbursed by the company
                </List.Item>
                <List.Item>
                  <Text span fw={500}>Executive medical / physical exams</Text>
                </List.Item>
                <List.Item>
                  <Text span fw={500}>Club memberships:</Text> golf, dining,
                  professional clubs
                </List.Item>
                <List.Item>
                  <Text span fw={500}>Auto allowance, driver, home-office expenses</Text>
                </List.Item>
                <List.Item>
                  <Text span fw={500}>401(k) match &amp; insurance premiums</Text>{' '}
                  (the same employer match all employees get, but the
                  dollar amount is naturally larger at executive salary
                  levels)
                </List.Item>
                <List.Item>
                  <Text span fw={500}>Tax gross-ups:</Text> the company
                  paying the executive's income tax on the perks above —
                  common but increasingly viewed as bad governance
                </List.Item>
              </List>
              <Text size="sm" mt="xs">
                The full per-perk breakdown is in the proxy statement's
                "All Other Compensation" footnote, usually a few pages
                after the summary table.
              </Text>
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>

      <Alert color="blue" variant="light" title="What's not in the headline number">
        <Stack gap={4}>
          <Text size="sm">
            The Total Compensation figure does <em>not</em> include:
          </Text>
          <List size="sm" spacing={2}>
            <List.Item>
              <Text span fw={500}>Realized equity gains:</Text> when the
              executive actually sells vested shares — these can dwarf
              the grant-date values, especially after a stock run
            </List.Item>
            <List.Item>
              <Text span fw={500}>Severance &amp; golden parachutes:</Text>{' '}
              cash + accelerated equity payable on termination or
              change-of-control, sometimes 2–3× annual comp
            </List.Item>
            <List.Item>
              <Text span fw={500}>Unvested equity overhang:</Text>{' '}
              outstanding RSUs/PSUs from prior years that haven't yet
              vested — disclosed in a separate "Outstanding Equity
              Awards" table
            </List.Item>
            <List.Item>
              <Text span fw={500}>Side investments &amp; board fees</Text>{' '}
              from other companies the executive serves
            </List.Item>
          </List>
        </Stack>
      </Alert>
    </Stack>
  )
}
