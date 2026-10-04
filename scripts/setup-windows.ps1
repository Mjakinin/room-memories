# Execute in PowerShell on the RTX computer. Re-run after a Windows restart if needed.
$ErrorActionPreference = 'Stop'
Write-Host 'Room Memories: Windows/WSL2 prerequisites'
if (-not (Get-Command wsl -ErrorAction SilentlyContinue)) {
    throw 'Windows 11 or an updated Windows 10 with WSL2 is required.'
}
wsl --status
if ($LASTEXITCODE -ne 0) {
    Write-Host 'Installing WSL2 and Ubuntu 24.04. Administrator rights/restart may be requested by Windows.'
    wsl --install -d Ubuntu-24.04
    exit $LASTEXITCODE
}
Write-Host '1. Update the NVIDIA Windows driver: https://www.nvidia.com/Download/index.aspx'
Write-Host '2. Install/start Docker Desktop, enable WSL2 + Ubuntu integration:'
Write-Host '   https://docs.docker.com/desktop/setup/install/windows-install/'
Write-Host '3. Open Ubuntu, clone room-memories into your Linux home, then run:'
Write-Host '   bash scripts/setup-rtx.sh'
Write-Host 'The script does not install a Linux NVIDIA display driver inside WSL.'
