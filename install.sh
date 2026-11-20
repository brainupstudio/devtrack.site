#!/bin/sh
# Installs or updates DevTrack on macOS and Linux:
#
#   curl -fsSL https://brainupstudio.github.io/devtrack.site/install.sh | sh
#
# It downloads the latest release from github.com/brainupstudio/devtrack.site, checks it
# against the published SHA-256 checksums, and installs it:
# - macOS: DevTrack.app in /Applications (DEVTRACK_DIR to choose another folder). A file
#   fetched by curl is not marked as downloaded from the internet, so macOS opens the app
#   without the "cannot verify" warning shown for downloads from a browser.
# - Linux: the program in ~/.local/bin, the icon and the menu entry in ~/.local/share.
# Your data is never touched: it lives in its own folder and stays there.
#
# Everything is inside main(), so a download cut short runs nothing. Plain ASCII only: with
# the C locale, sh would read a multibyte character after $name as part of the name.

main() {
    set -eu
    REPO="brainupstudio/devtrack.site"

    say() { printf '%s\n' "$*"; }
    fail() { printf 'DevTrack: %s\n' "$*" >&2; exit 1; }
    need() { command -v "$1" >/dev/null 2>&1 || fail "this needs '$1', which is not installed."; }

    need curl
    need uname
    need mktemp

    case "$(uname -s)" in
        Darwin) os=mac ;;
        Linux) os=linux ;;
        *) fail "this script is for macOS and Linux. On Windows, in PowerShell: irm https://brainupstudio.github.io/devtrack.site/install.ps1 | iex" ;;
    esac
    if [ "$os" = linux ] && [ "$(uname -m)" != x86_64 ]; then
        fail "DevTrack for Linux is built for 64-bit Intel and AMD processors (x86_64) only, not $(uname -m)."
    fi

    # the latest release: GitHub redirects .../releases/latest to .../releases/tag/v<version>
    tag_url=$(curl -fsSLI -o /dev/null -w '%{url_effective}' "https://github.com/$REPO/releases/latest") || fail "no connection to GitHub."
    tag=${tag_url##*/}
    version=${tag#v}
    case "$version" in
        [0-9]*.[0-9]*) ;;
        *) fail "could not find the latest version." ;;
    esac
    case "$os" in
        mac) file="DevTrack-$version-macOS.dmg" ;;
        linux) file="DevTrack-$version-Linux-x64.tar.gz" ;;
    esac
    base="https://github.com/$REPO/releases/download/$tag"

    tmp=$(mktemp -d)
    mnt=""
    cleanup() {
        if [ -n "$mnt" ]; then hdiutil detach "$mnt" -quiet >/dev/null 2>&1 || true; fi
        rm -rf "$tmp"
    }
    trap cleanup EXIT INT TERM

    say "Downloading DevTrack ${version}..."
    curl -fL --progress-bar -o "$tmp/$file" "$base/$file" || fail "the download did not finish."
    curl -fsSL -o "$tmp/SHA256SUMS.txt" "$base/SHA256SUMS.txt" || fail "the checksums of version $version are not published, so the download cannot be checked."

    expected=$(awk -v f="$file" '$2 == f || $2 == "*"f { print $1 }' "$tmp/SHA256SUMS.txt")
    [ -n "$expected" ] || fail "$file is not in the published checksums."
    if command -v shasum >/dev/null 2>&1; then
        actual=$(shasum -a 256 "$tmp/$file" | awk '{ print $1 }')
    else
        need sha256sum
        actual=$(sha256sum "$tmp/$file" | awk '{ print $1 }')
    fi
    [ "$actual" = "$expected" ] || fail "the downloaded file does not match its checksum. Nothing was installed; try again."
    say "Checked: the file is the published one."

    if [ "$os" = mac ]; then
        need hdiutil
        dir="${DEVTRACK_DIR:-/Applications}"
        app="$dir/DevTrack.app"
        mnt="$tmp/volume"
        mkdir -p "$mnt"
        hdiutil attach "$tmp/$file" -nobrowse -readonly -quiet -mountpoint "$mnt" || { mnt=""; fail "could not open the disk image."; }
        [ -d "$mnt/DevTrack.app" ] || fail "the disk image does not contain DevTrack.app."
        # the copy being replaced must not be running
        running() { pgrep -f "$app/Contents/MacOS/devtrack" >/dev/null 2>&1; }
        if running; then
            say "Closing DevTrack to replace it..."
            osascript -e 'tell application id "studio.brainup.devtrack" to quit' >/dev/null 2>&1 || true
            i=0
            while running && [ $i -lt 20 ]; do sleep 0.5; i=$((i + 1)); done
            if running; then fail "DevTrack is still open: quit it (menu bar icon > Quit) and run this again."; fi
        fi
        mkdir -p "$dir"
        sudo=""
        if [ ! -w "$dir" ] || { [ -e "$app" ] && [ ! -w "$app" ]; }; then
            say "$dir needs your password to write DevTrack there."
            sudo="sudo"
        fi
        $sudo rm -rf "$app"
        $sudo ditto "$mnt/DevTrack.app" "$app"
        # in case the copy came marked anyway: the app is the published one, checked above
        $sudo xattr -dr com.apple.quarantine "$app" 2>/dev/null || true
        say "DevTrack $version is in $dir."
        if [ "$dir" = /Applications ]; then
            open "$app" || true
        fi
    else
        need tar
        tar -xzf "$tmp/$file" -C "$tmp"
        folder="$tmp/DevTrack-$version-Linux-x64"
        [ -x "$folder/install.sh" ] || fail "the archive does not contain the installer."
        sh "$folder/install.sh"
        case ":$PATH:" in
            *":$HOME/.local/bin:"*) ;;
            *) say "Note: $HOME/.local/bin is not in your PATH, so 'devtrack' works only from the applications menu or with its full path." ;;
        esac
        say "DevTrack $version is installed."
    fi
}

main "$@"
