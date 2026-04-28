# SEC Filing Sections — Reference Key

This document is a user-facing key for the section codes that appear inside each
SEC filing type YoUnion ingests. It maps each code returned by sec-api.io to a
human-readable name, with a one-line description of what that section contains.

The codes are the source of truth in
[`packages/sec-api/src/sec-api.constants.ts`](../packages/sec-api/src/sec-api.constants.ts).
Helpers that resolve a code to a friendly name (and the inverse) live in
[`packages/sec-api/src/sections.ts`](../packages/sec-api/src/sections.ts).

A ✅ in the **Summarized** column means the section is wired into the
AI summarization pipeline today (see `LEGACY_KEY_TO_CODE` in `sections.ts`).
Other sections are fetched and stored verbatim but do not yet feed a prompt.

---

## 10-K — Annual Report

The comprehensive annual disclosure. Item codes follow the SEC's plain-number
scheme (`1`, `1A`, `7`, …). Codes with a letter suffix are sub-items added in
later SEC rule revisions.

| Code | Name | Description | Summarized |
|------|------|-------------|:---:|
| `1`   | Business Overview            | Description of the company's operations, products, segments, and competitive landscape. | ✅ |
| `1A`  | Risk Factors                 | Material risks that could affect the business, financial condition, or stock price. | ✅ |
| `1B`  | Unresolved Staff Comments    | Outstanding comments from the SEC staff on prior filings (often empty). | |
| `1C`  | Cybersecurity                | Cybersecurity risk-management processes, governance, and material incidents. | |
| `2`   | Properties                   | Physical facilities owned or leased (HQ, plants, retail, data centers). | |
| `3`   | Legal Proceedings            | Material pending litigation, regulatory actions, and government investigations. | ✅ |
| `4`   | Mine Safety Disclosures      | Mining-operation safety violations (only relevant to mining issuers). | |
| `5`   | Market Information           | Stock listing info, holders of record, dividends, and share-repurchase activity. | |
| `6`   | Selected Financial Data      | Five-year selected financial highlights (deprecated by the SEC in 2021; often blank). | |
| `7`   | MD&A                         | Management's Discussion & Analysis — narrative of results, liquidity, and outlook. | ✅ |
| `7A`  | Quantitative Disclosures     | Market-risk exposures (interest rate, FX, commodity) and hedging. | |
| `8`   | Financial Statements         | Audited financial statements and notes. | ✅ |
| `9`   | Disagreements with Accountants | Changes in or disagreements with the company's auditors (rarely populated). | |
| `9A`  | Controls and Procedures      | Effectiveness of disclosure controls and internal control over financial reporting (SOX 404). | |
| `9B`  | Other Information            | Catch-all for items required to be reported on Form 8-K but disclosed here. | |
| `10`  | Directors and Governance     | Board, executive officers, and corporate-governance practices (often incorporated by reference from the proxy). | |
| `11`  | Executive Compensation       | Named-executive-officer pay tables (often incorporated by reference from DEF 14A). | ✅ |
| `12`  | Security Ownership           | Beneficial ownership of >5% holders, directors, and officers. | |
| `13`  | Related Transactions         | Related-party transactions and director independence. | |
| `14`  | Accountant Fees              | Audit and non-audit fees paid to the principal auditor. | |
| `15`  | Exhibits                     | Index of exhibits and financial-statement schedules filed with the report. | |

---

## 10-Q — Quarterly Report

Quarterly update covering interim periods. The form is split into two parts —
Part I (Financial Information) and Part II (Other Information). Codes therefore
read `part1itemN` / `part2itemN`.

| Code | Name | Description | Summarized |
|------|------|-------------|:---:|
| `part1item1`  | Financial Statements      | Unaudited interim balance sheet, income statement, cash flows, and notes. | ✅ |
| `part1item2`  | MD&A                      | Quarterly management discussion of results and liquidity. | ✅ |
| `part1item3`  | Quantitative Disclosures  | Material changes in market-risk exposures since the last 10-K. | |
| `part1item4`  | Controls and Procedures   | Quarterly evaluation of disclosure controls and any material changes. | |
| `part2item1`  | Legal Proceedings         | New or materially changed litigation since the last filing. | ✅ |
| `part2item1a` | Risk Factors              | Material changes to the risk factors disclosed in the last 10-K. | ✅ |
| `part2item2`  | Unregistered Sales        | Unregistered equity sales and share-repurchase activity. | |
| `part2item3`  | Defaults                  | Defaults on senior securities. | |
| `part2item4`  | Mine Safety Disclosures   | Mining-operation safety reporting (rare). | |
| `part2item5`  | Other Information         | Items required to be reported on Form 8-K but disclosed here. | |
| `part2item6`  | Exhibits                  | Exhibits filed with the quarterly report. | |

---

## 8-K — Current Report (Material Events)

Filed within four business days when a triggering event occurs. Codes use the
SEC's `major-minor` scheme, where the major number groups related events
(1.x = Business & Operations, 2.x = Financial Information, 5.x = Corporate
Governance, etc.). Most 8-Ks include only one or two items.

