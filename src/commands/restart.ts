import fs from 'fs-extra'
import { execa } from 'execa'
import { stopService, startService } from '../lib/launchd.js'
import { getPlistPath, getLogPath } from '../lib/paths.js'
import { forceLogRotation } from '../lib/logrotate.js'
import { log, spinner } from '../utils/ui.js'
import { logsCommand } from './logs.js'

export async function restartCommand(
  name: string,
  options?: { throttleInterval?: number; follow?: boolean }
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
      const plistContent = await fs.readFile(plistPath, 'utf8')
      if (/<key>KeepAlive<\/key>\s*<true\/>/.test(plistContent)) {
        await execa('plutil', [
          '-replace',
          'ThrottleInterval',
          '-integer',
          String(options.throttleInterval),
          plistPath,
        ])
      } else {
        log.warn(
          'ThrottleInterval only applies when KeepAlive is enabled. Ignoring.'
        )
      }
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
    await fs.ensureFile(getLogPath(name))
    spinner.stop(`Service '${name}' restarted.`)
    log.success(`Daemon '${name}' has been restarted.`)

    if (options?.follow) {
      await logsCommand({ name, tail: true, lines: 100 })
    }
  } catch (error: any) {
    spinner.stop(`Failed to start service '${name}'.`)
    log.error(`Error: ${error.message}`)
    process.exit(1)
  }
}
