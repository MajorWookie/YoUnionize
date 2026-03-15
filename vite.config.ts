import { tamaguiPlugin } from '@tamagui/vite-plugin'
import { one } from 'one/vite'
import type { UserConfig } from 'vite'

export default {
  plugins: [
    tamaguiPlugin(),

    one({
      web: {
        defaultRenderMode: 'spa',
      },
    }),
  ],
} satisfies UserConfig
