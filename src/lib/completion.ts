import { LOGROTATE_DIR } from './paths.js'
import fs from 'fs-extra'

export async function getManagedDaemonNames(): Promise<string[]> {
  if (!(await fs.pathExists(LOGROTATE_DIR))) {
    return []
  }
  const files = await fs.readdir(LOGROTATE_DIR)
  return files.filter(f => f.endsWith('.conf')).map(f => f.replace('.conf', ''))
}

export function getZshCompletionScript(): string {
  return `#compdef daemon

_daemon() {
  local line state
  local -a subcmds
  subcmds=(
    'create:Create and start a new daemon'
    'list:List all managed daemons'
    'rm:Remove a managed daemon'
    'restart:Restart a managed daemon'
    'completion:Generate shell completion scripts'
  )

  _arguments -C \\
    "1: :->cmds" \\
    "*::arg:->args"

  case $state in
    cmds)
      _describe -t commands 'daemon commands' subcmds
      ;;
    args)
      case $line[1] in
        rm|restart)
          local -a daemons
          daemons=($(daemon completion list-daemons))
          _values 'daemons' $daemons
          ;;
        create)
          _arguments \\
            '--rotation[Log rotation interval]:interval:(daily weekly hourly)' \\
            '--keep[Number of log files to keep]' \\
            '--compress[Compress rotated logs]' \\
            '--no-keep-alive[Disable KeepAlive]'
          ;;
      esac
      ;;
  esac
}

compdef _daemon daemon
`
}
