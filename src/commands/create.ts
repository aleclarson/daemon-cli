import fs from 'fs-extra'
import { execa } from 'execa'
import { log, prompt, select, spinner } from '../utils/ui.js'
import { validateCommand } from '../utils/process.js'
import { ALL_DIRS, getPlistPath, GOVERNOR_PATH } from '../lib/paths.js'
import { generateWrapper } from '../lib/wrapper.js'
import { generatePlist, startService } from '../lib/launchd.js'
import { generateLogrotateConfig, setupCron } from '../lib/logrotate.js'

export interface CreateOptions {
  name?: string
  command?: string
  rotation?: 'daily' | 'weekly' | 'hourly'
  keep?: number
  compress: boolean
  keepAlive: boolean
}

export async function createCommand(options: CreateOptions) {
  const name = options.name || (await prompt('Name of the daemon?'))
  const command = options.command || (await prompt('Shell command to run?'))

  const plistPath = getPlistPath(name)
  if (await fs.pathExists(plistPath)) {
    log.error(`Daemon '${name}' already exists.`)
    process.exit(1)
  }

  const isValid = await validateCommand(command)
  if (!isValid) {
    log.error('Command validation failed. Aborting.')
    process.exit(1)
  }

  const rotation =
    options.rotation ||
    (await select('Log rotation frequency?', [
      { label: 'daily', value: 'daily' },
      { label: 'weekly', value: 'weekly' },
      { label: 'hourly', value: 'hourly' },
    ]))

  const keepString =
    options.keep !== undefined
      ? String(options.keep)
      : await prompt('Keep how many logs?', '7')
  const keep = parseInt(keepString, 10) || 7

  spinner.start('Preparing environment...')
  for (const dir of ALL_DIRS) {
    await fs.ensureDir(dir)
  }
  spinner.stop('Environment prepared.')

  spinner.start('Generating files...')
  const wrapperPath = await generateWrapper(name, command)
  spinner.stop('Wrapper generated.')

  log.info(`Registering daemon with sudo for security (hashing)...`)
  try {
    await execa('sudo', [GOVERNOR_PATH, 'register', name, wrapperPath], {
      stdio: 'inherit',
    })
  } catch (err: any) {
    log.error(`Registration failed: ${err.message}`)
    process.exit(1)
  }

  spinner.start('Generating remaining files...')
  const finalPlistPath = await generatePlist(name, {
    keepAlive: options.keepAlive,
  })
  const configPath = await generateLogrotateConfig(name, {
    rotation: rotation as 'daily' | 'weekly' | 'hourly',
    keep: keep,
    compress: options.compress,
  })
  spinner.stop('Files generated.')

  log.info(`Created wrapper at ${wrapperPath}`)
  log.info(`Generated Plist at ${finalPlistPath}`)
  log.info(`Configured logrotate for ${configPath}`)

  spinner.start('Starting service via launchctl...')
  await startService(name)
  await setupCron()
  spinner.stop(`Service '${name}' started.`)

  log.success(`Daemon '${name}' is running.`)
}
