import { execa } from 'execa'
import { spinner, log } from './ui.js'

export async function validateCommand(command: string): Promise<boolean> {
  spinner.start('Validating command...')
  const subprocess = execa('bash', ['-c', command])

  let finished = false

  return new Promise(resolve => {
    const timer = setTimeout(() => {
      if (finished) return
      finished = true
      subprocess.kill('SIGKILL')
      subprocess.unref()
      spinner.stop('Command started successfully.')
      resolve(true)
    }, 500)

    subprocess.on('exit', code => {
      if (finished) return
      finished = true
      clearTimeout(timer)

      if (code === 0) {
        spinner.stop(
          'Command exited immediately, but code was 0. Proceeding...'
        )
        resolve(true)
      } else {
        spinner.stop(`Command exited immediately with code ${code}.`)
        // The error message from stderr will be printed by the caller if we fail
        // Wait, the spec says "throw error with stderr"
        resolve(false)
      }
    })

    subprocess.catch(error => {
      if (finished) return
      finished = true
      clearTimeout(timer)
      spinner.stop('Command validation failed.')
      log.error(`Error: ${error.stderr || error.message}`)
      resolve(false)
    })
  })
}

export async function runCommand(command: string, args: string[]) {
  return execa(command, args)
}

export async function which(binary: string): Promise<string | null> {
  try {
    const { stdout } = await execa('which', [binary])
    return stdout.trim()
  } catch {
    return null
  }
}
