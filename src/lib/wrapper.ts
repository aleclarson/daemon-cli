import fs from 'fs-extra'
import { getWrapperPath } from './paths.js'

export async function generateWrapper(name: string, command: string) {
  const userShell = process.env.SHELL || '/bin/zsh'
  let sourcing = ''

  if (userShell.includes('zsh')) {
    sourcing = `[[ -f ~/.zprofile ]] && source ~/.zprofile\n[[ -f ~/.zshrc ]] && source ~/.zshrc`
  } else if (userShell.includes('bash')) {
    sourcing = `[[ -f ~/.bash_profile ]] && source ~/.bash_profile\n[[ -f ~/.bashrc ]] && source ~/.bashrc`
  } else if (userShell.includes('fish')) {
    sourcing = `if test -f ~/.config/fish/config.fish\n  source ~/.config/fish/config.fish\nend`
  } else {
    sourcing = `[ -f ~/.profile ] && . ~/.profile`
  }

  const wrapperContent = `#!${userShell}
# ------------------------------------------------------------------------------
# WHY WE SOURCE USER PROFILES:
# launchd (the macOS service manager) executes background processes in a very
# minimal environment. It does NOT automatically load your shell's PATH or 
# environment variables (like those set by nvm, pyenv, asdf, etc.).
#
# By sourcing your shell's profile/rc files here, we ensure that the command 
# below runs with the same environment and PATH as your interactive terminal.
# ------------------------------------------------------------------------------
${sourcing}

# Execute the user-provided command
${command}
`

  const wrapperPath = getWrapperPath(name)
  await fs.outputFile(wrapperPath, wrapperContent)
  await fs.chmod(wrapperPath, '755')
  return wrapperPath
}
