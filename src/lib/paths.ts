import os from 'os'
import path from 'path'
import untildify from 'untildify'

const home = os.homedir()

export const WRAPPERS_DIR = untildify('~/.local/share/daemon-cli/wrappers/')
export const CONFIGS_DIR = untildify('~/.config/daemon-cli/')
export const LOGROTATE_DIR = untildify('~/.config/daemon-cli/logrotate.d/')
export const LOGS_DIR = untildify('~/Library/Logs/Homebrew/')
export const PLIST_DIR = untildify('~/Library/LaunchAgents/')
export const STATE_FILE = untildify(
  '~/.local/state/daemon-cli/logrotate.status'
)

export const getWrapperPath = (name: string) =>
  path.join(WRAPPERS_DIR, `${name}.sh`)
export const getConfigPath = (name: string) =>
  path.join(LOGROTATE_DIR, `${name}.conf`)
export const getPlistPath = (name: string) =>
  path.join(PLIST_DIR, `homebrew.mxcl.${name}.plist`)
export const getLogPath = (name: string) => path.join(LOGS_DIR, `${name}.log`)

export const ALL_DIRS = [
  WRAPPERS_DIR,
  CONFIGS_DIR,
  LOGROTATE_DIR,
  LOGS_DIR,
  PLIST_DIR,
  path.dirname(STATE_FILE),
]
