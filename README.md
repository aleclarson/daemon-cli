# daemon-cli

A macOS-exclusive CLI tool to turn arbitrary shell commands into background services managed by `launchd`. It provides automatic log rotation and standard `launchd` integration.

## Features

- **Arbitrary Commands:** Supports flags, pipes, and loops by encapsulating them in a managed wrapper script.
- **Log Rotation:** Integrated `logrotate` support with configurable intervals and retention.
- **Native Launchd:** Uses standard `com.daemon-cli` naming conventions for native `launchd` integration.
- **Persistence:** Configurations and wrappers are stored in standard user directories (`~/.config`, `~/.local`).

## Prerequisites

- **macOS:** This tool uses `launchd` and is only compatible with macOS.
- **logrotate:** Required for log management.
  ```bash
  brew install logrotate
  ```

## Installation (From Source)

1. Clone the repository.
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Build the project:
   ```bash
   pnpm run build
   ```
4. Link the binary:
   ```bash
   pnpm link --global
   ```

## Usage

### Create a Daemon

Turn any command into a background service. If arguments are omitted, the tool will prompt you interactively.

```bash
daemon create <name> [command] [flags]
```

**Flags:**

- `--rotation <daily|weekly|hourly>`: Set log rotation interval (default: daily).
- `--keep <count>`: Number of rotated logs to keep (default: 7).
- `--compress`: Compress rotated logs (default: true).
- `--no-keep-alive`: Disable automatic restart if the process crashes.

### Restart a Daemon

Restart a running service.

```bash
daemon restart <name>
```

### Read Logs

Read or tail the logs of a service.

```bash
daemon logs <name> [-f] [-n <lines>]
```

### Autocompletion

To enable zsh completion, add the following to your `.zshrc`:

```bash
source <(daemon completion zsh)
```

### List Daemons

Show all daemons managed by `daemon-cli`, including their status, PID, and log size.

```bash
daemon list
```

### Remove a Daemon

Stop the service and delete associated configurations and wrappers.

```bash
daemon rm <name>
```

## Storage Locations

| Resource          | Path                                  |
| :---------------- | :------------------------------------ |
| **Wrappers**      | `~/.local/share/daemon-cli/wrappers/` |
| **Configs**       | `~/.config/daemon-cli/logrotate.d/`   |
| **Logs**          | `~/Library/Logs/daemon-cli/`          |
| **Launch Agents** | `~/Library/LaunchAgents/`             |

## License

MIT
