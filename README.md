# daemon-cli

A macOS-exclusive CLI tool to turn arbitrary shell commands into background services managed by `launchd`. It uses a **Rust-based Governor** to securely execute scripts with Full Disk Access (FDA) permissions.

## Features

- **Governor Pattern:** Only the `daemon-governor` binary needs Full Disk Access. It verifies script integrity (SHA-256) before execution.
- **Secure Registration:** Scripts are registered via `sudo` to be allowed to run.
- **Log Rotation:** Integrated `logrotate` support.
- **Node.js CLI:** Familiar CLI interface built with TypeScript.

## Prerequisites

- **macOS:** Only compatible with macOS.
- **logrotate:** Required for log management.
  ```bash
  brew install logrotate
  ```
- **Rust:** Required to build the Governor binary.

## Installation (From Source)

1. Clone the repository.
2. Install dependencies and build:
   ```bash
   pnpm install
   pnpm run build
   ```
3. Link the binary:
   ```bash
   pnpm link --global
   ```
4. **Grant Full Disk Access:**
   Open System Settings -> Privacy & Security -> Full Disk Access and add the `daemon-governor` binary located at:
   `[project-path]/governor/target/release/daemon-governor`

## Usage

### Create a Daemon

Turn any command into a background service. This will prompt for `sudo` to register the script's hash with the Governor.

```bash
daemon create <name> [command] [flags]
```

### Security Model

1. **The Governor (Rust):** A small, secure binary that acts as the "Privileged Actor".
2. **The Registration:** When you create a daemon, the CLI calls `sudo daemon-governor register` to save the script's SHA-256 hash.
3. **The Execution:** `launchd` calls `daemon-governor run <name>`. The Governor verifies the hash before spawning the script.

## License

MIT
