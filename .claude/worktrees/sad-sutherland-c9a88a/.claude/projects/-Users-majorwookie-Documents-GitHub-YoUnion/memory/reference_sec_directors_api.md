---
name: SEC Directors API sizing
description: SEC /directors-and-board-members API size param = number of proxy filings (one per year), not individual directors
type: reference
---

The SEC API `/directors-and-board-members` endpoint returns filing-level data. Each `data[]` entry represents one DEF 14A proxy filing (identified by `filedAt`), containing the full board roster for that year. The `size` parameter controls how many filing years are returned, not how many directors.

**How to apply:** When setting `size` for directors queries, use the number of years of data desired (e.g., `--years=1` → `size: 1`). The same pattern applies to the insider trading and exec compensation endpoints — `size` is filing-scoped.
