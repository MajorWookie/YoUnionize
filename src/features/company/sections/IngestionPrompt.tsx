import { useState, useEffect, useRef, useCallback } from 'react'
import { Button, Paragraph, Spinner, YStack } from 'tamagui'
import { Card } from '~/interface/display/Card'
import { useToast } from '~/interface/feedback/ToastProvider'
import { extractErrorMessage, fetchWithRetry } from '~/lib/api-client'

interface Props {
  ticker: string
  onComplete: () => void
}

type Stage = 'idle' | 'ingesting' | 'summarizing' | 'polling' | 'done' | 'error'

export function IngestionPrompt({ ticker, onComplete }: Props) {
  const { showToast } = useToast()
  const [stage, setStage] = useState<Stage>('idle')
  const [message, setMessage] = useState('')
  const [progress, setProgress] = useState({ total: 0, done: 0 })
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const cleanup = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  useEffect(() => cleanup, [cleanup])

  const pollJob = useCallback(
    async (jobId: string, nextStage: Stage, nextAction?: () => Promise<void>) => {
      pollRef.current = setInterval(async () => {
        try {
          const res = await fetchWithRetry(`/api/jobs/${jobId}`)
          const job = await res.json()

          if (job.status === 'completed') {
            cleanup()
            if (nextAction) {
              await nextAction()
            } else {
              setStage('done')
              onComplete()
            }
          } else if (job.status === 'failed') {
            cleanup()
            setStage('error')
            const msg = job.error ?? 'Job failed'
            setMessage(msg)
            showToast(msg, 'error')
          }
        } catch {
          // Network error, keep polling
        }
      }, 3000)
    },
    [cleanup, onComplete],
  )

  const pollSummaryStatus = useCallback(() => {
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetchWithRetry(`/api/companies/${ticker}/summary-status`)
        const data = await res.json()
        setProgress({ total: data.total, done: data.summarized })

        if (data.pending === 0 && data.total > 0) {
          cleanup()
          setStage('done')
          showToast('Company data loaded successfully', 'success')
          onComplete()
        }
      } catch {
        // Keep polling
      }
    }, 5000)
  }, [ticker, cleanup, onComplete])

  const startIngestion = async () => {
    setStage('ingesting')
    setMessage('Fetching SEC filings, compensation data, and insider trades...')

    try {
      const res = await fetchWithRetry(`/api/companies/${ticker}/ingest`, { method: 'POST' })
      const data = await res.json()

      if (!res.ok) {
        const msg = extractErrorMessage(data)
        setStage('error')
        setMessage(msg)
        showToast(msg, 'error')
        return
      }

      // Poll ingestion job, then start summarization
      await pollJob(data.jobId, 'summarizing', async () => {
        setStage('summarizing')
        setMessage('Analyzing filings with AI...')

        const sumRes = await fetchWithRetry(`/api/companies/${ticker}/summarize`, { method: 'POST' })
        const sumData = await sumRes.json()

        if (!sumRes.ok) {
          const msg = extractErrorMessage(sumData)
          setStage('error')
          setMessage(msg)
          showToast(msg, 'error')
          return
        }

        setStage('polling')
        setMessage('Generating summaries...')
        pollSummaryStatus()
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error — check your connection'
      setStage('error')
      setMessage(msg)
      showToast(msg, 'error')
    }
  }

  if (stage === 'idle') {
    return (
      <Card>
        <YStack items="center" gap="$3" p="$4">
          <Paragraph fontSize={18} fontWeight="600" color="$color12">
            No data loaded yet
          </Paragraph>
          <Paragraph color="$color8" text="center">
            Load this company's SEC filings, executive compensation, and insider trading data
            to see a full analysis.
          </Paragraph>
          <Button size="$4" theme="accent" onPress={startIngestion}>
            Load Company Data
          </Button>
        </YStack>
      </Card>
    )
  }

  if (stage === 'error') {
    return (
      <Card>
        <YStack items="center" gap="$3" p="$4">
          <Paragraph fontSize={18} fontWeight="600" color="$negative">
            Something went wrong
          </Paragraph>
          <Paragraph color="$color8" text="center">
            {message}
          </Paragraph>
          <Button size="$4" theme="accent" onPress={startIngestion}>
            Try Again
          </Button>
        </YStack>
      </Card>
    )
  }

  if (stage === 'done') {
    return null
  }

  return (
    <Card>
      <YStack items="center" gap="$3" p="$4">
        <Spinner size="large" color="$color9" />
        <Paragraph fontSize={16} fontWeight="600" color="$color12">
          {stage === 'ingesting'
            ? 'Loading Data...'
            : stage === 'summarizing'
              ? 'Starting Analysis...'
              : 'Analyzing Filings...'}
        </Paragraph>
        <Paragraph color="$color8" text="center">
          {message}
        </Paragraph>
        {stage === 'polling' && progress.total > 0 && (
          <Paragraph fontWeight="600" color="$color9">
            {progress.done} of {progress.total} filings analyzed
          </Paragraph>
        )}
        <Paragraph color="$color7" fontSize={12}>
          This may take a few minutes. You can leave and come back.
        </Paragraph>
      </YStack>
    </Card>
  )
}
