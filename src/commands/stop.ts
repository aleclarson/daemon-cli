import fs from 'fs-extra'
import { stopService } from '../lib/launchd.js'
import { getPlistPath } from '../lib/paths.js'
import { log, spinner } from '../utils/ui.js'

export async function stopCommand(name: string) {
  const plistPath = getPlistPath(name)
  if (!(await fs.pathExists(plistPath))) {
    log.error(`Daemon '${name}' does not exist.`)
    process.exit(1)
  }

  spinner.start(`Stopping service '${name}'...`)

  try {
    await stopService(name)
    spinner.stop(`Service '${name}' stopped.`)
    log.success(`Daemon '${name}' has been stopped.`)
  } catch (error: any) {
    spinner.stop(`Failed to stop service '${name}'.`)
    log.error(`Error: ${error.message}`)
    process.exit(1)
  }
}
