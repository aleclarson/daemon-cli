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
  const servicesData = []

  for (const name of managedNames) {
    const label = `homebrew.mxcl.${name}`
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
      const execLine = lines.find(l => l.startsWith('exec '))
      if (execLine) {
        command = execLine.replace('exec ', '')
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

  console.table(servicesData)
}

function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}
