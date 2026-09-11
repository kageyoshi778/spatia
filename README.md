# Spatia — learn 3D subjects in 3D

Textbooks flatten things that are inherently spatial. A heart, a molecule, a Gothic vault, a
binary tree: you understand them by walking around them, not by staring at a diagram.

Spatia renders interactive 3D learning modules in the browser and pairs each one with an AI
tutor that knows **where you are standing**. Click any labelled structure and the tutor
explains it from your current camera angle, in relation to the structures around it. Start a
guided tour and the tutor plans a route and flies the camera stop by stop. Take a quiz and
you answer by clicking the model itself.

## Modules

| Plate | Module | Subject |
| --- | --- | --- |
| 01 | The Human Heart | Anatomy & Physiology |
| 02 | Caffeine, C₈H₁₀N₄O₂ | Molecular Chemistry |
| 03 | Gothic Cathedral Bay | Architectural History |
| 04 | Orbital Mechanics | Astronomy |
| 05 | Tectonic Boundaries | Earth Science |
| 06 | Mechanical Gear Train | Mechanical Engineering |
| 07 | Binary Search Tree | Computer Science |
| 08 | DNA Double Helix | Molecular Biology |
| 09 | Wave Interference | Physics |
| 10 | Ionic Crystal Lattice | Chemistry |

The heart is a textured anatomical glTF model. The other modules are procedural Three.js
scenes. Every module has hand-placed hotspots, each carrying a summary and reference facts
that ground the tutor.

## What the tutor does

- **Explain in place.** Click a structure. The module id, the structure, the live camera
  viewpoint and the last few turns go to a server function, which builds a grounded prompt and
  returns an answer that names at least one neighbouring structure.
- **Guided tour.** The model plans a 4–8 stop route through the module in a pedagogical order,
  picks the side to view each stop from, and writes a short narration per stop. The studio flies
  the camera and reads the narration into the panel. Space pauses, arrows step, Esc ends.
- **Quiz.** The model writes "click the structure that…" questions that avoid naming the
  answer. You answer by clicking the model or pressing a number. The camera flies to the correct
  structure and an explanation appears.
- **No key, still works.** Without an API key every mode falls back to the module's own
  reference notes, marked with a small "reference notes" tag, so the studio never dead-ends.

## Running it locally

Requires Node 22+.

```sh
git clone https://github.com/kageyoshi778/spatia.git spatia
cd spatia
npm install --legacy-peer-deps
cp .env.example .env      # paste in ONE API key, see below
npm run dev               # http://localhost:3000
```

| Provider | Env var | Get a key |
| --- | --- | --- |
| Anthropic | `ANTHROPIC_API_KEY` | https://console.anthropic.com/ |
| Google Gemini | `GOOGLE_GENERATIVE_AI_API_KEY` | https://aistudio.google.com/apikey |

The app auto-detects whichever key is present. Override with `AI_PROVIDER` and `AI_MODEL`.

```sh
npm run typecheck   # tsc --noEmit
npm run build       # production build
npm run start       # serve the production build
```

## Swapping a module to a real 3D model

1. Put the model under `public/models/<name>/` (glTF or GLB, textures alongside).
2. In `src/components/scene/SceneCanvas.tsx`, render `<GltfModel url="/models/<name>/file.gltf" fit={5} />`
   for that module. `GltfModel` centres the model and scales its longest side to `fit`.
3. Re-place that module's hotspot positions in `src/lib/scenes.ts`. In dev, open the studio with
   `?cam=0,0,8` (front), `?cam=8,0,0` (side) or `?cam=0,8,0.01` (top) to read off coordinates.

Keep model licences in mind. The heart model's author and licence are embedded in its glTF
`asset.extras` block.

## Stack

React 19, TypeScript, Vite, TanStack Start + Router, React Three Fiber + drei on Three.js,
Vercel AI SDK (Anthropic or Google), Tailwind CSS v4. No hosted backend, no login, no database.

## Project layout

```
src/
  lib/scenes.ts             module content: hotspots, facts, tutor context, camera presets
  lib/tutor.functions.ts    explain-in-place server function
  lib/tour.functions.ts     guided-tour planner
  lib/quiz.functions.ts     quiz builder
  lib/ai.server.ts          provider selection from env
  components/scene/         GltfModel loader, procedural models, canvas, camera rig, markers
  components/StudioView.tsx the studio: index, viewport, tour bar, quiz card
  components/TutorPanel.tsx tutor chat and narration
  routes/                   home (atlas), about, explore/$sceneId
public/models/              3D model files
```

## Team

Ayush Kumar and Harsh Pratap.

Built for the SPEED October AI Challenge on Devpost.
