import fs from 'fs-extra'
import { getWrapperPath } from './paths.js'

export async function generateWrapper(name: string, command: string) {
  const userShell = process.env.SHELL || '/bin/zsh'
  const currentPath =
    process.env.PATH || '/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin'

  const wrapperContent = `#!${userShell}
# ------------------------------------------------------------------------------
# WHY WE INJECT THE PATH:
# launchd (the macOS service manager) executes background processes in a very
# minimal environment. It does NOT automatically load your shell's PATH or 
# environment variables (like those set by nvm, pyenv, asdf, etc.).
#
# By injecting the PATH at the time of daemon creation, we ensure that the
# command below runs with the same executable discovery as your current session.
# ------------------------------------------------------------------------------
export PATH="${currentPath}"

# Execute the user-provided command
${command}
`

  const wrapperPath = getWrapperPath(name)
  await fs.outputFile(wrapperPath, wrapperContent)
  await fs.chmod(wrapperPath, '755')
  return wrapperPath
}
