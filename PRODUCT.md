# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: STEM students self-studying on their own laptops — undergraduates and self-learners working through spatial subjects (anatomy, chemistry, architecture, physics, CS, earth science, astronomy) to prepare for courses.

Classroom use on mixed devices is a confirmed environment, not a confirmed primary job. Do not optimize for teacher-led workflows without a new interview.

## Product Purpose

Spatia teaches subjects that are inherently spatial by letting learners walk around them instead of staring at flat diagrams: a heart, a caffeine molecule, a Gothic vault, a binary tree, an orbital system, and more.

Each interactive 3D module pairs with an AI tutor that knows where the learner is standing. Clicking a labelled structure explains it from the current camera angle in relation to surrounding structures. Guided tours fly the camera stop by stop in pedagogical order. Quizzes ask learners to answer by clicking the model itself.

The studio loop is closed by study tools that reuse the same module canon: an AI syllabus-to-calendar planner with manual tracking, flashcards distilled from module reference notes or built by AI from the syllabus, and generative focus-music loops with a timer for sustained study.

Success means a learner can identify structures in place, describe spatial relationships from any angle, and sustain a study plan through to recall.

## Positioning

A spatial atlas plus a closed study loop in one browser tab — a neighboring product could copy a 3D viewer or a chatbot, but not truthfully copy all of these together:

- viewpoint-aware tutoring where camera position, distance, selection, and recent turns travel with every question and are translated to plain language before reaching the model;
- grounded answers built from per-structure curated datasets (summary plus reference facts) that must name neighbouring structures;
- click-the-model quizzes and camera-flown guided tours (4–8 stops with side and narration);
- syllabus in, scheduled sessions and flashcard decks out, mapped onto the same module inventory;
- everything runnable with no login and no dead ends.

## Operating Context

Environments: a standard browser tab on a laptop; must also stay usable on mixed classroom devices. No native app, no headset, no asset pipeline, no hosted backend.

Core workflows:

- Orbit, zoom, and pick any labelled structure in the studio (`/explore/$sceneId`); tour controls are Space to pause, arrows to step, Esc to end.
- Paste or drop a `.txt` / `.md` syllabus in the planner (`/planner`), set start date, days per week, and minutes per session, generate an AI schedule, then edit by hand: click a day, drag sessions between days, rewrite inline.
- Review the module deck or build an AI syllabus deck in flashcards (`/flashcards`); mark cards known or for later review.
- Pick one of six generative ambient textures in focus music (`/focus-music`); volume slider plus 10 / 25 / 50-minute timer; sound is synthesized live via WebAudio, no files or streaming.
- Dev loop: Node 22+, `npm install --legacy-peer-deps`, `cp .env.example .env` with one provider key, `npm run dev` on `http://localhost:3000`. Providers auto-detect from `ANTHROPIC_API_KEY` / `GOOGLE_GENERATIVE_AI_API_KEY`; override with `AI_PROVIDER` and `AI_MODEL`. API keys never reach the browser.

## Capabilities and Constraints

Capabilities:

- 10 learning modules defined in `src/lib/scenes.ts` with hand-placed hotspots, each carrying category, summary, and key facts plus module tutor brief and camera preset. The heart is a textured anatomical glTF under `public/models/`; the rest are procedural Three.js scenes (React Three Fiber + drei on Three.js, WebGL2).
- Server functions own all model calls: `tutor.functions.ts` (explain in place), `tour.functions.ts` (route planner), `quiz.functions.ts` (click-to-answer builder), `plan.functions.ts` (syllabus to calendar), `deck.functions.ts` (syllabus to flashcards), `ai.server.ts` (provider selection).
- Routes: `/` (atlas index of plates), `/about` (engineering method), `/explore/$sceneId` (studio), `/planner`, `/flashcards`, `/focus-music`.
- No login, no database. Planner tasks, syllabus text, and flashcard decks persist in `localStorage` only.
- Offline guarantee: without an API key every mode falls back to the module's own reference notes, tagged `reference notes` / `local fallback`, so the studio, planner, and cards never dead-end.

Technical constraints:

- Laptop-GPU budget: pixel ratio capped at 2, single 2048px shadow map, one shadow-casting directional light plus small light-former environment, no external HDR downloads.
- Terminology: modules are called Plates (Plate 01 etc.); the 3D explorer is the Studio; labelled pickable parts are structures / hotspots.
- Model licences matter: keep the heart glTF `asset.extras` attribution when swapping models under `public/models/<name>/`.

Explicitly undecided:

- Open: whether the 10-module canon is fixed or expandable, and what bar a new module must meet for hotspot grounding and tutor context.
- Open: no required accessibility standard was established. Current code has keyboard tour controls, focusable calendar days, aria labels, and reduced-motion handling, but no conformance claim.
- Open: no pricing, accounts, collaboration, or deployment target beyond local dev and production serve.

## Brand Commitments

Name Spatia, described as "learn 3D subjects in 3D" and "a spatial learning atlas". Atlas / Plates numbering is binding language — do not rename modules to courses or lessons without approval.

Voice is precise and pedagogical: correct domain terminology (e.g. superior/inferior, anterior/posterior in cardiac context), plain-language viewpoint descriptions ("rear, from above, medium range"), short narrations per tour stop.

Assets on hand: procedural scene components in `src/components/scene/`, `StudioView.tsx` and `TutorPanel.tsx`, module content in `src/lib/scenes.ts`, heart model files in `public/models/`. Team: Ayush Kumar (3D scenes and interaction) and Harsh Pratap (AI context pipeline and application architecture). Built for the SPEED October AI Challenge on Devpost.

No binding color, type, or style direction was given in init. Do not treat the current theme as a product commitment.

## Evidence on Hand

Real: 10 modules with curated hotspot datasets in `src/lib/scenes.ts` (795 lines); rendering and interaction code in `src/components/scene/`; tutor / tour / quiz / plan / deck server functions in `src/lib/`; runnable routes listed above; `.env.example` provider contract; `README.md` setup and module-swap instructions; `docs/SUBMISSION_CHECKLIST.md` (currently unchecked).

Absent — future work must not fabricate: testimonials, customers, case studies, press, benchmarks, pricing, licensing beyond the heart model extras block, demo video, screenshots / cover image, live demo URL performance claims.

## Product Principles

1. Spatial first — every explanation is anchored to where the learner stands and names what surrounds the selection.
2. Never dead-end — reference-note and local fallbacks beat errors when keys, models, or networks are missing.
3. Same scene, same truth — tutor, tours, quizzes, planner, and cards all reuse the module canon; never invent structures, facts, or customers.
4. Close the study loop — learning, scheduling, recall, and focus live together so a syllabus becomes sessions, cards, and sustained attention.
5. Lightweight runs anywhere — a browser tab on a laptop GPU is the bar; no setup, login, or special hardware may become required.
