---
target: studio
total_score: 21
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 3
target_identity: "file:/mnt/g/devpost-hackathon/src/components/StudioView.tsx"
target_fingerprint: "sha256:cab66789c8bfcf4ff11f9b8a235df677d5507527332e3c47e2a6325ad161c21c"
target_path: /mnt/g/devpost-hackathon/src/components/StudioView.tsx
timestamp: 2026-09-11T17-00-41Z
slug: src-components-studioview-tsx
closed: true
---
Method: dual-agent (A: ses_f6e98c99dffelYn7JrosXVuqf3 · B: ses_f6e98c981ffeSUPMmS8TFnuymV)

## Design Health Score — Studio (`src/components/StudioView.tsx`, `/explore/$sceneId`)

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | 3D load `Suspense fallback={null}` = blank abyss; camera flight no progress; header error `hidden md:inline` invisible on tablets/phones |
| 2 | Match System / Real World | 2 | Strong Plates/Structures language, broken by `4.2u · az 123° · el 12°` telemetry, `Tighten the helix` inversion, `Second wave source` vs `Coherent Source B` |
| 3 | User Control and Freedom | 2 | Good Esc/Space/arrows/Reset, but tour wipes quiz silently, empty-orbit clears selection, Reset loses viewpoint, auto-advance yanks camera |
| 4 | Consistency and Standards | 3 | Best row: panel/chamber/label-mono system holds; breaks on hotspot-card duplication, badge palette drift, 1–9 only |
| 5 | Error Prevention | 2 | Busy/picked guards good; free-explore miss-click destroys context, End discards progress, tour-pause on select unsignalled |
| 6 | Recognition Rather Than Recall | 2 | List↔badge↔key triple-redundant is excellent; quiz inverts it — prompt held in memory while hunting identical dots |
| 7 | Flexibility and Efficiency | 2 | 1–9/Space/arrows/Orbit/toggles good; 3D markers mouse-only, Structures `hidden lg:flex` = zero efficiency <1024px |
| 8 | Aesthetic and Minimalist Design | 3 | Chamber-vs-paper hierarchy restrained, hover-only labels; overlay pile-up on 13" laptop covers markers |
| 9 | Error Recovery | 1 | Header error no retry, tutor `isError` no retry, system-speak copy, ModuleNotFound dumps 10 titles |
| **Total** | | **21/40** | **Acceptable — significant improvements needed before users are happy** |
| 10 | Help and Documentation | 2 | Good empty-state tutor + bottom hint + 3 suggestions; no tour/quiz primer, no viewpoint-awareness explainer |

## Design Specificity Verdict

**Grounded in Spatia, with generic seams.**

What could only be Spatia: three-pane atlas grammar (paper Structures index / abyss chamber / Tutor), Instrument Serif + mono eyebrow/label system, numbered list↔marker↔key↔camera↔tutor↔tour↔quiz bound to same canon in `src/lib/scenes.ts`, lean-in camera rig (`SceneCanvas.tsx:67-71,102-106`), click-the-model quiz with no multiple choice, tour `front/rear/left/right/above` flight, per-scene toggles, `reference notes` never-dead-end badges.

What is generic: header (`Guided tour / Quiz / Orbit / Reset` + Atlas back) could be any viewer — no plate number, no progress, no loop-closing links to planner/cards/focus. Tutor shows engineering telemetry instead of promised plain language. 4 of 10 modules have zero Render options, collapsing specificity there.

**Deterministic scan:** `impeccable detect --json` over 6 Studio files (StudioView, explore route, TutorPanel, SceneCanvas, Hotspot3D, ScenePreview) → exit 0, 0 primary, 0 advisory. No masking (`ignoreRules/Files/Values: none`, 0 inline-disables). Prior `src/styles.css:161` grid-backdrop advisory touches only `src/routes/index.tsx:62` home hero, 0 hits in Studio — not relevant here. Clean-but-thin: TSX regex mode with no browser rendering.

**Visual overlays:** No browser automation available in this environment (no chrome/playwright, no dev server listening), no injection attempted — no user-visible overlay exists. Fallback is static evidence below.

## Overall Impression

First orbit and first pick feel magical — damped orbit, halo markers, lean-in camera + grounded brief. Everything around it leaks: blank load, whispered errors, telemetry jargon, overlays covering the model, index gone on tablets, tour that auto-plays and wipes quiz, quiz that ends in a flat `3/5`. Biggest opportunity: make the chrome get out of the way and make status/recovery explicit, so the spatial teaching can carry.

## What's Working

1. **Triple-redundant picking that teaches place.** List + in-scene badge + keyboard share one numbering (01–08). Dimming non-active (`Hotspot3D.tsx:dimmed`) + framing neighbourhood not surface keeps surrounding structures visible — the core job made tangible.
2. **Camera respects agency.** 0.9s eased flight from current direction + instant cancel on interact, Orbit toggle + Reset + Esc/Space/arrows grammar without a manual.
3. **Quiz dares to be spatial.** Click-the-model (not A/B/C/D) + reveal true hotspot + offline `reference` fallback so quiz never dead-ends — real differentiator, honestly built.

## Priority Issues

- **[P0] Structures index vanishes below `lg` — breaks Operate on classroom devices**
  **Why it matters:** Phones/tablets/small laptops lose the only recognisable index; must hunt 9px badges with no names. Contradicts PRODUCT.md mixed-device usability.
  **Fix:** Bottom sheet / collapsible drawer + persistent count, not `hidden lg:flex` (`StudioView.tsx:296`). Keep `order-2` content reachable, focusable, `aria-current` on active.
  **Suggested command:** /impeccable adapt

