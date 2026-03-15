import { styled, YStack } from 'tamagui'

export const Card = styled(YStack, {
  background: '$color2',
  borderRadius: '$4',
  padding: '$4',
  borderWidth: 1,
  borderColor: '$borderColor',

  variants: {
    pressable: {
      true: {
        cursor: 'pointer',
        hoverStyle: {
          backgroundColor: '$backgroundHover',
          borderColor: '$borderColorHover',
        },
        pressStyle: {
          backgroundColor: '$backgroundPress',
          scale: 0.98,
        },
      },
    },
  } as const,
})
