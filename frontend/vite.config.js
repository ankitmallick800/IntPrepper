import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const certDir = path.join(rootDir, 'certs')
const certFile = path.join(certDir, 'dev-cert.pem')
const keyFile = path.join(certDir, 'dev-key.pem')
const hostsFile = path.join(certDir, 'hosts.txt')

function lanAddresses() {
  const addresses = ['127.0.0.1']
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries || []) {
      if (entry.family === 'IPv4' && !entry.internal) addresses.push(entry.address)
    }
  }
  return [...new Set(addresses)]
}

function ensureDevCertificate() {
  fs.mkdirSync(certDir, { recursive: true })
  const hosts = lanAddresses().join(',')
  const current = fs.existsSync(hostsFile) ? fs.readFileSync(hostsFile, 'utf8') : ''
  if (fs.existsSync(certFile) && fs.existsSync(keyFile) && current === hosts) return

  const subjectAltName = ['DNS:localhost', ...lanAddresses().map((ip) => `IP:${ip}`)].join(',')
  execFileSync('openssl', [
    'req', '-x509', '-newkey', 'rsa:2048', '-sha256', '-days', '825', '-nodes',
    '-keyout', keyFile,
    '-out', certFile,
    '-subj', '/CN=localhost',
    '-addext', `subjectAltName=${subjectAltName}`,
  ], { stdio: 'ignore' })
  fs.writeFileSync(hostsFile, hosts)
}

export default defineConfig(({ command }) => {
  const config = {
    base: process.env.VITE_BASE || '/',
    plugins: [react()],
  }
  if (command !== 'serve') return config

  ensureDevCertificate()
  config.server = {
    host: true,
    port: 5173,
    strictPort: true,
    https: {
      cert: fs.readFileSync(certFile),
      key: fs.readFileSync(keyFile),
    },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        secure: false,
      },
    },
  }
  return config
})
