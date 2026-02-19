use anyhow::{Result, Context};
use clap::{Parser, Subcommand};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use sha2::{Sha256, Digest};
use std::io;
use std::process::Command;

#[derive(Parser)]
#[command(name = "daemon-governor")]
#[command(about = "Governor for daemon-cli", long_about = None)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Register a script for execution with FDA (requires sudo)
    Register {
        /// Name/ID of the script
        name: String,
        /// Path to the script
        path: PathBuf,
    },
    /// Internal: Run a registered script (Governor)
    Run {
        /// Name of the daemon
        name: String,
    },
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct Job {
    path: PathBuf,
    hash: String,
    run_as: String,
}

#[derive(Serialize, Deserialize, Debug, Default)]
struct Allowlist {
    scripts: HashMap<String, Job>,
}

const ALLOWLIST_PATH: &str = "/Library/Application Support/daemon-cli/allowlist.json";

fn load_allowlist() -> Result<Allowlist> {
    let path = Path::new(ALLOWLIST_PATH);
    if !path.exists() {
        return Ok(Allowlist::default());
    }
    let content = fs::read_to_string(path)?;
    let allowlist: Allowlist = serde_json::from_str(&content)?;
    Ok(allowlist)
}

fn save_allowlist(allowlist: &Allowlist) -> Result<()> {
    let path = Path::new(ALLOWLIST_PATH);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let content = serde_json::to_string_pretty(allowlist)?;
    fs::write(path, content)?;
    Ok(())
}

fn calculate_hash(path: &Path) -> Result<String> {
    let mut file = fs::File::open(path)?;
    let mut hasher = Sha256::new();
    io::copy(&mut file, &mut hasher)?;
    let hash = hasher.finalize();
    Ok(hex::encode(hash))
}

fn handle_register(name: String, path: PathBuf) -> Result<()> {
    let uid = unsafe { libc::getuid() };
    if uid != 0 {
        return Err(anyhow::anyhow!("Registration requires sudo/root privileges."));
    }

    let mut allowlist = load_allowlist()?;
    let abs_path = path.canonicalize()?;
    let hash = calculate_hash(&abs_path)?;
    let run_as = std::env::var("SUDO_USER").unwrap_or_else(|_| "root".to_string());

    allowlist.scripts.insert(name.clone(), Job {
        path: abs_path,
        hash,
        run_as,
    });

    save_allowlist(&allowlist)?;
    Ok(())
}

fn handle_run(name: String) -> Result<()> {
    let allowlist = load_allowlist()?;
    let job = allowlist.scripts.get(&name)
        .context(format!("Job '{}' not found in allowlist.", name))?;

    // Verify hash
    let current_hash = calculate_hash(&job.path)?;
    if current_hash != job.hash {
        return Err(anyhow::anyhow!("Security Alert: Script '{}' has been modified since registration!", name));
    }

    // Strip quarantine
    if let Some(path_str) = job.path.to_str() {
        let _ = Command::new("xattr")
            .args(["-d", "com.apple.quarantine", path_str])
            .output();
    }

    // Execute
    let status = Command::new(&job.path)
        .status()
        .context("Failed to execute script")?;

    if status.success() {
        Ok(())
    } else {
        Err(anyhow::anyhow!("Script failed with exit code: {:?}", status.code()))
    }
}

fn main() -> Result<()> {
    let cli = Cli::parse();
    match cli.command {
        Commands::Register { name, path } => handle_register(name, path),
        Commands::Run { name } => handle_run(name),
    }
}
