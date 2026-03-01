import React, { useState, useEffect } from 'react'
import { render, Box, Text, useInput, useApp } from 'ink'
import fs from 'fs-extra'
import { execa } from 'execa'
import { LOGROTATE_DIR, getLogPath, getWrapperPath } from '../lib/paths.js'
import { stopCommand } from './stop.js'
import { restartCommand } from './restart.js'
import { removeCommand } from './remove.js'
import { editCommand } from './edit.js'
import { logsCommand } from './logs.js'
import { confirm } from '../utils/ui.js' // We can't use @clack/prompts in ink. We'll implement a custom confirm state.

interface DaemonData {
  Name: string
  Status: string
  PID: string
  LogSize: string
  Command: string
}

function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

async function getDaemons(): Promise<DaemonData[]> {
  if (!(await fs.pathExists(LOGROTATE_DIR))) {
    return []
  }

  const files = await fs.readdir(LOGROTATE_DIR)
  const managedNames = files
    .filter(f => f.endsWith('.conf'))
    .map(f => f.replace('.conf', ''))

  if (managedNames.length === 0) {
    return []
  }

  let launchctlList = ''
  try {
    const { stdout } = await execa('launchctl', ['list'])
    launchctlList = stdout
  } catch (err) {
    // Ignore error on non-macOS platforms
  }

  const servicesData: DaemonData[] = []

  for (const name of managedNames) {
    const label = `com.daemon-cli.${name}`
    const match = launchctlList.split('\n').find(line => line.includes(label))

    let status = 'Stopped'
    let pid = '-'
    if (match) {
      const parts = match.split(/\s+/)
      pid = parts[0]
      status = pid !== '-' ? 'Running' : 'Stopped'
    }

    let logSize = '0 B'
    const logPath = getLogPath(name)
    if (await fs.pathExists(logPath)) {
      const stats = await fs.stat(logPath)
      logSize = formatBytes(stats.size)
    }

    let command = 'Unknown'
    const wrapperPath = getWrapperPath(name)
    if (await fs.pathExists(wrapperPath)) {
      const content = await fs.readFile(wrapperPath, 'utf-8')
      const lines = content.split('\n')
      const execLine = lines.find(l => l.startsWith('exec '))
      if (execLine) {
        command = execLine.replace('exec ', '')
      }
    }

    servicesData.push({
      Name: name,
      Status: status,
      PID: pid,
      LogSize: logSize,
      Command: command,
    })
  }

  return servicesData
}

let requestExternalCommand: (
  type: 'logs' | 'edit',
  name: string
) => void = () => {}

