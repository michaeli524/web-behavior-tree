import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs/promises'
import path from 'node:path'
import type { IncomingMessage } from 'node:http'

const defaultTreeFile = process.env.BT_TREE_FILE ?? '/Users/miko/Desktop/电龙AI.json'

function localTreeFilePlugin(): Plugin {
  return {
    name: 'local-tree-file',
    configureServer(server) {
      server.middlewares.use('/api/local-tree', async (req, res) => {
        res.setHeader('Content-Type', 'application/json; charset=utf-8')

        if (req.method === 'GET') {
          try {
            const json = await fs.readFile(defaultTreeFile, 'utf-8')
            res.statusCode = 200
            res.end(JSON.stringify({
              ok: true,
              fileName: path.basename(defaultTreeFile),
              path: defaultTreeFile,
              json,
            }))
          } catch (error) {
            res.statusCode = 500
            res.end(JSON.stringify({
              ok: false,
              error: error instanceof Error ? error.message : String(error),
            }))
          }
          return
        }

        if (req.method === 'PUT') {
          try {
            const body = await readRequestBody(req)
            const payload = JSON.parse(body)
            if (typeof payload.json !== 'string') {
              res.statusCode = 400
              res.end(JSON.stringify({ ok: false, error: 'Expected json string in request body.' }))
              return
            }

            JSON.parse(payload.json)
            await fs.mkdir(path.dirname(defaultTreeFile), { recursive: true })
            await fs.writeFile(defaultTreeFile, payload.json, 'utf-8')
            res.statusCode = 200
            res.end(JSON.stringify({
              ok: true,
              fileName: path.basename(defaultTreeFile),
              path: defaultTreeFile,
            }))
          } catch (error) {
            res.statusCode = 500
            res.end(JSON.stringify({
              ok: false,
              error: error instanceof Error ? error.message : String(error),
            }))
          }
          return
        }

        res.statusCode = 405
        res.end(JSON.stringify({ ok: false, error: 'Method not allowed.' }))
      })
    },
  }
}

function readRequestBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = ''
    req.setEncoding('utf-8')
    req.on('data', (chunk) => {
      body += chunk
    })
    req.on('end', () => resolve(body))
    req.on('error', reject)
  })
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), localTreeFilePlugin()],
})
