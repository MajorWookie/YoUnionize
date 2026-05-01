// MUST be first import — bridges Vite env to process.env for shared packages.
import './lib/env-shim'

import '@fontsource-variable/inter'
import '@fontsource-variable/source-serif-4'

import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'
import '@mantine/charts/styles.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('#root not found in index.html')

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
