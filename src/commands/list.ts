import fs from 'fs-extra'
import { execa } from 'execa'
import { LOGROTATE_DIR, getLogPath, getWrapperPath } from '../lib/paths.js'
import { log } from '../utils/ui.js'

export async function listCommand() {
  if (!(await fs.pathExists(LOGROTATE_DIR))) {
    log.info('No managed daemons found.')
    return
  }

  const files = await fs.readdir(LOGROTATE_DIR)
  const managedNames = files
    .filter(f => f.endsWith('.conf'))
    .map(f => f.replace('.conf', ''))

  if (managedNames.length === 0) {
    log.info('No managed daemons found.')
    return
  }

  const { stdout: launchctlList } = await execa('launchctl', ['list'])

  interface ServiceInfo {
    Name: string
    Status: string
    PID: string
    'Log Size': string
    Command: string
  }

  const servicesData: ServiceInfo[] = []

  for (const name of managedNames) {
    const label = `com.daemon-cli.${name}`
    const match = launchctlList.split('\n').find(line => line.includes(label))

    let status = 'Stopped'
    let pid = '-'
    if (match) {
      const parts = match.split(/\s+/)
      pid = parts[0]
      status = pid !== '-' ? 'Running' : 'Stopped'
    }

    let logSize = '0 B'
    const logPath = getLogPath(name)
    if (await fs.pathExists(logPath)) {
      const stats = await fs.stat(logPath)
      logSize = formatBytes(stats.size)
    }

    let command = 'Unknown'
    const wrapperPath = getWrapperPath(name)
    if (await fs.pathExists(wrapperPath)) {
      const content = await fs.readFile(wrapperPath, 'utf-8')
      const lines = content.split('\n')

      // Find the last non-empty line that isn't a comment or the PATH export
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i]!.trim()
        if (line && !line.startsWith('#') && !line.startsWith('export PATH=')) {
          command = line
          break
        }
      }
    }

    servicesData.push({
      Name: name,
      Status: status,
      PID: pid,
      'Log Size': logSize,
      Command: command,
    })
  }

  const columns = [
    { key: 'Name', label: 'Name' },
    { key: 'Status', label: 'Status' },
    { key: 'PID', label: 'PID' },
    { key: 'Log Size', label: 'Log Size' },
    { key: 'Command', label: 'Command' },
  ] as const

  const widths = columns.map(col => {
    return Math.max(
      col.label.length,
      ...servicesData.map(row => String(row[col.key]).length)
    )
  })

  const header = columns.map((col, i) => col.label.padEnd(widths[i])).join('  ')
  console.log(header)
  console.log('-'.repeat(header.length))

  for (const row of servicesData) {
    const line = columns
      .map((col, i) => String(row[col.key]).padEnd(widths[i]))
      .join('  ')
    console.log(line)
  }
}

function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}
