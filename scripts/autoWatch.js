import fs from 'fs';
import { exec } from 'child_process';
import path from 'path';

let timeout = null;
let isSyncing = false;

console.log('🤖 QuantBridge Auto-Sync Watcher is running...');
console.log('Any file changes will be automatically committed and pushed to GitHub.');

function syncToGitHub() {
  if (isSyncing) return;
  isSyncing = true;
  console.log('🔄 Changes detected. Syncing to GitHub...');

  exec('powershell -ExecutionPolicy Bypass -File ./scripts/auto-sync.ps1', (err, stdout, stderr) => {
    isSyncing = false;
    if (err) {
      console.error('❌ Sync failed:', stderr || err.message);
    } else {
      console.log('✅ ' + stdout.trim());
    }
  });
}

// Watch directory recursively (ignoring .git and node_modules)
fs.watch(process.cwd(), { recursive: true }, (eventType, filename) => {
  if (!filename) return;
  if (
    filename.startsWith('.git') ||
    filename.includes('node_modules') ||
    filename.includes('.system_generated') ||
    filename.includes('dist') ||
    filename.endsWith('.log')
  ) {
    return;
  }

  // Debounce 4 seconds so multiple simultaneous file edits are grouped into one commit
  clearTimeout(timeout);
  timeout = setTimeout(syncToGitHub, 4000);
});