| Code | Name | Description |
|------|------|-------------|
| `1-1`  | Entry into Material Agreement | Entering into a material definitive agreement outside the ordinary course of business. |
| `1-2`  | Bankruptcy or Receivership    | Bankruptcy filing or appointment of a receiver. |
| `1-3`  | Mine Safety                   | Imminent-danger orders or significant mine-safety actions. |
| `2-2`  | Results of Operations         | Public release of quarterly or annual earnings (the "earnings announcement" 8-K). |
| `2-3`  | Creation of Material Obligation | New direct financial obligation or off-balance-sheet arrangement. |
| `2-5`  | Costs Associated with Exit Activities | Restructuring, severance, or facility-shutdown charges. |
| `2-6`  | Material Impairments          | Material asset, goodwill, or intangible impairments. |
| `3-1`  | Delisting / Listing Standards | Notice of delisting, listing-standard non-compliance, or transfer of listing. |
| `3-2`  | Unregistered Sales of Equity  | Sale of unregistered securities. |
| `3-3`  | Material Modification of Rights | Changes to the rights of security holders. |
| `4-1`  | Auditor Changes               | Resignation, dismissal, or appointment of the principal auditor. |
| `4-2`  | Non-Reliance / Restatement    | Determination that previously issued financials should no longer be relied upon. |
| `5-2`  | Director / Officer Changes    | Departure, election, or appointment of directors or executive officers (incl. comp arrangements). |
| `5-3`  | Amendments to Articles / Bylaws | Charter or bylaw amendments and changes to the fiscal year. |
| `5-5`  | Code of Ethics                | Adoption of, or waiver from, the company's code of ethics. |
| `6-1`  | ABS Information               | Asset-backed securities informational and computational material. |
| `7-1`  | Regulation FD Disclosure      | Voluntary public disclosure under Reg FD. |
| `8-1`  | Other Events                  | Catch-all for events the registrant deems material. |
| `9-1`  | Financial Statements / Exhibits | Financial statements of acquired businesses, pro formas, and exhibits. |
| `signature` | Signature                | The signature block at the end of the filing. |

> Note: 8-K sections are not yet routed to dedicated AI summarization prompts —
> they are surfaced on the company dashboard as a chronological event feed.

---

## DEF 14A — Definitive Proxy Statement

Filed before the annual shareholder meeting. The form's section taxonomy in
sec-api.io is intentionally narrow — most useful content is concentrated in
two items.

| Code | Name | Description | Summarized |
|------|------|-------------|:---:|
| `part1item1` | Proxy                    | Meeting logistics, voting matters, board nominees, and shareholder proposals. | ✅ |
| `part1item7` | Executive Compensation   | Compensation Discussion & Analysis (CD&A), Summary Compensation Table, and pay-vs-performance disclosures. | ✅ |

---

## Other Filing Types (no parsed sections)

These filing types appear in `FilingType` and are ingested as filing metadata
(date, accession number, filer), but they do not have a section taxonomy in
this app. Their substantive content is consumed via XBRL or dedicated tables
(insider trades, ownership stakes), not the section pipeline.

| Code      | Name                         | Description |
|-----------|------------------------------|-------------|
| `3`       | Form 3                       | Initial statement of beneficial ownership by an insider. |
| `4`       | Form 4                       | Changes in insider ownership (the canonical "insider trade" filing). |
| `5`       | Form 5                       | Annual catch-up of insider ownership changes not previously reported. |
| `S-1`     | Form S-1                     | Initial registration statement for a new public offering (IPO). |
| `424B4`   | Form 424B4                   | Final prospectus filed at IPO pricing. |
| `13F-HR`  | Form 13F-HR                  | Quarterly holdings report by institutional investment managers ($100M+ AUM). |
| `SC 13D`  | Schedule 13D                 | Beneficial ownership of >5% by an active investor. |
| `SC 13G`  | Schedule 13G                 | Beneficial ownership of >5% by a passive investor. |
| `144`     | Form 144                     | Notice of proposed sale of restricted or control securities. |
| `D`       | Form D                       | Notice of exempt offering (Regulation D private placements). |
| `C`       | Form C                       | Crowdfunding offering disclosure (Regulation Crowdfunding). |

---

## Where this matters in the codebase

- **Parsing & storage**: `raw_sec_responses` keeps the verbatim sec-api.io
  payload; `filing_summaries.raw_data.extractedSections` and the
  `filing_sections` table key sections by these codes.
- **Friendly names in UI**: call `getSectionFriendlyName(code, filingType)` —
  it returns the enum name (e.g. `'7' → 'MD_AND_A'`) with a fallback to the
  raw code.
- **Legacy compatibility**: older summary records used camelCase keys
  (`mdAndA`, `riskFactors`, …). `legacyKeyToSectionCode` and
  `sectionCodeToLegacyKey` translate between the two so historical data still
  renders.
