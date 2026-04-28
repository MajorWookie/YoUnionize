import { describe, expect, it } from 'vitest'
import { extractJson } from '../extract-json'

describe('extractJson', () => {
  it('parses clean JSON directly', () => {
    const result = extractJson<{ name: string }>('{"name": "test"}')
    expect(result).toEqual({ name: 'test' })
  })

  it('strips markdown code fences', () => {
    const input = '```json\n{"name": "test"}\n```'
    const result = extractJson<{ name: string }>(input)
    expect(result).toEqual({ name: 'test' })
  })

  it('strips code fences without json label', () => {
    const input = '```\n{"name": "test"}\n```'
    const result = extractJson<{ name: string }>(input)
    expect(result).toEqual({ name: 'test' })
  })

  it('extracts JSON from prose preamble', () => {
    const input = 'I\'ll analyze this filing for you.\n\n{"headline": "Revenue is up", "key_numbers": []}'
    const result = extractJson<{ headline: string }>(input)
    expect(result).toEqual({ headline: 'Revenue is up', key_numbers: [] })
  })

  it('extracts JSON from prose preamble and postamble', () => {
    const input =
      'Here is my analysis:\n\n{"headline": "Growth slowing"}\n\nLet me know if you need more detail.'
    const result = extractJson<{ headline: string }>(input)
    expect(result).toEqual({ headline: 'Growth slowing' })
  })

  it('extracts JSON array from mixed text', () => {
    const input = 'Here are the results:\n[{"id": 1}, {"id": 2}]\nDone.'
    const result = extractJson<Array<{ id: number }>>(input)
    expect(result).toEqual([{ id: 1 }, { id: 2 }])
  })

  it('throws when no JSON is present', () => {
    expect(() => extractJson('This is just plain text with no JSON')).toThrow('No JSON found')
  })

  it('throws when braces are malformed', () => {
    expect(() => extractJson('Only an opening brace { but nothing else')).toThrow(
      'Malformed JSON',
    )
  })
})
