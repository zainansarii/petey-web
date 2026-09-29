# Synthetic demo portraits

All ten portraits live in `third-space-demo/public/trainers/`. The current set was generated entirely from scratch with the built-in image-generation tool on 2026-09-26, then four portraits were edited to vary their setting and pose. Each image depicts a different fictional person. The active catalogue remains exactly ten trainers.

The approved PNGs were visually inspected and encoded as neutral black-and-white WebP images at 900 px wide, quality 82. All ten use a 4:5 portrait composition with generous headroom. These images illustrate fictional demo profiles and do not establish a real trainer identity or Third Space employment.

| Demo asset | Approved scene |
| --- | --- |
| `ts-demo-emma-carter.webp` | Seated on a reformer in a bright Pilates studio |
| `ts-demo-daniel-reed.webp` | Standing in a strength gym |
| `ts-demo-amira-hassan.webp` | Standing in a strength gym |
| `ts-demo-lucas-bennett.webp` | Seated on a plyometric box in a functional-training space |
| `ts-demo-sophie-morgan.webp` | Standing beside a barre in a bright mobility studio |
| `ts-demo-nathan-cole.webp` | Standing in a strength gym |
| `ts-demo-adam-khan.webp` | Leaning casually beside a weight rack |
| `ts-demo-grace-ellis.webp` | Standing in a strength gym |
| `ts-demo-isabel-ross.webp` | Seated cross-legged on a yoga mat |
| `ts-demo-theo-parker.webp` | Standing beside a squat rack |

## Prompt direction

Create ten distinct fictional trainers with varied ages, ethnicities, genders and athletic builds. Use realistic editorial photography, soft natural side light, natural skin and fabric texture, restrained contrast, subtle grain, friendly expressions and plain dark training clothes. Output strictly neutral black and white, with no logos, text, watermarks, borders or extra people.

Use a vertical 4:5 frame with the head roughly one-third down from the top and generous space above the hair. Keep the face readable and the full head visible. For the four scene variations, preserve the newly generated person's recognizable face, hair, age, build and clothing while changing the room and pose to the setting listed above. Show the reformer, yoga mat or plyometric box clearly in the seated portraits.

The final encoder uses a neutral grayscale colour space to eliminate tiny residual channel differences in the generated pixels. The demo validator checks every decoded WebP, ten unique portraits, exactly ten active profiles and no extra published trainer images.
