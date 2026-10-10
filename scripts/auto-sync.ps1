# QuantBridge Automated GitHub Synchronization Script
# Automatically stages, commits, and pushes all workspace updates to GitHub

Write-Host "🚀 Checking QuantBridge Git status..." -ForegroundColor Cyan

# Check if remote origin is configured
$remoteUrl = git remote get-url origin 2>$null
if (-not $remoteUrl) {
    Write-Host "⚠️ No GitHub remote URL configured yet!" -ForegroundColor Yellow
    Write-Host "Please link your GitHub repo first by running:" -ForegroundColor Yellow
    Write-Host "git remote add origin https://github.com/<YOUR-USERNAME>/<YOUR-REPO>.git" -ForegroundColor White
    exit 1
}

# Add all files (secrets are guarded by .gitignore)
git add .

$status = git status --porcelain
if (-not $status) {
    Write-Host "✓ Workspace is clean. Everything is already up-to-date on GitHub!" -ForegroundColor Green
    exit 0
}

# Generate timestamped commit message
$commitMsg = "QuantBridge update: " + (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
Write-Host "📦 Creating commit: $commitMsg" -ForegroundColor Cyan
git commit -m $commitMsg

Write-Host "⬆️ Pushing changes to GitHub main branch..." -ForegroundColor Cyan
git push origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Successfully synchronized with GitHub!" -ForegroundColor Green
} else {
    Write-Host "❌ Push failed. Please verify your GitHub credentials or remote URL." -ForegroundColor Red
}
