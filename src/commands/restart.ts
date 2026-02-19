import fs from 'fs-extra'
import { stopService, startService } from '../lib/launchd.js'
import { getPlistPath } from '../lib/paths.js'
import { forceLogRotation } from '../lib/logrotate.js'
import { log, spinner } from '../utils/ui.js'

export async function restartCommand(name: string) {
  const plistPath = getPlistPath(name)
  if (!(await fs.pathExists(plistPath))) {
    log.error(`Daemon '${name}' does not exist.`)
    process.exit(1)
  }

  spinner.start(`Restarting service '${name}'...`)

  // Try to stop first
  await stopService(name)

  // Force log rotation
  try {
    spinner.message(`Rotating logs for '${name}'...`)
    await forceLogRotation(name)
  } catch (error: any) {
    log.warn(`Failed to rotate logs: ${error.message}`)
  }

  // Then start again
  try {
    await startService(name)
    spinner.stop(`Service '${name}' restarted.`)
    log.success(`Daemon '${name}' has been restarted.`)
  } catch (error: any) {
    spinner.stop(`Failed to start service '${name}'.`)
    log.error(`Error: ${error.message}`)
    process.exit(1)
  }
}
