import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Layers,
  ListChecks,
  Loader2,
  Orbit,
  Pause,
  Play,
  RotateCcw,
  Route as RouteIcon,
  Sliders,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { SceneCanvas, type Viewpoint } from "./scene/SceneCanvas";
import { TutorPanel, type Narration } from "./TutorPanel";
import { buildQuiz, type QuizSet } from "@/lib/quiz.functions";
import type { SceneModule } from "@/lib/scenes";
import { planTour, type TourPlan, type TourStop } from "@/lib/tour.functions";

const SCENE_TOGGLES: Record<string, { key: string; label: string }[]> = {
  cardiac: [{ key: "pulse", label: "Cardiac cycle animation" }],
  caffeine: [{ key: "hydrogens", label: "Show hydrogen atoms" }],
  cathedral: [{ key: "vault", label: "Show rib vault" }],
  dna: [{ key: "unwind", label: "Tight helix coil" }],
  "wave-interference": [{ key: "twoSources", label: "Coherent Source B (second source)" }],
  lattice: [{ key: "bonds", label: "Show ionic bonds" }],
};

/** Camera approach direction for each side the tour planner can ask for. */
const LOOK_FROM: Record<TourStop["lookFrom"], [number, number, number]> = {
  front: [0.15, 0.35, 1],
  rear: [-0.15, 0.35, -1],
  left: [-1, 0.35, 0.2],
  right: [1, 0.35, 0.2],
  above: [0.2, 1, 0.35],
};

type Tour = { plan: TourPlan; index: number; playing: boolean };
type Quiz = { set: QuizSet; index: number; picked: string | null; correct: number };

