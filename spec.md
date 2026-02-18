# CLI Daemon Manager Specification (`daemon-cli`)

## 1. Project Overview

`daemon-cli` is a macOS-exclusive TypeScript tool to turn arbitrary shell commands into background services managed by `launchd` (compatible with `brew services`) with automatic log rotation.

**Core Philosophy:**

- **Arbitrary Commands:** Supports flags, pipes, and loops by encapsulating them in a wrapper script.
- **Persistence:** All configurations and wrappers are stored in persistent user directories.
- **Brew Compatibility:** Uses `homebrew.mxcl` naming conventions so services appear in `brew services list`.

## 2. Technical Stack & Dependencies

**Target Runtime:** Node.js (Current LTS)

`package.json`

```json
{
  "bin": { "daemon": "./dist/cli.js" },
  "type": "module",
  "dependencies": {
    "cmd-ts": "^0.13.0",
    "execa": "^8.0.0",
    "@clack/prompts": "^0.7.0",
    "zod": "^3.23.0",
    "fs-extra": "^11.2.0",
    "untildify": "^4.0.0"
  },
  "devDependencies": {
    "tsx": "^4.7.0",
    "@types/node": "^20.0.0",
    "@types/fs-extra": "^11.0.0",
    "typescript": "^5.3.0"
  }
}
```

_Note: `cmd-ts` version adjusted to a stable equivalent if v3 is not available, standardizing on latest stable._

## 3. Storage & Paths

To ensure persistence and isolation, the tool uses the following paths (resolved via `os.homedir()`):

| Resource      | Path                                         | Purpose                                    |
| :------------ | :------------------------------------------- | :----------------------------------------- |
| **Wrappers**  | `~/.local/share/daemon-cli/wrappers/`        | Shell scripts containing the user command. |
| **Configs**   | `~/.config/daemon-cli/`                      | Application metadata.                      |
| **Logrotate** | `~/.config/daemon-cli/logrotate.d/`          | Log rotation configuration files.          |
| **Logs**      | `~/Library/Logs/Homebrew/`                   | Log output (Standard Brew location).       |
| **Plist**     | `~/Library/LaunchAgents/`                    | System launch agents (OS managed).         |
| **State**     | `~/.local/state/daemon-cli/logrotate.status` | State file for logrotate execution.        |

## 4. CLI Command Structure

Implemented using `cmd-ts`.

### Root Command

- **Name**: `daemon`
- **Description**: macOS daemon manager with log rotation.

### Sub-commands

#### A. `create <name> [command]`

Creates and starts a new daemon.

**Arguments:**

- `name` (Positional, string): Unique identifier for the daemon.
- `command` (Positional, string, Optional): The shell command to run. If omitted, prompt user.

**Options:**

- `--rotation <interval>`: Enum `['daily', 'weekly', 'hourly']`. Default: `daily`.
- `--keep <count>`: Number of log files to keep. Default: `7`.
- `--compress`: Boolean. Default: `true`.
- `--no-keep-alive`: Boolean. Default: `false` (Logic: defaults to `true` in code).

#### B. `list`

Lists all services managed by this tool.

#### C. `rm <name>`

Stops the service and removes all associated files (plist, wrapper, logs).

---

## 5. Detailed Implementation Flows

### 5.1. Command: `create`

**Handler Logic:**

1.  **Input Resolution**:
    - If `name` or `command` are missing, use `@clack/prompts` to request them.
    - Check if `homebrew.mxcl.<name>.plist` already exists in `~/Library/LaunchAgents/`. If yes, error out ("Daemon already exists").

2.  **Command Validation (The "Test Run")**:
    - **Goal**: Ensure the command doesn't crash immediately.
    - **Action**: Spawn `execa('bash', ['-c', command])`.
    - **Timer**: Wait 2000ms.
    - **Check**:
      - If process exits with code `!= 0` within 2000ms: **Fail** (throw error with stderr).
      - If process is still running after 2000ms: **Success**. Send `SIGKILL` to cleanup.
      - If process exits with code `0` immediately (e.g., `echo hello`): **Warning** via Clack ("Command exited immediately, but code was 0. Proceeding...").

3.  **Environment Preparation**:
    - Ensure all directories defined in Section 3 exist.

4.  **Wrapper Generation**:
    - **Path**: `~/.local/share/daemon-cli/wrappers/${name}.sh`
    - **Content**:

      ```bash
      #!/bin/bash
      # Source user profile to load PATH (nvm, pyenv, etc)
      [ -f "$HOME/.zshrc" ] && source "$HOME/.zshrc"
      [ -f "$HOME/.bash_profile" ] && source "$HOME/.bash_profile"

      # Execute the command
      exec ${command}
      ```

    - **Action**: Write file and `chmod +x`.

5.  **Plist Generation**:
    - **Path**: `~/Library/LaunchAgents/homebrew.mxcl.${name}.plist`
    - **Note**: Naming it `homebrew.mxcl...` allows `brew services` to detect it.
    - **Content**:
      ```xml
      <?xml version="1.0" encoding="UTF-8"?>
      <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
      <plist version="1.0">
      <dict>
          <key>Label</key>
          <string>homebrew.mxcl.${name}</string>
          <key>ProgramArguments</key>
          <array>
              <string>/Users/${USER}/.local/share/daemon-cli/wrappers/${name}.sh</string>
          </array>
          <key>RunAtLoad</key>
          <true/>
          <key>KeepAlive</key>
          <${keepAlive}/>
          <key>StandardOutPath</key>
          <string>/Users/${USER}/Library/Logs/Homebrew/${name}.log</string>
          <key>StandardErrorPath</key>
          <string>/Users/${USER}/Library/Logs/Homebrew/${name}.log</string>
      </dict>
      </plist>
      ```