- **[P1] Viewport overlay pile-up covers the thing being learned**
  **Why it matters:** Tagline top-left + TourBar/QuizCard `w-80` top-right + hotspot card `bottom-4 left-4 right-4` + hint can co-exist on 13" laptop, occluding markers on small models (caffeine, lattice, DNA).
  **Fix:** Dock quiz/tour status to header or bottom strip; collapse tagline once interacting; make hotspot card dismissible/minimisable and selectable (`pointer-events-none` currently blocks copy).
  **Suggested command:** /impeccable layout

- **[P1] Raw telemetry instead of plain-language viewpoint**
  **Why it matters:** `4.2u · az 123° · el 12°` (`TutorPanel.tsx:118-126`) violates brand voice, adds working-memory load, exposes context PRODUCT.md says is translated before reaching model.
  **Fix:** Show "Medium range · rear, from above" in UI, hide numbers behind tooltip. Fix toggle copy (`Tighten the helix`, `Second wave source`) and `reference` vs `reference notes` inconsistency.
  **Suggested command:** /impeccable clarify

- **[P1] Errors are whispered and unrecoverable — violates Never dead-end**
  **Why it matters:** Header error `hidden md:inline`, tutor error no Retry, blank-canvas load no state. Failed planTour/buildQuiz/tutor leaves spinner → tiny red text → dead end.
  **Fix:** Inline error card in relevant pane with Retry + explicit "Use reference notes" action; skeleton for 3D load (`Suspense fallback={null}` today); rewrite `ModuleNotFound` and `returned no stops` copy.
  **Suggested command:** /impeccable harden

- **[P2] Tour auto-advance + mode-wipe creates learned helplessness**
  **Why it matters:** 6–14s timer yanks camera mid-inspection; starting quiz kills tour silently and vice versa; manual select pauses tour without signal (`StudioView.tsx:190`).
  **Fix:** Pause-on-interact with explicit "Paused — Resume", preserve mode state or confirm, expose stop list to scrub, respect `prefers-reduced-motion` for CameraRig flights/auto-advance.
  **Suggested command:** /impeccable polish

## Persona Red Flags

- **Alex (Power User):** No keyboard path to 3D markers themselves (canvas unfocusable, `Html pointerEvents:none`); Structures gone <lg removes bulk scan; tour dots `w-3` unscrubbable; Reset loses viewpoint with no undo. Can't complete efficiently without mouse hunting.
- **Sam (Accessibility-Dependent):** Markers mouse-only (`onClick/onPointerOver` mesh, no roving tabindex, no focus ring, no marker ARIA); Canvas no role/label; structure buttons no `aria-current`; input has `outline-none` with only `focus:border-primary/70`, zero `focus-visible:`; small-muted combos (`text-[10px] text-muted-foreground`, `ink-foreground/55`, `opacity-45` dimmed) unmeasured but risky; reduced-motion doesn't stop flights/auto-play; live narration/quiz feedback no live region.
- **Casey (Distracted Mobile / Classroom tablet):** Index hidden, 28px TourBar buttons (`h-7 w-7`) and 9–10px badges below 44px target, error hidden on mobile, hotspot card + QuizCard cover model, auto-advance not adjustable for discussion, no present/pause-all mode. Most likely to abandon on shared devices.
- **STEM self-learner on laptop (project-specific, primary):** Core loop works, but quiz forces memory-hold while orbiting (prompt only in floating card), hotspot facts unselectable for notes, `3/5` end offers no bridge to flashcards/planner/focus-music, render toggles unexplained conceptually. Will learn, won't close study loop without leaving Studio.

Evidence notes (Assessment B static): keyboard map `StudioView.tsx:195-221` (Esc/Space/arrows/1–9, skips only INPUT/TEXTAREA); ARIA present only on TourBar prev/play/next/end + Send; touch coded sizes 28px/36px/9–11px text, no 44px mins; responsive `grid-cols-1 lg:grid-cols-[250px_1fr_360px]`, `hidden lg:flex`, `min-h-[45vh]/[42vh]`, `absolute right-4 top-4 w-80` cards.

## Minor Observations

- Hotspot card `pointer-events-none` blocks text selection — hostile to study.
- Atlas back label `hidden sm:inline`, header error `hidden md:inline` — most-needed small-screen elements hidden.
- Hint hardcodes `1–{min(9,…)}`; 10-hotspot future module silently breaks keyboard.
- Active `#036564` on abyss `#031634` low-contrast at small sizes; dimmed `opacity-45` risky on projectors.
- Facts pills compete with summary; consider 2-line clamp + expand.
- Tour/quiz state not reflected in `document.title`; narration relies on visual append + smooth scroll.
- `?cam=` hotspot-authoring override DEV-gated but undiscoverable — needs docs.

## Questions to Consider

- What if telemetry never appeared in UI at all — only "behind the heart, looking down at posterior atrium"?
- What if tour were a scrubbable plate margin (Stop 3/6 timeline you own) not auto-play video?
- What if quiz had no floating card — only Tutor whisper "Find the structure that… — click it"?
- What should the end remember: `3/5` number, or "You can now find mitral valve from any angle — make 3 cards / schedule 20 min tomorrow"?
