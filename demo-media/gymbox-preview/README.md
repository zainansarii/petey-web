# Gymbox × Petey preview

This is the editable 52-second adaptation of the supplied `petey-preview.mp4`. It preserves the reference's scene boundaries, animation timings, wedding conversation, profile selection, dashboard sequence, music and closing structure.

Delivery: `gymbox-preview.mp4` (1920×1080, 30fps, 1,560 frames), with `gymbox-preview.jpg` as the poster. The opening is fully settled at frame zero. The supplied reference and original David Lloyd assets were not modified.

## Content

| Time | Scene |
| --- | --- |
| 0–5.75s | Panning directory of the same ten synthetic trainers; “Find your kind of trainer.” |
| 5.75–19.5s | Seven-turn wedding-goal conversation; Gymbox membership question; confirmed Bank-only access near work |
| 19.5–28.25s | Amira, Emma and Grace at Bank; Emma expands with match reasons |
| 28.25–38.25s | Actual adapted dashboard metrics, then member-goal demand |
| 38.25–48.25s | Actual trainer rankings, Emma selection, trainer detail and goal breakdown |
| 48.25–52s | Official Gymbox logo × Petey; “personalised PT discovery.” |

All three featured trainers are eligible for the Bank-only member. Grace’s fictional profile supports confidence and beginner strength coaching. Rates remain unknown and display as Rates on enquiry. All identities and dashboard metrics are fictional, labelled as sample data.

Black `#111111`, white `#FFFFFF`, Gymbox yellow `#FFCD33`, DM Sans. Music is the same supplied Alita Zayner excerpt (00:34–01:26), already levelled, at fixed gain 0.5. No narration or sound effects.

## Editable source and dependencies

`composition/index.html` contains the seek-safe GSAP composition. Every render asset is local and referenced relatively. `composition/index.motion.json` asserts motion intent; `composition/frame.md` records the visual treatment.

`dashboard-source/` is a snapshot of the actual adapted app component, data and shared catalogue. Only the isolated wrapper's initial UI state, presentation CSS, and asset URL rebasing to identical local copies differ. The wrapper uses `overview.html`, `trainers.html` and `emma.html` for deterministic capture; production source is untouched.

Node.js 22 or newer and FFmpeg/FFprobe are required. `package.json` pins Hyperframes 0.8.70, esbuild 0.25.12, React/React DOM 19.2.8, lucide-react 1.31.0 and DM Sans 5.3.0.

```sh
npm install
python3 capture-dashboard.py
npm run check
npm run render
python3 finish-video.py
```

Dashboard capture JPEGs are included for a fully reproducible film render. To refresh from the final app, run `python3 refresh-dashboard-source.py /absolute/path/to/petey-web`, then `python3 capture-dashboard.py`. The refresh script copies the actual Gymbox component, data and catalogue, records SHA-256 source hashes, and changes only initial UI state and capture presentation CSS. Run it only after the app source is final.

The native Hyperframes snapshot command captures overview at 1040×1077, trainers at 1040×750, Emma at 1040×1077, and Emma-bottom at 1040×600. The bottom route translates the same panel upward by 800 pixels. The composition clips the top to 800 pixels and places the bottom at y=800 for a seamless 1400-pixel camera surface. The existing camera crops and pans these surfaces. Captures derive from the actual component and final sample data; they are not painted approximations.

`NODE`, `FFMPEG` and `PETEY_NODE_MODULES` may point to existing dependencies for isolated regeneration. Hyperframes accepts `HYPERFRAMES_FFMPEG_PATH` and `HYPERFRAMES_FFPROBE_PATH` for rendering. The pinned `timeline` command should run from inside `composition/` as `hyperframes timeline --json`.

`finish-video.py` extracts the settled poster, bakes it into frame zero, preserves the encoded audio, verifies duration/frame count/full decode/loudness, and produces QA frames, a scene contact sheet, a transition contact sheet and a verification report. It discovers `ffmpeg` and `ffprobe` on PATH; `FFMPEG` and `FFPROBE` environment variables can override them.

`tools/` is a local renderer installation cache and is unnecessary when dependencies are installed through the root `package.json`. Exclude `tools/`, `node_modules/`, generated builds, master renders and QA frame images when committing the source.

The final metrics and source hashes are recorded in `qa/dashboard-source-manifest.json`, `qa/dashboard-capture-report.json` and `qa/verification.json`; brand, portrait, font and music provenance is in `qa/asset-provenance.json`. `qa/check.json` records the passing Hyperframes gate, while `qa/command-statuses.json` records successful command exits.