export function StudioView({ scene }: { scene: SceneModule }) {
  const plan = useServerFn(planTour);
  const quizFn = useServerFn(buildQuiz);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [viewpoint, setViewpoint] = useState<Viewpoint | null>(null);
  const [autoRotate, setAutoRotate] = useState(false);
  const [options, setOptions] = useState<Record<string, boolean>>(() =>
    Object.fromEntries((SCENE_TOGGLES[scene.id] ?? []).map((t) => [t.key, true])),
  );
  const [key, setKey] = useState(0);

  const [tour, setTour] = useState<Tour | null>(null);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [busy, setBusy] = useState<"tour" | "quiz" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastFailed, setLastFailed] = useState<"tour" | "quiz" | null>(null);
  const [approach, setApproach] = useState<[number, number, number] | null>(null);
  const [narration, setNarration] = useState<Narration | null>(null);
  const [showStructures, setShowStructures] = useState(false);
  const [isPreparing, setIsPreparing] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  useEffect(() => {
    if (viewpoint) {
      setIsPreparing(false);
      return;
    }
    const id = setTimeout(() => setIsPreparing(false), 2200);
    return () => clearTimeout(id);
  }, [viewpoint]);

  const hotspot = useMemo(
    () => scene.hotspots.find((h) => h.id === activeId) ?? null,
    [scene, activeId],
  );
  const stop = tour ? tour.plan.stops[tour.index] : undefined;
  const question = quiz ? quiz.set.questions[quiz.index] : undefined;
  const quizDone = quiz ? quiz.index >= quiz.set.questions.length : false;

  /* ---------------- Guided tour ---------------- */

  async function startTour() {
    if (busy) return;
    if (quiz) {
      setError(
        "End the quiz to start a guided tour — your quiz progress is kept until you end it.",
      );
      return;
    }
    setError(null);
    setLastFailed(null);
    setBusy("tour");
    try {
      const p = await plan({ data: { sceneId: scene.id } });
      if (!p.stops.length) throw new Error("The tour planner returned no stops.");
      setNarration({
        key: `intro-${Date.now()}`,
        focus: "Guided tour",
        text: p.intro,
        offline: p.offline,
      });
      setTour({ plan: p, index: 0, playing: !reducedMotion });
    } catch (e) {
      setError((e as Error).message);
      setLastFailed("tour");
    } finally {
      setBusy(null);
    }
  }

  function endTour() {
    setTour(null);
    setApproach(null);
    setActiveId(null);
  }

  // Each stop: fly the camera from the planned side and hand the narration to the tutor panel.
  useEffect(() => {
    if (!tour || !stop) return;
    setActiveId(stop.hotspotId);
    setApproach(LOOK_FROM[stop.lookFrom]);
    setNarration({
      key: `${tour.index}-${stop.hotspotId}`,
      focus: `Stop ${tour.index + 1} of ${tour.plan.stops.length} · ${stop.title}`,
      text: stop.narration,
      offline: tour.plan.offline,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tour?.index, stop?.hotspotId]);

  // Auto-advance while playing; reading time scales with narration length.
  // Disabled when the OS asks for reduced motion — the learner steps manually.
  useEffect(() => {
    if (!tour?.playing || !stop || reducedMotion) return;
    const words = stop.narration.split(/\s+/).length;
    const ms = Math.min(14000, Math.max(6000, 2500 + words * 320));
    const id = setTimeout(() => {
      setTour((t) =>
        t
          ? t.index < t.plan.stops.length - 1
            ? { ...t, index: t.index + 1 }
            : { ...t, playing: false }
          : t,
      );
    }, ms);
    return () => clearTimeout(id);
  }, [tour?.index, tour?.playing, stop, reducedMotion]);

  const stepTour = (delta: number) =>
    setTour((t) =>
      t
        ? {
            ...t,
            index: Math.min(t.plan.stops.length - 1, Math.max(0, t.index + delta)),
            playing: false,
          }
        : t,
    );

  const jumpTour = (index: number) => setTour((t) => (t ? { ...t, index, playing: false } : t));

  /* ---------------- Quiz ---------------- */

  async function startQuiz() {
    if (busy) return;
    if (tour) {
      setError("End the tour to start a quiz — your tour place is kept until you end it.");
      return;
    }
    setError(null);
    setLastFailed(null);
    setBusy("quiz");
    setApproach(null);
    setActiveId(null);
    try {
      const set = await quizFn({ data: { sceneId: scene.id, count: 5 } });
      if (!set.questions.length) throw new Error("The quiz builder returned no questions.");
      setQuiz({ set, index: 0, picked: null, correct: 0 });
    } catch (e) {
      setError((e as Error).message);
      setLastFailed("quiz");
    } finally {
      setBusy(null);
    }
  }

  function answer(id: string) {
    if (!quiz || !question || quiz.picked) return;
    const ok = id === question.answerHotspotId;
    setQuiz({ ...quiz, picked: id, correct: quiz.correct + (ok ? 1 : 0) });
    setActiveId(question.answerHotspotId);
  }

  function nextQuestion() {
    setQuiz((q) => (q ? { ...q, index: q.index + 1, picked: null } : q));
    setActiveId(null);
  }

  function endQuiz() {
    setQuiz(null);
    setActiveId(null);
  }

  /* ---------------- Selection + keyboard ---------------- */

  function select(id: string) {
    if (!id) {
      // Orbit miss-clicks must not wipe guided context — only free explore clears.
      if (quiz && !quizDone) return;
      if (tour) return;
      setActiveId(null);
      return;
    }
    if (quiz && !quizDone) {
      answer(id);
      return;
    }
    if (tour) setTour((t) => (t ? { ...t, playing: false } : t));
    setApproach(null);
    setActiveId(id);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (
        el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.tagName === "SELECT" ||
          el.isContentEditable)
      )
        return;
      if (e.key === "Escape") {
        if (tour) endTour();
        else if (quiz) endQuiz();
        else setActiveId(null);
        return;
      }
      if (tour) {
        if (e.key === " ") {
          e.preventDefault();
          setTour((t) => (t ? { ...t, playing: !t.playing } : t));
          return;
        }
        if (e.key === "ArrowRight") return stepTour(1);
        if (e.key === "ArrowLeft") return stepTour(-1);
      }
      const n = Number(e.key);
      const target = n >= 1 && n <= 9 ? scene.hotspots[n - 1] : undefined;
      if (target) select(target.id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, tour, quiz, question]);

  const toggles = SCENE_TOGGLES[scene.id] ?? [];

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border bg-background px-4 py-3 md:px-6">
        <div className="flex min-w-0 items-center gap-4">
          <Link
            to="/"
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            <span>Atlas</span>
          </Link>
          <div className="h-6 w-px bg-border" aria-hidden />
          <div className="min-w-0">
            <h1 className="truncate font-display text-xl leading-none md:text-2xl">
              {scene.title}
            </h1>
            <p className="label-mono mt-1 truncate">
              {scene.subject} · {scene.level}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {error ? (
            <span
              title={error}
              role="alert"
              className="max-w-[46vw] truncate text-xs text-destructive md:max-w-xs"
            >
              {error}
            </span>
          ) : null}
          {tour ? (
            <HeaderButton onClick={endTour} active>
              <X className="h-3.5 w-3.5" /> End tour
            </HeaderButton>
          ) : (
            <HeaderButton onClick={startTour} disabled={busy !== null}>
              {busy === "tour" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RouteIcon className="h-3.5 w-3.5" />
              )}{" "}
              Guided tour
            </HeaderButton>
          )}
          {quiz ? (
            <HeaderButton onClick={endQuiz} active>
              <X className="h-3.5 w-3.5" /> End quiz
            </HeaderButton>
          ) : (
            <HeaderButton onClick={startQuiz} disabled={busy !== null}>
              {busy === "quiz" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ListChecks className="h-3.5 w-3.5" />
              )}{" "}
              Quiz
            </HeaderButton>
          )}
          <div className="mx-1 h-6 w-px bg-border" />
          <HeaderButton onClick={() => setAutoRotate((v) => !v)} active={autoRotate}>
            <Orbit className="h-3.5 w-3.5" /> Orbit
          </HeaderButton>
          <HeaderButton
            onClick={() => {
              setKey((k) => k + 1);
              setActiveId(null);
              setApproach(null);
            }}
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </HeaderButton>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 p-3 lg:grid-cols-[250px_1fr_360px] md:p-4">
        {/* Structure index — desktop */}
        <aside
          aria-label="Structures"
          className="panel order-2 hidden min-h-0 flex-col overflow-hidden lg:order-1 lg:flex"
        >
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <Layers className="h-4 w-4 text-primary" aria-hidden />
            <span className="font-display text-lg">Structures</span>
            <span className="label-mono ml-auto">{scene.hotspots.length}</span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {scene.hotspots.map((h, i) => (
              <button
                key={h.id}
                onClick={() => select(h.id)}
                aria-current={activeId === h.id ? "true" : undefined}
                aria-label={`Structure ${i + 1}: ${h.name}`}
                className={`mb-0.5 min-h-[44px] w-full rounded-md px-3 py-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                  activeId === h.id ? "bg-primary/10 text-primary" : "hover:bg-secondary"
                }`}
              >
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-[10px] text-muted-foreground" aria-hidden>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="text-sm font-medium">{h.name}</span>
                </div>
                <span className="mt-0.5 block pl-6 text-[11px] text-muted-foreground">
                  {h.category}
                </span>
              </button>
            ))}
          </div>
          {toggles.length > 0 ? (
            <div className="border-t border-border px-4 py-3">
              <div className="mb-2 flex items-center gap-2">
                <Sliders className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                <span className="label-mono">Render options</span>
              </div>
              {toggles.map((t) => (
                <label
                  key={t.key}
                  className="mb-1.5 flex min-h-[32px] cursor-pointer items-center gap-2 text-xs text-muted-foreground"
                >
                  <input
                    type="checkbox"
                    checked={options[t.key] ?? false}
                    onChange={(e) => setOptions((o) => ({ ...o, [t.key]: e.target.checked }))}
                    className="h-4 w-4 accent-[var(--primary)]"
                  />
                  {t.label}
                </label>
              ))}
            </div>
          ) : null}
        </aside>

        {/* Structure index — mobile / tablet drawer */}
        <div className="panel order-2 lg:hidden">
          <button
            onClick={() => setShowStructures((v) => !v)}
            aria-expanded={showStructures}
            aria-controls="mobile-structures"
            className="flex min-h-[44px] w-full items-center gap-2 px-4 py-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <Layers className="h-4 w-4 text-primary" aria-hidden />
            <span className="font-display text-lg">Structures</span>
            <span className="label-mono ml-auto mr-2">
              {activeId
                ? `${scene.hotspots.findIndex((h) => h.id === activeId) + 1} / ${scene.hotspots.length}`
                : `${scene.hotspots.length}`}
            </span>
            <ChevronRight
              className={`h-4 w-4 transition-transform ${showStructures ? "rotate-90" : ""}`}
              aria-hidden
            />
          </button>
          {showStructures ? (
            <div
              id="mobile-structures"
              className="max-h-64 overflow-y-auto border-t border-border p-2"
            >
              {scene.hotspots.map((h, i) => (
                <button
                  key={h.id}
                  onClick={() => {
                    select(h.id);
                    setShowStructures(false);
                  }}
                  aria-current={activeId === h.id ? "true" : undefined}
                  className={`mb-0.5 min-h-[44px] w-full rounded-md px-3 py-2.5 text-left ${
                    activeId === h.id ? "bg-primary/10 text-primary" : "hover:bg-secondary"
                  }`}
                >
                  <span className="font-mono text-[10px] text-muted-foreground" aria-hidden>
                    {String(i + 1).padStart(2, "0")} ·{" "}
                  </span>
                  <span className="text-sm font-medium">{h.name}</span>
                  <span className="ml-2 text-[11px] text-muted-foreground">{h.category}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {/* Viewport */}
        <section
          aria-label={`${scene.title} 3D viewport`}
          className="chamber relative order-1 min-h-[45vh] overflow-hidden lg:order-2"
        >
          <SceneCanvas
            key={key}
            scene={scene}
            activeHotspot={activeId}
            approach={reducedMotion ? null : approach}
            onSelectHotspot={select}
            onViewpoint={setViewpoint}
            options={options}
            autoRotate={autoRotate && !tour && !reducedMotion}
          />
          {isPreparing ? (
            <div
              role="status"
              className="pointer-events-none absolute inset-0 flex items-center justify-center bg-ink/60"
            >
              <p className="flex items-center gap-2 text-sm text-ink-foreground/85">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Preparing {scene.title}…
              </p>
            </div>
          ) : null}
          {!hotspot && !tour && !quiz ? (
            <div className="pointer-events-none absolute left-4 top-4 max-w-xs">
              <p className="label-mono text-ink-foreground/55">{scene.accentLabel} module</p>
              <p className="mt-1 font-display text-base italic text-ink-foreground/85">
                {scene.tagline}
              </p>
            </div>
          ) : null}

          {tour && stop ? (
            <TourBar
              index={tour.index}
              total={tour.plan.stops.length}
              title={stop.title}
              playing={tour.playing}
              reducedMotion={reducedMotion}
              onPrev={() => stepTour(-1)}
              onNext={() => stepTour(1)}
              onJump={jumpTour}
              onToggle={() => setTour((t) => (t ? { ...t, playing: !t.playing } : t))}
              onEnd={endTour}
            />
          ) : null}

          {quiz ? (
            <QuizCard
              quiz={quiz}
              scene={scene}
              onNext={nextQuestion}
              onAgain={startQuiz}
              onClose={endQuiz}
            />
          ) : null}

          {error && lastFailed ? (
            <div
              role="alert"
              className="absolute bottom-4 left-1/2 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-md border border-destructive/50 bg-background/95 p-4 shadow-lg"
            >
              <p className="text-sm font-medium text-foreground">Something didn’t load.</p>
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{error}</p>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => (lastFailed === "tour" ? startTour() : startQuiz())}
                  className="min-h-[36px] rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  Retry
                </button>
                <button
                  onClick={() => {
                    setError(null);
                    setLastFailed(null);
                  }}
                  className="min-h-[36px] rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  Use reference notes
                </button>
              </div>
            </div>
          ) : null}

          {hotspot && !(quiz && !quizDone && !quiz.picked) && !(error && lastFailed) ? (
            <div className="absolute bottom-4 left-4 right-4 rounded-md border border-border bg-background/95 p-4 shadow-lg md:max-w-md">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="eyebrow">{hotspot.category}</p>
                  <p className="mt-1 font-display text-2xl leading-none">{hotspot.name}</p>
                </div>
                <button
                  onClick={() => setActiveId(null)}
                  aria-label={`Dismiss ${hotspot.name} details`}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>
              <p className="mt-2 max-h-20 overflow-y-auto text-xs leading-relaxed text-muted-foreground">
                {hotspot.summary}
              </p>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {hotspot.facts.map((f) => (
                  <li
                    key={f}
                    className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground"
                  >
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ) : !quiz && !tour && !(error && lastFailed) ? (
            <p className="pointer-events-none absolute bottom-4 left-4 text-xs text-ink-foreground/55">
              Drag to orbit · scroll to zoom · click a marker or press 1–
              {Math.min(9, scene.hotspots.length)} · Esc clears
            </p>
          ) : null}
        </section>

        {/* Tutor */}
        <aside className="order-3 min-h-[42vh] lg:min-h-0">
          <TutorPanel
            scene={scene}
            hotspot={hotspot}
            viewpoint={viewpoint}
            narration={narration}
            quiet={tour !== null || quiz !== null}
          />
        </aside>
      </div>
    </div>
  );
}

function HeaderButton({
  children,
  onClick,
  active = false,
  disabled = false,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active ? "true" : undefined}
      aria-label={label}
      className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-md border px-2.5 py-2 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50 ${
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function TourBar({
  index,
  total,
  title,
  playing,
  reducedMotion,
  onPrev,
  onNext,
  onJump,
  onToggle,
  onEnd,
}: {
  index: number;
  total: number;
  title: string;
  playing: boolean;
  reducedMotion: boolean;
  onPrev: () => void;
  onNext: () => void;
  onJump: (index: number) => void;
  onToggle: () => void;
  onEnd: () => void;
}) {
  const btn =
    "inline-flex h-9 w-9 items-center justify-center rounded-md text-foreground/80 hover:bg-secondary hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-30";
  return (
    <div
      role="group"
      aria-label={`Guided tour, stop ${index + 1} of ${total}${playing ? "" : ", paused"}`}
      className="absolute left-4 right-4 top-4 flex flex-wrap items-center gap-1 rounded-md border border-border bg-background/95 p-1.5 shadow-lg md:left-auto md:right-4 md:max-w-md"
    >
      <button className={btn} onClick={onPrev} disabled={index === 0} aria-label="Previous stop">
        <ChevronLeft className="h-4 w-4" aria-hidden />
      </button>
      <button
        className={btn}
        onClick={onToggle}
        aria-label={playing ? "Pause tour" : "Resume tour"}
      >
        {playing ? (
          <Pause className="h-4 w-4" aria-hidden />
        ) : (
          <Play className="h-4 w-4" aria-hidden />
        )}
      </button>
      <button className={btn} onClick={onNext} disabled={index >= total - 1} aria-label="Next stop">
        <ChevronRight className="h-4 w-4" aria-hidden />
      </button>
      <div className="mx-2 min-w-0 flex-1 basis-32">
        <p className="label-mono">
          Stop {index + 1} / {total}
          {!playing ? " · Paused" : ""}
          {reducedMotion ? " · Manual" : ""}
        </p>
        <p title={title} className="truncate text-sm">
          {title}
        </p>
      </div>
      <div className="mx-1 flex gap-1" role="group" aria-label="Jump to a stop">
        {Array.from({ length: total }, (_, i) => (
          <button
            key={i}
            onClick={() => onJump(i)}
            aria-label={`Go to stop ${i + 1}`}
            aria-current={i === index ? "true" : undefined}
            className={`h-4 min-w-[20px] rounded-full px-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${i <= index ? "bg-primary" : "bg-border"}`}
          >
            <span className="sr-only">{i + 1}</span>
          </button>
        ))}
      </div>
      <button className={btn} onClick={onEnd} aria-label="End tour">
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}

function QuizCard({
  quiz,
  scene,
  onNext,
  onAgain,
  onClose,
}: {
  quiz: Quiz;
  scene: SceneModule;
  onNext: () => void;
  onAgain: () => void;
  onClose: () => void;
}) {
  const total = quiz.set.questions.length;
  const q = quiz.set.questions[quiz.index];

  if (!q) {
    return (
      <div
        role="status"
        className="absolute bottom-4 left-4 right-4 rounded-md border border-border bg-background/95 p-5 shadow-lg md:bottom-auto md:left-auto md:right-4 md:top-4 md:w-80"
      >
        <p className="eyebrow">Quiz complete</p>
        <p className="mt-2 font-display text-4xl">
          {quiz.correct} <span className="text-muted-foreground">/ {total}</span>
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          {quiz.correct === total
            ? "Every structure placed correctly — you can find each one in place."
            : quiz.correct >= total / 2
              ? "Solid. Walk the model again and retry the ones you missed."
              : "Take the guided tour, then try again — the tour flies you to each structure in order."}
        </p>
        <div className="mt-4 flex gap-2">
          <button
            onClick={onAgain}
            className="min-h-[36px] rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            New quiz
          </button>
          <button
            onClick={onClose}
            className="min-h-[36px] rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const answered = quiz.picked !== null;
  const correct = quiz.picked === q.answerHotspotId;
  const answerName = scene.hotspots.find((h) => h.id === q.answerHotspotId)?.name ?? "";
  const pickedName = scene.hotspots.find((h) => h.id === quiz.picked)?.name ?? "";

  return (
    <div
      role="group"
      aria-label={`Quiz question ${quiz.index + 1} of ${total}`}
      aria-live="polite"
      className="absolute bottom-4 left-4 right-4 rounded-md border border-border bg-background/95 p-5 shadow-lg md:bottom-auto md:left-auto md:right-4 md:top-4 md:w-80"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="eyebrow">
          Question {quiz.index + 1} of {total}
        </p>
        {quiz.set.offline ? (
          <span
            title="No AI key is configured, so this quiz uses the module's own reference text."
            className="rounded-full border border-accent/40 px-1.5 py-px font-mono text-[9px] uppercase tracking-widest text-accent"
          >
            reference notes
          </span>
        ) : null}
      </div>
      <p className="mt-2 font-display text-xl leading-snug">{q.prompt}</p>
      {!answered ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Click the structure in the model, or press its number. A miss never ends the quiz.
        </p>
      ) : (
        <div className="mt-3">
          <p className={`text-sm font-medium ${correct ? "text-accent" : "text-primary"}`}>
            {correct ? "Correct — well placed." : `Not quite. You picked ${pickedName}.`}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            <span className="text-foreground">{answerName}.</span> {q.explanation}
          </p>
          <button
            onClick={onNext}
            className="mt-3 inline-flex min-h-[36px] items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {quiz.index + 1 < total ? "Next question" : "See score"}{" "}
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}
