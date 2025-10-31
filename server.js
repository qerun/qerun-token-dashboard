// Simple production server for the dashboard (Vite build)
import express from 'express'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const port = process.env.PORT || 8080

const distDir = path.join(__dirname, 'dist')
app.use(express.static(distDir))

// Minimal runtime config that can be injected into index.html
function getRuntimeConfig() {
  // Only expose needed variables to the client
  const cfg = {
    STATE_MANAGER_ADDRESS: process.env.STATE_MANAGER_ADDRESS,
    CHAIN_ID: process.env.CHAIN_ID,
  }
  // Remove undefined to keep the payload clean
  return Object.fromEntries(
    Object.entries(cfg).filter(([_, v]) => v !== undefined && v !== null)
  )
}

// SPA fallback with runtime config injection
app.get('*', (_req, res) => {
  const indexPath = path.join(distDir, 'index.html')
  let html = fs.readFileSync(indexPath, 'utf-8')

  const runtimeConfig = getRuntimeConfig()
  const injection = `<script>window.__RUNTIME_CONFIG=${JSON.stringify(runtimeConfig)}</script>`

  // Inject just before closing head if present, else prepend
  if (html.includes('</head>')) {
    html = html.replace('</head>', `${injection}</head>`)
  } else {
    html = injection + html
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.send(html)
})

app.listen(port, () => {
  console.log(`Dashboard listening on ${port}`)
})
