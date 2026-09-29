# David Lloyd × Petey preview

This is the editable 52-second adaptation of the supplied `petey-preview.mp4`. It preserves the reference's scene boundaries, animation timings, wedding conversation, profile selection, dashboard sequence, music and closing structure.

Delivery: `david-lloyd-preview.mp4` (1920×1080, 30fps, 1,560 frames), with `david-lloyd-preview.jpg` as the poster. The opening is fully settled at frame zero. The original Third Space film was not modified.

## Content

| Time | Scene |
| --- | --- |
| 0–5.75s | Panning directory of the same ten synthetic trainers; “Find your kind of trainer.” |
| 5.75–19.5s | Seven-turn wedding-goal conversation; David Lloyd membership question; Earlsfield location |
| 19.5–28.25s | Amira and Emma at Raynes Park, Grace at Colliers Wood; Emma expands with match reasons |
| 28.25–38.25s | Actual adapted dashboard metrics, then member-goal demand |
| 38.25–48.25s | Actual trainer rankings, Emma selection, trainer detail and goal breakdown |
| 48.25–52s | Official David Lloyd script logo × Petey; “personalised PT discovery.” |

The featured third trainer is Grace because the final demo's Earlsfield club selection includes Colliers Wood. Her existing synthetic profile supports confidence and beginner strength coaching. All identities and dashboard metrics are fictional, labelled as sample data.

Cream `#FCFCF6`, plum `#82285F`, charcoal `#474A4A`, DM Sans. Music is the same supplied Alita Zayner excerpt (00:34–01:26), already levelled, at fixed gain 0.5. No narration or sound effects.

## Editable source and dependencies

`composition/index.html` contains the seek-safe GSAP composition. Every render asset is local and referenced relatively. `composition/index.motion.json` asserts motion intent; `composition/frame.md` records the visual treatment.

`dashboard-source/` is a snapshot of the actual adapted app component, data and shared catalogue. Only the isolated wrapper's initial UI state and presentation CSS differ. The wrapper uses `overview.html`, `trainers.html` and `emma.html` for deterministic capture; production source is untouched.

Node.js 22 or newer and FFmpeg/FFprobe are required. `package.json` pins Hyperframes 0.8.70, esbuild 0.25.12, React/React DOM 19.2.8, lucide-react 1.31.0 and DM Sans 5.3.0.

```sh
npm install
npm run build:captures
npm run check
npm run render
python3 finish-video.py
```

Dashboard capture JPEGs are already included for a fully reproducible film render. To refresh them after editing the isolated dashboard snapshot, serve `dashboard-source/built/`, capture the three pages using CUA at the documented dimensions, and place the JPEGs in `composition/assets/ui/`. Capture overview at 1040×1077 and trainers at 1040×750. Capture Emma at 1040×1077 plus emma-bottom.html at 1040×600; the bottom route translates the same panel upward by 800 pixels. The composition clips the top to 800 pixels and places the bottom at y=800 for a seamless 1400-pixel camera surface. The existing presentation camera crops and pans these images. Do not replace them with full-page dashboard screenshots containing the normal site navigation.

`finish-video.py` extracts the settled poster, bakes it into frame zero, preserves the encoded audio, verifies duration/frame count/full decode/loudness, and produces QA frames and a verification report. It discovers `ffmpeg` and `ffprobe` on PATH; `FFMPEG` and `FFPROBE` environment variables can override them.

`tools/` is a local renderer installation cache and is unnecessary when dependencies are installed through the root `package.json`. Exclude `tools/`, `node_modules/`, generated builds, master renders and QA frame images when committing the source.
