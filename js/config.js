// The only place to change when a new version is released.
// Packages are published as a release of the public site repository.
export const RELEASE = {
  repo: 'brainupstudio/devtrack.site',
  version: '0.1.1',
  files: {
    mac: 'DevTrack-0.1.1-macOS.dmg',
    win: 'DevTrack-0.1.1-Windows-x64.zip',
    linux: 'DevTrack-0.1.1-Linux-x64.tar.gz',
  },
};

export const downloadUrl = (os) =>
  `https://github.com/${RELEASE.repo}/releases/download/v${RELEASE.version}/${RELEASE.files[os]}`;
export const notesUrl = () => `https://github.com/${RELEASE.repo}/releases/tag/v${RELEASE.version}`;
