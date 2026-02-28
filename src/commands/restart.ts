import fs from 'fs-extra'
import { stopService, startService } from '../lib/launchd.js'
import { getPlistPath } from '../lib/paths.js'
import { forceLogRotation } from '../lib/logrotate.js'
import { log, spinner } from '../utils/ui.js'

export async function restartCommand(
  name: string,
  options?: { throttleInterval?: number }
) {
  const plistPath = getPlistPath(name)
  if (!(await fs.pathExists(plistPath))) {
    log.error(`Daemon '${name}' does not exist.`)
    process.exit(1)
  }

  spinner.start(`Restarting service '${name}'...`)

  // Try to stop first
  await stopService(name)

  // Update plist if throttleInterval is provided
  if (options?.throttleInterval !== undefined) {
    try {
      let plistContent = await fs.readFile(plistPath, 'utf8')
      const throttleIntervalRegex =
        /(<key>ThrottleInterval<\/key>\s*)<integer>\d+<\/integer>/

      if (throttleIntervalRegex.test(plistContent)) {
        plistContent = plistContent.replace(
          throttleIntervalRegex,
          `$1<integer>${options.throttleInterval}</integer>`
        )
      } else {
        // Fallback: inject before <key>StandardOutPath</key>
        plistContent = plistContent.replace(
          /(<key>StandardOutPath<\/key>)/,
          `<key>ThrottleInterval</key>\n    <integer>${options.throttleInterval}</integer>\n    $1`
        )
      }
      await fs.writeFile(plistPath, plistContent, 'utf8')
    } catch (error: any) {
      log.warn(`Failed to update ThrottleInterval: ${error.message}`)
    }
  }

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
