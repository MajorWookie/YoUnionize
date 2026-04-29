import { useTheme } from 'tamagui'
import Markdown from 'react-native-markdown-display'
import type { StyleSheet } from 'react-native'

interface Props {
  children: string
}

export function MarkdownContent({ children }: Props) {
  const theme = useTheme()

  const markdownStyles: StyleSheet.NamedStyles<Record<string, unknown>> = {
    body: {
      color: theme.color11?.val ?? '#ccc',
      fontSize: 14,
      lineHeight: 22,
    },
    heading1: {
      color: theme.color12?.val ?? '#fff',
      fontSize: 18,
      fontWeight: '700',
      marginBottom: 8,
      marginTop: 12,
    },
    heading2: {
      color: theme.color12?.val ?? '#fff',
      fontSize: 16,
      fontWeight: '700',
      marginBottom: 6,
      marginTop: 10,
    },
    heading3: {
      color: theme.color12?.val ?? '#fff',
      fontSize: 15,
      fontWeight: '600',
      marginBottom: 4,
      marginTop: 8,
    },
    paragraph: {
      marginBottom: 8,
      marginTop: 0,
    },
    bullet_list: {
      marginBottom: 8,
    },
    ordered_list: {
      marginBottom: 8,
    },
    list_item: {
      marginBottom: 4,
    },
    strong: {
      fontWeight: '700',
      color: theme.color12?.val ?? '#fff',
    },
    em: {
      fontStyle: 'italic',
    },
    bullet_list_icon: {
      color: theme.color8?.val ?? '#888',
      marginRight: 8,
      fontSize: 14,
      lineHeight: 22,
    },
    ordered_list_icon: {
      color: theme.color8?.val ?? '#888',
      marginRight: 8,
      fontSize: 14,
      lineHeight: 22,
    },
  }

  return (
    <Markdown style={markdownStyles}>
      {children}
    </Markdown>
  )
}
