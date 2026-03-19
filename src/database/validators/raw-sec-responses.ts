import * as v from 'valibot'

export const InsertRawSecResponseSchema = v.object({
  companyId: v.pipe(v.string(), v.uuid()),
  endpoint: v.picklist([
    'filings',
    'xbrl',
    'sections',
    'compensation',
    'insider_trading',
    'directors',
    'form_8k',
    'full_text_search',
  ]),
  subKey: v.optional(v.nullable(v.string())),
  rawResponse: v.unknown(),
  fetchStatus: v.optional(v.picklist(['complete', 'partial', 'error'])),
  fetchError: v.optional(v.nullable(v.string())),
})

export type InsertRawSecResponse = v.InferOutput<typeof InsertRawSecResponseSchema>
