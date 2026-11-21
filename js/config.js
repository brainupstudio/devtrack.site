// The only place to change when a new version is released.
// Packages are published as a release of the public site repository.
export const RELEASE = {
  repo: 'brainupstudio/devtrack.site',
  version: '0.1.5',
  files: {
    mac: 'DevTrack-0.1.5-macOS.dmg',
    win: 'DevTrack-0.1.5-Windows-x64.zip',
    linux: 'DevTrack-0.1.5-Linux-x64.tar.gz',
  },
};

export const downloadUrl = (os) =>
  `https://github.com/${RELEASE.repo}/releases/download/v${RELEASE.version}/${RELEASE.files[os]}`;
export const notesUrl = () => `https://github.com/${RELEASE.repo}/releases/tag/v${RELEASE.version}`;

// Install from a terminal: a file fetched this way is not marked as downloaded from the
// internet, so the system opens the app without the warning shown for browser downloads.
const SITE = 'https://brainupstudio.github.io/devtrack.site';
export const INSTALL = {
  sh: `curl -fsSL ${SITE}/install.sh | sh`,
  ps: `irm ${SITE}/install.ps1 | iex`,
};
