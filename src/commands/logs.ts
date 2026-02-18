import fs from 'fs-extra'
import { getLogPath } from '../lib/paths.js'
import { log } from '../utils/ui.js'
import { execa } from 'execa'

export interface LogsOptions {
  name: string
  tail: boolean
  lines: number
}

export async function logsCommand(options: LogsOptions) {
  const logPath = getLogPath(options.name)

  if (!(await fs.pathExists(logPath))) {
    log.error(`Log file for '${options.name}' does not exist at ${logPath}`)
    process.exit(1)
  }

  const args = []
  if (options.tail) {
    args.push('-f')
  }
  args.push('-n', String(options.lines))
  args.push(logPath)

  try {
    // Inherit stdio to show output directly in the terminal
    await execa('tail', args, { stdio: 'inherit' })
  } catch (error: any) {
    if (error.signal === 'SIGINT' || error.signal === 'SIGTERM') {
      // User interrupted the tail, exit gracefully
      return
    }
    log.error(`Error reading logs: ${error.message}`)
    process.exit(1)
  }
}
