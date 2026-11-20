# DevTrack site

The public download page for DevTrack. One static page: no build step, no external requests.

## Preview

```sh
python3 -m http.server 8000
```

Then open http://localhost:8000. The page uses ES modules, so it needs a server; opening `index.html` from disk does not work.

## Publish a new version

1. Create a release `v<version>` in this repository and attach the three packages (`.dmg`, `.zip`, `.tar.gz`).
2. Update `version` and the three file names in `js/config.js`. Every download link on the page comes from there.

## Structure

- `index.html`, `css/style.css`: the page.
- `js/main.js`: language, operating-system detection, scroll states, labels.
- `js/scene.js`: the point cloud (three.js). Each point stands for tracked time: three sheets, then one sphere, then the per-platform values.
- `js/i18n.js`: Italian and English text.
- `vendor/`: three.js r187, only the parts the scene uses (MIT). `assets/fonts/`: Geist and Geist Mono (SIL Open Font License).

Without WebGL the page shows a static fallback and every download still works. With "reduce motion" the scene stops rotating and text appears without transitions.
