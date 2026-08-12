// Sets up indexer.ts as a systemd service.
// Check status: sudo systemctl status indexer

import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { existsSync, writeFileSync } from "fs";
import { execSync } from "child_process";

// Get the absolute path to this script's directory (works in both ESM and CommonJS)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const NODE_BIN = process.execPath;

// Path to the indexer.ts file (relative to this script)
const INDEXER_PATH = resolve(__dirname, "indexer.ts");
const SERVICE_NAME = "indexer.service";
const SERVICE_PATH = `/etc/systemd/system/${SERVICE_NAME}`;

// Check that indexer.ts exists
if (!existsSync(INDEXER_PATH)) {
  console.error(`❌ indexer.ts not found at ${INDEXER_PATH}`);
  process.exit(1);
}

// Build the systemd service unit content
const serviceContent = `[Unit]
Description=Indexer Service
After=network.target

[Service]
Type=simple
ExecStart=${NODE_BIN} ${INDEXER_PATH}
WorkingDirectory=${__dirname}
EnvironmentFile=/etc/default/indexer
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
`;

// Write the service file (requires root/sudo privileges)
try {
  // If we are not root, try to write with sudo (using tee)
  if (process.getuid && process.getuid() !== 0) {
    console.log("⚠️  Not running as root. Attempting to write service file with sudo...");
    const cmd = `echo "${serviceContent.replace(/"/g, '\\"')}" | sudo tee ${SERVICE_PATH} > /dev/null`;
    execSync(cmd, { shell: "/bin/bash", stdio: "inherit" });
  } else {
    writeFileSync(SERVICE_PATH, serviceContent, { mode: 0o644 });
  }
  console.log(`✅ Service file written to ${SERVICE_PATH}`);
} catch (err) {
  console.error("❌ Failed to write service file:", err);
  process.exit(1);
}

// Reload systemd, enable and start the service
try {
  console.log("🔄 Reloading systemd daemon...");
  execSync("sudo systemctl daemon-reload", { stdio: "inherit" });

  console.log(`🔗 Enabling ${SERVICE_NAME} (start on boot)...`);
  execSync(`sudo systemctl enable ${SERVICE_NAME}`, { stdio: "inherit" });

  console.log(`▶️  Starting ${SERVICE_NAME}...`);
  execSync(`sudo systemctl start ${SERVICE_NAME}`, { stdio: "inherit" });

  console.log(`✅ Service ${SERVICE_NAME} is now running and set to start on boot.`);
  console.log(`   Check status with: sudo systemctl status ${SERVICE_NAME}`);
} catch (err) {
  console.error("❌ Failed to configure service", err);
  process.exit(1);
}
