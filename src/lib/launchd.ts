import fs from 'fs-extra'
import {
  getPlistPath,
  getWrapperPath,
  getLogPath,
  SYSTEM_GOVERNOR_PATH,
} from './paths.js'
import { execa } from 'execa'

export interface LaunchdOptions {
  keepAlive: boolean
  throttleInterval?: number
}

export async function generatePlist(name: string, options: LaunchdOptions) {
  const logPath = getLogPath(name)
  const throttleInterval = options.throttleInterval ?? 10
  const throttleXml = options.keepAlive
    ? `\n    <key>ThrottleInterval</key>\n    <integer>${throttleInterval}</integer>`
    : ''
  const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.daemon-cli.${name}</string>
    <key>ProgramArguments</key>
    <array>
        <string>${SYSTEM_GOVERNOR_PATH}</string>
        <string>run</string>
        <string>${name}</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <${options.keepAlive ? 'true' : 'false'}/>${throttleXml}
    <key>StandardOutPath</key>
    <string>${logPath}</string>
    <key>StandardErrorPath</key>
    <string>${logPath}</string>
</dict>
</plist>
`

  const plistPath = getPlistPath(name)
  await fs.outputFile(plistPath, plistContent)
  return plistPath
}

export async function startService(name: string) {
  const plistPath = getPlistPath(name)

  if (!(await fs.pathExists(plistPath))) {
    throw new Error(`Daemon '${name}' does not exist (missing plist).`)
  }

  try {
    await execa('plutil', ['-replace', 'RunAtLoad', '-bool', 'true', plistPath])
  } catch (err: any) {
    // Fallback or ignore if plutil fails
  }

  const uid = process.getuid?.() || 0
  await execa('launchctl', ['bootstrap', `gui/${uid}`, plistPath])
}

export async function stopService(name: string) {
  const plistPath = getPlistPath(name)

  if (!(await fs.pathExists(plistPath))) {
    throw new Error(`Daemon '${name}' does not exist (missing plist).`)
  }

  try {
    await execa('plutil', [
      '-replace',
      'RunAtLoad',
      '-bool',
      'false',
      plistPath,
    ])
  } catch (err: any) {
    // Fallback or ignore if plutil fails
  }

  const uid = process.getuid?.() || 0
  try {
    await execa('launchctl', ['bootout', `gui/${uid}`, plistPath])
  } catch (error) {
    // Ignore error if service is not running
  }
}
