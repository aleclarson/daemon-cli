import { spawn } from 'child_process'
import { getWrapperPath, GOVERNOR_PATH } from '../lib/paths.js'
import { restartCommand } from './restart.js'
import fs from 'fs-extra'
import { log } from '../utils/ui.js'
import { execa } from 'execa'
import crypto from 'crypto'

export interface EditDeps {
  checkExists: (path: string) => Promise<boolean>
  spawnEditor: (path: string) => Promise<void>
  updateHash: (name: string, path: string) => Promise<void>
  restartDaemon: (name: string) => Promise<void>
  calculateHash: (path: string) => Promise<string>
}

export const defaultDeps: EditDeps = {
  checkExists: path => fs.pathExists(path),
  spawnEditor: path =>
    new Promise((resolve, reject) => {
      const editor = process.env.EDITOR || process.env.VISUAL || 'vi'
      // Use shell: true to handle EDITOR with arguments (e.g. "code --wait")
      // We use JSON.stringify to properly quote and escape the path
      const command = `${editor} ${JSON.stringify(path)}`
      const child = spawn(command, {
        stdio: 'inherit',
        shell: true,
      })
      child.on('error', reject)
      child.on('exit', code => {
        if (code === 0) resolve()
        else reject(new Error(`Editor exited with code ${code}`))
      })
    }),
  updateHash: async (name, path) => {
    // sudo might prompt for password, so we inherit stdio
    await execa('sudo', [GOVERNOR_PATH, 'register', name, path], {
      stdio: 'inherit',
    })
  },
  restartDaemon: async name => {
    await restartCommand(name)
  },
  calculateHash: async path => {
    const content = await fs.readFile(path)
    return crypto.createHash('sha256').update(content).digest('hex')
  },
}

export async function editCommand(name: string, deps: EditDeps = defaultDeps) {
  const wrapperPath = getWrapperPath(name)

  if (!(await deps.checkExists(wrapperPath))) {
    log.error(`Daemon '${name}' does not exist.`)
    process.exit(1)
  }

  let initialHash: string
  try {
    initialHash = await deps.calculateHash(wrapperPath)
  } catch (err: any) {
    log.error(`Failed to read daemon wrapper: ${err.message}`)
    process.exit(1)
  }

  try {
    await deps.spawnEditor(wrapperPath)
  } catch (err: any) {
    log.error(`Failed to edit: ${err.message}`)
    process.exit(1)
  }

  let finalHash: string
  try {
    finalHash = await deps.calculateHash(wrapperPath)
  } catch (err: any) {
    log.error(`Failed to read daemon wrapper after edit: ${err.message}`)
    process.exit(1)
  }

  if (initialHash === finalHash) {
    log.info('No changes detected. Exiting.')
    return
  }

  // Log info instead of spinner because sudo might prompt for password
  log.info(`Updating hash for '${name}'...`)
  try {
    await deps.updateHash(name, wrapperPath)
    log.success(`Hash updated for '${name}'.`)
  } catch (err: any) {
    log.error(`Failed to update hash for '${name}': ${err.message}`)
    process.exit(1)
  }

  await deps.restartDaemon(name)
}
