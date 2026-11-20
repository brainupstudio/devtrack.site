# Installs or updates DevTrack on Windows (x64), in PowerShell:
#
#   irm https://brainupstudio.github.io/devtrack.site/install.ps1 | iex
#
# It downloads the latest release from github.com/brainupstudio/devtrack.site, checks it
# against the published SHA-256 checksums, puts DevTrack.exe in
# %LOCALAPPDATA%\Programs\DevTrack ($env:DEVTRACK_DIR to choose another folder) and adds it
# to the Start menu. A file fetched this way is not marked as downloaded from the internet, so
# SmartScreen does not stop it. Your data (%APPDATA%\DevTrack) is never touched.
#
# Everything is inside a script block run at the end, so a download cut short runs nothing.

& {
    $ErrorActionPreference = 'Stop'
    $ProgressPreference = 'SilentlyContinue'
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $repo = 'brainupstudio/devtrack.site'

    function Fail($message) {
        Write-Host "DevTrack: $message" -ForegroundColor Red
        throw "DevTrack: $message"
    }

    if (-not [Environment]::Is64BitOperatingSystem) { Fail 'DevTrack for Windows needs 64-bit Windows.' }

    # the latest release: GitHub redirects .../releases/latest to .../releases/tag/v<version>
    try {
        $request = [Net.WebRequest]::Create("https://github.com/$repo/releases/latest")
        $request.Method = 'HEAD'
        $response = $request.GetResponse()
        $tag = $response.ResponseUri.Segments[-1]
        $response.Close()
    } catch { Fail 'no connection to GitHub.' }
    $version = $tag.TrimStart('v')
    if ($version -notmatch '^\d+\.\d+') { Fail 'could not find the latest version.' }

    $file = "DevTrack-$version-Windows-x64.zip"
    $base = "https://github.com/$repo/releases/download/$tag"
    $tmp = Join-Path ([IO.Path]::GetTempPath()) ("devtrack-" + [Guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $tmp | Out-Null
    try {
        Write-Host "Downloading DevTrack $version..."
        $zip = Join-Path $tmp $file
        try { Invoke-WebRequest -UseBasicParsing -Uri "$base/$file" -OutFile $zip } catch { Fail 'the download did not finish.' }
        try { $sums = (Invoke-WebRequest -UseBasicParsing -Uri "$base/SHA256SUMS.txt").Content } catch { Fail "the checksums of version $version are not published, so the download cannot be checked." }
        if ($sums -is [byte[]]) { $sums = [Text.Encoding]::UTF8.GetString($sums) }

        $expected = $null
        foreach ($line in ($sums -split "`n")) {
            $parts = $line.Trim() -split '\s+'
            if ($parts.Count -ge 2 -and $parts[1].TrimStart('*') -eq $file) { $expected = $parts[0].ToLower() }
        }
        if (-not $expected) { Fail "$file is not in the published checksums." }
        $actual = (Get-FileHash -Algorithm SHA256 -Path $zip).Hash.ToLower()
        if ($actual -ne $expected) { Fail 'the downloaded file does not match its checksum. Nothing was installed; try again.' }
        Write-Host 'Checked: the file is the published one.'

        $unpacked = Join-Path $tmp 'unpacked'
        Expand-Archive -Path $zip -DestinationPath $unpacked
        $exe = Get-ChildItem -Path $unpacked -Recurse -Filter 'DevTrack.exe' | Select-Object -First 1
        if (-not $exe) { Fail 'the archive does not contain DevTrack.exe.' }

        $dir = if ($env:DEVTRACK_DIR) { $env:DEVTRACK_DIR } else { Join-Path $env:LOCALAPPDATA 'Programs\DevTrack' }
        $target = Join-Path $dir 'DevTrack.exe'
        $running = Get-Process -Name 'DevTrack' -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $target }
        if ($running) {
            Write-Host 'Closing DevTrack to replace it...'
            $running | ForEach-Object { $_.CloseMainWindow() | Out-Null }
            $running | Wait-Process -Timeout 10 -ErrorAction SilentlyContinue
            if (Get-Process -Name 'DevTrack' -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $target }) {
                Fail 'DevTrack is still open: close it and run this again.'
            }
        }
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
        Copy-Item -Force -Path $exe.FullName -Destination $target
        $readme = Get-ChildItem -Path $unpacked -Recurse -Filter 'README.txt' | Select-Object -First 1
        if ($readme) { Copy-Item -Force -Path $readme.FullName -Destination (Join-Path $dir 'README.txt') }
        # in case the copy came marked anyway: the program is the published one, checked above
        Unblock-File -Path $target

        if (-not $env:DEVTRACK_DIR) {
            $menu = Join-Path ([Environment]::GetFolderPath('Programs')) 'DevTrack.lnk'
            $shell = New-Object -ComObject WScript.Shell
            $link = $shell.CreateShortcut($menu)
            $link.TargetPath = $target
            $link.WorkingDirectory = $dir
            $link.Description = 'DevTrack'
            $link.Save()
            Write-Host "DevTrack $version is installed and in the Start menu."
            Start-Process -FilePath $target
        } else {
            Write-Host "DevTrack $version is in $dir."
        }
    } finally {
        Remove-Item -Recurse -Force -Path $tmp -ErrorAction SilentlyContinue
    }
}
