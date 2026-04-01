import { describe, it, expect, vi, afterEach } from 'vitest'
import { ensureEnv } from './ensureEnv'

describe('ensureEnv', () => {
  afterEach(() => {
    delete process.env.TEST_ENV_VAR
  })

  it('returns the value when set', () => {
    process.env.TEST_ENV_VAR = 'hello'
    expect(ensureEnv('TEST_ENV_VAR')).toBe('hello')
  })

  it('throws when not set', () => {
    expect(() => ensureEnv('NONEXISTENT_VAR_12345')).toThrow()
  })

  it('throws when empty string', () => {
    process.env.TEST_ENV_VAR = ''
    expect(() => ensureEnv('TEST_ENV_VAR')).toThrow()
  })
})
