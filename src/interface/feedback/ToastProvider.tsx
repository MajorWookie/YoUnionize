import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { AnimatePresence, Paragraph, XStack, YStack } from 'tamagui'

// ── Types ─────────────────────────────────────────────────────────────

type ToastType = 'success' | 'error' | 'info'

interface Toast {
  id: string
  message: string
  type: ToastType
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void
}

// ── Context ─────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue>({
  showToast: () => {},
})

export function useToast() {
  return useContext(ToastContext)
}

// ── Provider ────────────────────────────────────────────────────────────

let nextId = 0

const TOAST_COLORS: Record<ToastType, { bg: string; text: string }> = {
  success: { bg: '#069639', text: '#ffffff' },
  error: { bg: '#e53e3e', text: '#ffffff' },
  info: { bg: '#3a6cbb', text: '#ffffff' },
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Array<Toast>>([])

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = String(++nextId)
    setToasts((prev) => [...prev, { id, message, type }])

    // Auto-dismiss after 4 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 4000)
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* Toast container — positioned at bottom center */}
      <YStack
        position="absolute"
        bottom={80}
        left={0}
        right={0}
        alignItems="center"
        gap="$2"
        pointerEvents="none"
        zIndex={100_000}
      >
        {toasts.map((toast) => {
          const colors = TOAST_COLORS[toast.type]
          return (
            <XStack
              key={toast.id}
              backgroundColor={colors.bg}
              paddingHorizontal="$4"
              paddingVertical="$2.5"
              borderRadius="$3"
              maxWidth={400}
              animation="quick"
              enterStyle={{ opacity: 0, y: 20 }}
              exitStyle={{ opacity: 0, y: 20 }}
              opacity={1}
              y={0}
              elevation={4}
            >
              <Paragraph color={colors.text} fontSize={14} fontWeight="500">
                {toast.message}
              </Paragraph>
            </XStack>
          )
        })}
      </YStack>
    </ToastContext.Provider>
  )
}
