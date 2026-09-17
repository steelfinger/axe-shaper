# Workshop photography

Downloaded from Unsplash and used under the [Unsplash License](https://unsplash.com/license).

- `unfinished-guitar-body.webp` — [Alex Kalligas, N_kSeJWM6xM](https://unsplash.com/photos/N_kSeJWM6xM)
- `guitar-body-workbench.webp` — [Alex Kalligas, _AL_uONnBTg](https://unsplash.com/photos/_AL_uONnBTg)

Visible attribution links are also included beside the photographs on the marketing page.

## Product screenshots

- `axe-shaper-ipad-editor.webp` — our own screenshot of Axe Shaper for iPad,
  no attribution needed. Source was a 2732x2048 (4:3) iPad Pro capture,
  resized to 1600px wide and encoded `cwebp -q 88 -sharp_yuv -m 6`; q88 is
  indistinguishable from the source on the UI text at 200% zoom, and lower
  quality starts to mush the inspector labels.

  The 4:3 ratio is load-bearing. `.ipad-screen` and `.ipad-hero-screen` in
  `src/styles/index.css` declare it so the shot fills the device frame with
  `object-fit: cover` and no letterboxing; a replacement capture from a
  differently-shaped iPad needs those two rules updated to match, or `cover`
  will silently crop the status bar or the inspector.

- `hero-guitar-nebula-1844.webp` / `hero-guitar-nebula-1000.webp` — our own
  3D render of the hero's custom S-style (the same project as
  `public/marketing/custom-s-style-plan.axe.svg`), no attribution needed.
  Cropped 1844x1314 from a 1844x2238 capture, dropping the watermark at the
  bottom, and encoded `cwebp -q 80 -sharp_yuv -m 6`. It sits behind a dark
  scrim and a mask, so q80 costs nothing visible. `.hero-backdrop::before`
  declares the 1844 / 1314 ratio, and its offsets assume the body is on the
  left of the frame and the headstock is top right. A differently framed
  render needs those offsets measured again.
