# Synthetic demo portraits

All ten portraits live in `third-space-demo/public/trainers/`. They were prepared with the built-in image-generation tool on 2026-09-26, visually inspected, then encoded as neutral black-and-white WebP images at 900 px wide, quality 82. Source assets in the core app are unchanged. These images illustrate fictional demo profiles and do not establish a real trainer identity or Third Space employment.

| Demo asset | Source |
| --- | --- |
| `ts-demo-emma-carter.webp` | `src/assets/trainers/maya-chen.webp` |
| `ts-demo-daniel-reed.webp` | `src/assets/trainers/marcus-adebayo.webp` |
| `ts-demo-amira-hassan.webp` | `src/assets/trainers/aliyah-rahman.webp` |
| `ts-demo-lucas-bennett.webp` | `src/assets/trainers/rohan-kapoor.webp` |
| `ts-demo-sophie-morgan.webp` | `src/assets/trainers/leanne-brooks.png` |
| `ts-demo-nathan-cole.webp` | `src/assets/trainers/john-kim.png` |
| `ts-demo-adam-khan.webp` | `src/assets/trainers/aleem-malik.png` |
| `ts-demo-grace-ellis.webp` | `src/assets/trainers/yasmin-okafor.png` |
| `ts-demo-isabel-ross.webp` | Newly generated fictional portrait |
| `ts-demo-theo-parker.webp` | Newly generated fictional portrait |

## Prompt set

The eight existing portraits used identity-preserving edits: convert the entire supplied photograph to strictly neutral black and white while preserving the person's identity, face, expression, hair, clothing, pose, body proportions, original scene, objects, composition and portrait framing. Change only the colour rendering; no tint, retouching, replacement background, new text or border. Return one complete photograph.

The two new portraits used this shared prompt: create one photorealistic editorial portrait for a fictional trainer profile in an isolated premium fitness demo website. Use a softly blurred dark contemporary unbranded gym with understated exercise equipment. Vertical 4:5 composition, subject alone and centred, full head with headroom and space around the shoulders for responsive crops. Soft directional window light, natural skin texture, subtle film grain, restrained contrast, sophisticated but friendly. Strictly neutral black and white; no colour or sepia tint, logos, text, watermark, border, collage or other people. Believable anatomy and hands.

- Isabel: approachable fictional female personal trainer in her early 30s, fair skin with light natural freckles, dark blond hair loosely tied back, athletic build, plain charcoal sports T-shirt and black training leggings; relaxed natural smile, seated on a simple exercise bench with hands resting naturally on her thighs.
- Theo: approachable fictional male personal trainer in his early 30s, fair skin, short slightly wavy brown hair, light stubble, athletic build, plain dark crew-neck sports T-shirt and black training shorts; relaxed natural smile, standing beside a squat rack with arms at ease.

The final encoder uses a neutral grayscale colour space to eliminate tiny residual channel differences in the generated pixels. Every decoded WebP has a maximum RGB channel spread of one level (out of 255); the demo validator allows at most two. Nine images retain a 4:5 frame; Nathan preserves the source's 3:4 frame.