function App() {
  const { exit } = useApp()
  const [daemons, setDaemons] = useState<DaemonData[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [actionStatus, setActionStatus] = useState('')
  const [isBusy, setIsBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const fetchDaemons = async () => {
    const data = await getDaemons()
    setDaemons(data)
  }

  useEffect(() => {
    fetchDaemons()
  }, [])

  useInput(async (input, key) => {
    if (isBusy) return

    if (confirmDelete !== null) {
      if (input.toLowerCase() === 'y') {
        const target = confirmDelete
        setConfirmDelete(null)
        setIsBusy(true)
        setActionStatus(`Removing ${target}...`)
        try {
          await removeCommand(target)
          setActionStatus(`Removed ${target}`)
          setSelectedIndex(0)
        } catch (err: any) {
          setActionStatus(`Error removing ${target}: ${err.message}`)
        }
        await fetchDaemons()
        setIsBusy(false)
      } else if (input.toLowerCase() === 'n' || input === 'q' || key.escape) {
        setConfirmDelete(null)
      }
      return
    }

    if (input === 'q' || key.escape) {
      exit()
      return
    }

    if (daemons.length === 0) return

    if (key.upArrow || input === 'k') {
      setSelectedIndex(prev => Math.max(0, prev - 1))
    }

    if (key.downArrow || input === 'j') {
      setSelectedIndex(prev => Math.min(daemons.length - 1, prev + 1))
    }

    const selectedDaemon = daemons[selectedIndex]

    if (input === 's') {
      setIsBusy(true)
      setActionStatus(`Stopping ${selectedDaemon.Name}...`)
      try {
        await stopCommand(selectedDaemon.Name)
        setActionStatus(`Stopped ${selectedDaemon.Name}`)
      } catch (err: any) {
        setActionStatus(`Error stopping ${selectedDaemon.Name}: ${err.message}`)
      }
      await fetchDaemons()
      setIsBusy(false)
    }

    if (input === 'r') {
      setIsBusy(true)
      setActionStatus(`Restarting ${selectedDaemon.Name}...`)
      try {
        await restartCommand(selectedDaemon.Name)
        setActionStatus(`Restarted ${selectedDaemon.Name}`)
      } catch (err: any) {
        setActionStatus(
          `Error restarting ${selectedDaemon.Name}: ${err.message}`
        )
      }
      await fetchDaemons()
      setIsBusy(false)
    }

    if (input === 'x') {
      setConfirmDelete(selectedDaemon.Name)
    }

    if (input === 'l') {
      requestExternalCommand('logs', selectedDaemon.Name)
      exit()
      return
    }

    if (input === 'e') {
      requestExternalCommand('edit', selectedDaemon.Name)
      exit()
      return
    }
  })

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold underline>
        Daemon CLI TUI
      </Text>

      <Box flexDirection="column" marginTop={1} marginBottom={1}>
        <Text color="gray">
          Shortcuts: [q] Quit | [k/↑] Up | [j/↓] Down | [s] Stop | [r] Restart |
          [x] Remove | [l] Logs | [e] Edit
        </Text>
      </Box>

      {actionStatus && (
        <Box marginBottom={1}>
          <Text color="yellow">{actionStatus}</Text>
        </Box>
      )}

      {confirmDelete && (
        <Box marginBottom={1} borderStyle="round" borderColor="red" padding={1}>
          <Text>Are you sure you want to remove {confirmDelete}? (y/N)</Text>
        </Box>
      )}

      <Box flexDirection="column">
        {daemons.length === 0 ? (
          <Text>No managed daemons found.</Text>
        ) : (
          daemons.map((daemon, index) => {
            const isSelected = index === selectedIndex
            return (
              <Box key={daemon.Name}>
                <Box width={2}>
                  <Text color={isSelected ? 'green' : undefined}>
                    {isSelected ? '> ' : '  '}
                  </Text>
                </Box>
                <Box width={20}>
                  <Text color={isSelected ? 'green' : undefined}>
                    {daemon.Name}
                  </Text>
                </Box>
                <Box width={10}>
                  <Text color={daemon.Status === 'Running' ? 'blue' : 'gray'}>
                    {daemon.Status}
                  </Text>
                </Box>
                <Box width={10}>
                  <Text>{daemon.PID}</Text>
                </Box>
                <Box width={15}>
                  <Text>{daemon.LogSize}</Text>
                </Box>
                <Box>
                  <Text color="gray">{daemon.Command}</Text>
                </Box>
              </Box>
            )
          })
        )}
      </Box>
    </Box>
  )
}

export async function tuiCommand() {
  if (!process.stdin.isTTY) {
    console.error('Interactive TUI requires a TTY environment.')
    process.exit(1)
  }

  let loop = true
  while (loop) {
    let externalTask: { type: 'logs' | 'edit'; name: string } | null = null
    requestExternalCommand = (type, name) => {
      externalTask = { type, name }
    }

    const { waitUntilExit, unmount } = render(<App />)
    await waitUntilExit()

    if (externalTask) {
      const task = externalTask as { type: 'logs' | 'edit'; name: string }
      if (task.type === 'logs') {
        try {
          process.stdout.write('\x1Bc')
          console.log(
            `\n--- Viewing logs for ${task.name} (Press Ctrl+C to exit) ---\n`
          )
          await logsCommand({ name: task.name, tail: true, lines: 100 })
        } catch (err: any) {
          // tail may exit with code on SIGINT, that's fine
        }
      } else if (task.type === 'edit') {
        try {
          process.stdout.write('\x1Bc')
          await editCommand(task.name)
        } catch (err: any) {
          console.error(`Error editing ${task.name}: ${err.message}`)
        }
      }

      console.log('\nPress any key to return to TUI...')
      await new Promise<void>(resolve => {
        process.stdin.setRawMode(true)
        process.stdin.resume()
        process.stdin.once('data', () => {
          process.stdin.setRawMode(false)
          process.stdin.pause()
          resolve()
        })
      })
    } else {
      loop = false
    }
  }
}
