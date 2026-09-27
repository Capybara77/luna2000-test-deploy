# Backup script for LUNA2000 SQLite database
param(
    [string]$SourcePath = "$PSScriptRoot\..\backend-asp-net\luna2000\DB\Data.db",
    [string]$BackupDir = "$PSScriptRoot\..\backups"
)

$ErrorActionPreference = "Stop"

$resolvedSource = [System.IO.Path]::GetFullPath($SourcePath)
if (-not (Test-Path $resolvedSource)) {
    Write-Error "Database file not found at: $resolvedSource"
    exit 1
}

$resolvedBackupDir = [System.IO.Path]::GetFullPath($BackupDir)
if (-not (Test-Path $resolvedBackupDir)) {
    New-Item -ItemType Directory -Path $resolvedBackupDir -Force | Out-Null
}

$internalBackupDir = [System.IO.Path]::Combine((Split-Path $resolvedSource -Parent), "backups")
if (-not (Test-Path $internalBackupDir)) {
    New-Item -ItemType Directory -Path $internalBackupDir -Force | Out-Null
}

$timestamp = (Get-Date).ToString("yyyy-MM-dd_HH-mm-ss")
$backupFileName = "Data_backup_$timestamp.db"
$backupZipName = "Data_backup_$timestamp.zip"

$targetDbPath = Join-Path $resolvedBackupDir $backupFileName
$targetInternalDbPath = Join-Path $internalBackupDir $backupFileName
$targetZipPath = Join-Path $resolvedBackupDir $backupZipName

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  LUNA2000 DATABASE BACKUP UTILITY" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Source:  $resolvedSource"
Write-Host "Time:    $((Get-Date).ToString('dd.MM.yyyy HH:mm:ss'))"

# Safe copy using FileStream with FileShare.ReadWrite to avoid locking issues while server runs
$sourceStream = [System.IO.File]::Open($resolvedSource, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
$destStream = [System.IO.File]::Create($targetDbPath)
$sourceStream.CopyTo($destStream)
$sourceStream.Close()
$destStream.Close()

# Also copy to DB/backups
Copy-Item -Path $targetDbPath -Destination $targetInternalDbPath -Force

# Create ZIP archive
if (Test-Path $targetZipPath) { Remove-Item $targetZipPath -Force }
Compress-Archive -Path $targetDbPath -DestinationPath $targetZipPath -CompressionLevel Optimal

# Verify files
$dbItem = Get-Item $targetDbPath
$zipItem = Get-Item $targetZipPath

# Calculate SHA256 of the backup
$hash = Get-FileHash -Path $targetDbPath -Algorithm SHA256

Write-Host "`n[SUCCESS] Backup created successfully!" -ForegroundColor Green
Write-Host "  Backup DB:  $targetDbPath ($([math]::Round($dbItem.Length / 1KB, 2)) KB)" -ForegroundColor White
Write-Host "  Mirror DB:  $targetInternalDbPath" -ForegroundColor White
Write-Host "  Zip Archive: $targetZipPath ($([math]::Round($zipItem.Length / 1KB, 2)) KB)" -ForegroundColor White
Write-Host "  SHA256:     $($hash.Hash)" -ForegroundColor DarkGray
Write-Host "========================================`n" -ForegroundColor Cyan
