# QuantBridge Automated GitHub Synchronization Script
Write-Host "Checking QuantBridge Git status..." -ForegroundColor Cyan

$remoteUrl = git remote get-url origin 2>$null
if (-not $remoteUrl) {
    Write-Host "No GitHub remote URL configured." -ForegroundColor Yellow
    exit 1
}

git add .

$status = git status --porcelain
if (-not $status) {
    Write-Host "Workspace clean: all changes are already on GitHub!" -ForegroundColor Green
    exit 0
}

$time = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$commitMsg = "QuantBridge update: $time"
Write-Host "Creating commit: $commitMsg" -ForegroundColor Cyan
git commit -m "$commitMsg"

Write-Host "Pushing to GitHub main branch..." -ForegroundColor Cyan
git push origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host "Successfully synchronized with GitHub!" -ForegroundColor Green
} else {
    Write-Host "Push failed. Check credentials or network." -ForegroundColor Red
}
