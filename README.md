# Daily Kettlebell Workout

A three-day kettlebell workout app (Day 1/2/3 plans, swipeable step bubbles, guided full session with
coach voice and beeps, exercise Library with pictures, progress streak). It is a single static page:
`index.html` + `app.js`. All pictures and audio clips are embedded in `app.js` as data URIs, so there
are no other files to serve and no network calls (except optional YouTube/Wikimedia links in the
Videos and Pictures sections).

Progress, swaps and photos are saved in the browser's `localStorage`.

## Deploy

The repo root is deployable as-is: serve the folder with any static host (Cloudflare Pages, Netlify,
Vercel, GitHub Pages, S3, nginx). No build step is needed. Publish directory: `.` (root).

To check it locally:

```sh
python3 -m http.server 8000   # then open http://localhost:8000
```

## Rebuild

```sh
npm install
npm run build
```

This bundles `src/main.tsx` (React 18 + `src/App.tsx`) with esbuild into `dist/app.js`, copies
`src/index.html` to `dist/`, and refreshes the root `index.html` and `app.js`. A host with a build
step can use build command `npm run build` and output directory `dist`.

## Source layout

- `src/App.tsx` - the app (unchanged from the original page source).
- `src/grok-canvas-shim.ts` - stands in for the `grok/canvas` module the original viewer provided
  (React hooks plus a dark theme object). Aliased in `build.mjs`.
- `src/main.tsx` - mounts the app into `#root`.
- `src/index.html` - page shell (mobile viewport, dark theme color, centered 480px column on desktop).