6.  **Logrotate Configuration**:
    - **Path**: `~/.config/daemon-cli/logrotate.d/${name}.conf`
    - **Content**:
      ```text
      "/Users/${USER}/Library/Logs/Homebrew/${name}.log" {
        ${rotation}
        rotate ${keep}
        ${compress ? 'compress' : ''}
        missingok
        notifempty
        copytruncate
      }
      ```
      _Note: `copytruncate` is essential as `launchd` maintains the file handle on the log file._

7.  **Cron Setup (Idempotent)**:
    - **Action**: Read current crontab (`crontab -l`).
    - **Search**: Check for specific marker `# daemon-cli-logrotate`.
    - **Update**: If missing, append:
      ```cron
      @daily /usr/local/bin/logrotate -s $HOME/.local/state/daemon-cli/logrotate.status $HOME/.config/daemon-cli/logrotate.d/*.conf # daemon-cli-logrotate
      ```
      _(Note: Resolve `logrotate` binary path dynamically using `which logrotate` if possible, fallback to `/usr/bin/logrotate` or `/usr/local/bin/logrotate`)_.

8.  **Service Start**:
    - Run `launchctl bootstrap gui/${UID} ~/Library/LaunchAgents/homebrew.mxcl.${name}.plist`.
    - _Alternative_: `execa('brew', ['services', 'start', name])` might fail because it looks for a formula. Using `launchctl` directly is safer, but listing it via `brew services` works due to the file naming.

### 5.2. Command: `rm`

**Handler Logic:**

1.  **Stop Service**:
    - Run `launchctl bootout gui/${UID} ~/Library/LaunchAgents/homebrew.mxcl.${name}.plist`.
    - Ignore error if service is not running.
2.  **File Cleanup**:
    - Delete `~/Library/LaunchAgents/homebrew.mxcl.${name}.plist`.
    - Delete `~/.local/share/daemon-cli/wrappers/${name}.sh`.
    - Delete `~/.config/daemon-cli/logrotate.d/${name}.conf`.
3.  **Log Choice**:
    - Prompt user: "Delete logs for ${name}? (y/N)".
    - If yes, delete `~/Library/Logs/Homebrew/${name}.log` and `${name}.log.*`.
4.  **Cron Cleanup**:
    - If no config files remain in `~/.config/daemon-cli/logrotate.d/`, remove the line from crontab.

### 5.3. Command: `list`

**Handler Logic:**

1.  **Data Gathering**:
    - Read all `.conf` files in `~/.config/daemon-cli/logrotate.d/` to identify managed daemons.
    - Run `launchctl list` (parse output).
    - Check file size of `~/Library/Logs/Homebrew/${name}.log`.
2.  **Mapping**:
    - Match managed names with `launchctl` labels (`homebrew.mxcl.${name}`).
3.  **Display**:
    - Print table using standard formatting (e.g., `console.table` or a Clack-styled list).
    - Columns: `Name`, `Status` (Running/Stopped), `PID`, `Log Size`, `Command` (read from wrapper file).

---

## 6. Error Handling Strategy

1.  **Global Catch**: Wrap main CLI execution. If error, print formatted Red message via Clack and exit `1`.
2.  **Requirement Check**:
    - On startup, check `process.platform === 'darwin'`. If not, exit with "This tool only supports macOS".
    - Check for `logrotate` availability. If missing, suggest `brew install logrotate`.
3.  **Command Validation**:
    - If the user's command fails validation, provide the stderr output so they can debug quotes/paths.

## 7. File Structure for Implementation

```
src/
├── cli.ts                # Entry point, cmd-ts definitions
├── commands/
│   ├── create.ts         # Logic for creation, validation, generation
│   ├── list.ts           # Logic for querying launchctl and displaying table
│   └── remove.ts         # Logic for cleanup
├── lib/
│   ├── launchd.ts        # Helper to generate Plist XML and run launchctl
│   ├── logrotate.ts      # Helper to generate config string
│   ├── wrapper.ts        # Helper to write shell script
│   └── paths.ts          # Centralized path constants (os.homedir resolution)
└── utils/
    ├── process.ts        # 'execa' wrappers, command validation logic
    └── ui.ts             # Shared Clack prompts and spinners
```

## 8. UX Example (Interactive)

```text
$ daemon create
> Name of the daemon?
  my-server
> Shell command to run?
  python3 -m http.server 8080

○ Validating command...
◇ Command started successfully (PID: 12345).

> Log rotation frequency?
  daily
> Keep how many logs?
  7

◇ Created wrapper at ~/.local/share/daemon-cli/wrappers/my-server.sh
◇ Generated Plist at ~/Library/LaunchAgents/homebrew.mxcl.my-server.plist
◇ Configured logrotate for ~/.config/daemon-cli/logrotate.d/my-server.conf
◇ Service started via launchctl.

✓ Daemon 'my-server' is running.
```
