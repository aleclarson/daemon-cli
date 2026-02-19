# daemon-cli

A macOS-exclusive CLI tool to turn arbitrary shell commands into background services managed by `launchd`. It uses a **Rust-based Governor** to securely execute scripts with Full Disk Access (FDA) permissions.

## Why the Governor?

On macOS, background processes managed by `launchd` are often restricted by **TCC** (Transparency, Consent, and Control). This prevents scripts from accessing sensitive areas like your `~/Documents` folder, `~/Desktop`, or external drives without explicit permission.

Granting permission for a shell script is difficult because giving access to `/bin/sh` would open your entire system. The **Governor** solves this by:

1.  **Single Permission:** You grant "Full Disk Access" **once** to the `daemon-governor` binary.
2.  **Inheritance:** On macOS, child processes inherit the TCC permissions of their parent. When the Governor runs your script, the script inherits the Full Disk Access.
3.  **Security via Hashing:** To prevent malware from abusing this, the Governor only runs scripts that have been registered with their SHA-256 hash in a root-owned allowlist.

## Features

- **Governor Pattern:** Securely run background scripts with Full Disk Access.
- **Integrity Verification:** The Governor verifies that scripts haven't been modified since registration.
- **Log Rotation:** Integrated `logrotate` support with configurable intervals and retention.
- **Node.js CLI:** A user-friendly CLI built with TypeScript and `@clack/prompts`.

## Prerequisites

- **macOS:** Only compatible with macOS.
- **logrotate:** Required for log management.
  ```bash
  brew install logrotate
  ```
- **Rust:** Required to build the Governor binary.

## Installation (From Source)

1.  Clone the repository.
2.  Install dependencies and build:
    ```bash
    pnpm install
    pnpm run build
    ```
3.  Link the binary:
    ```bash
    pnpm link --global
    ```

## Granting Full Disk Access

To allow your background daemons to access restricted folders without permission prompts, you must grant Full Disk Access to the Governor binary:

1.  Open **System Settings**.
2.  Go to **Privacy & Security** -> **Full Disk Access**.
3.  Click the **+** (plus) button.
4.  Navigate to the project directory and select:
    `governor/target/release/daemon-governor`
5.  Ensure the toggle is **ON**.

## Usage

### Create a Daemon

Turn any command into a background service. This will prompt for `sudo` to register the script's hash with the Governor.

```bash
daemon create <name> [command] [flags]
```

**Flags:**
- `--rotation <daily|weekly|hourly>`: Set log rotation interval.
- `--keep <count>`: Number of rotated logs to keep.
- `--compress`: Compress rotated logs.
- `--no-keep-alive`: Disable automatic restart if the process crashes.

### Security Model

- **The Allowlist:** A root-owned JSON file located at `/Library/Application Support/daemon-cli/allowlist.json`. This ensures that only an Administrator can authorize a script.
- **Registration:** When you run `daemon create`, the tool calculates the SHA-256 hash of the generated wrapper script and stores it in the allowlist via `sudo daemon-governor register`.
- **The Execution:** When `launchd` triggers, it calls `daemon-governor run <name>`. The Governor re-calculates the script's hash; if it doesn't match the one in the allowlist (due to unauthorized tampering), it refuses to execute.

## License

MIT
