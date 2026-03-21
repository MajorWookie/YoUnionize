import { Component, type ReactNode } from 'react'
import { Button, Paragraph, YStack } from 'tamagui'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.info('[ErrorBoundary] Caught error:', error.message, info.componentStack)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <YStack flex={1} items="center" justify="center" gap="$3" p="$6">
          <Paragraph fontSize={40}>!</Paragraph>
          <Paragraph fontSize={18} fontWeight="600" color="$color12">
            Something went wrong
          </Paragraph>
          <Paragraph color="$color8" text="center" maxW={320}>
            {this.state.error?.message ?? 'An unexpected error occurred'}
          </Paragraph>
          <Button size="$3" theme="accent" onPress={this.handleReset} mt="$2">
            Try Again
          </Button>
        </YStack>
      )
    }

    return this.props.children
  }
}
