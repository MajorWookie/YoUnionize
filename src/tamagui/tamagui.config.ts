import { defaultConfig } from '@tamagui/config/v5'
import { createTamagui } from 'tamagui'
import { themes } from './themes'

export const config = createTamagui({
  ...defaultConfig,
  themes,
  tokens: {
    ...defaultConfig.tokens,
    color: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- defaultConfig.tokens.color missing from Tamagui v2 rc types
      ...(defaultConfig.tokens as any).color,
      // Semantic tokens available everywhere
      positive: '#069639',
      negative: '#e53e3e',
      navyPrimary: '#3a6cbb',
    },
  },
})

export type Conf = typeof config

declare module 'tamagui' {
  interface TamaguiCustomConfig extends Conf {}
}
