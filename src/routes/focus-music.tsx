import { createFileRoute } from "@tanstack/react-router";
import { Pause, Play, Timer } from "lucide-react";
import { useEffect, useState } from "react";

import { SiteNav } from "@/components/SiteNav";
import { useFocusAudio } from "@/components/focus/FocusAudio";
import { FocusOrb } from "@/components/focus/FocusOrb";
import { FOCUS_TRACKS } from "@/components/focus/tracks";

export const Route = createFileRoute("/focus-music")({
  head: () => ({
    meta: [
      { title: "Focus music — Spatia" },
      {
        name: "description",
        content: "Generative ambient loops for deep study. No files, no streaming — synthesized live.",
      },
    ],
  }),
  component: FocusMusic,
});

function FocusMusic() {
  const { activeId, playing, volume, setVolume, toggle, stop } = useFocusAudio();

  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [timerOn, setTimerOn] = useState(false);

  useEffect(() => {
    if (!timerOn) return;
    const id = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          setTimerOn(false);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [timerOn]);

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");
  const active = FOCUS_TRACKS.find((t) => t.id === activeId) ?? null;
  const leftTracks = FOCUS_TRACKS.slice(0, 3);
  const rightTracks = FOCUS_TRACKS.slice(3);

  const card = (t: (typeof FOCUS_TRACKS)[number]) => {
    const isActive = activeId === t.id && playing;
    return (
      <div
        key={t.id}
        className={`panel flex items-center gap-4 p-5 transition-colors ${isActive ? "border-primary/50" : ""}`}
      >
        <button
          onClick={() => toggle(t.id)}
          aria-label={isActive ? `Pause ${t.title}` : `Play ${t.title}`}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground transition-opacity hover:opacity-90"
        >
          {isActive ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl leading-none">{t.title}</h2>
            <span className="label-mono">{t.tag}</span>
            {isActive ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-primary">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                playing
              </span>
            ) : null}
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{t.body}</p>
        </div>
      </div>
    );
  };

  return (
    <main>
      <SiteNav />
      <div className="mx-auto max-w-6xl px-6 py-14 md:py-16">
        <p className="eyebrow">Features · Focus music</p>
        <h1 className="mt-3 text-4xl leading-tight md:text-5xl">Stay in the chamber.</h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
          Six generative ambient loops synthesized live in your browser — no audio files, no
          streaming. The orb reacts to the sound. Leave this tab and a mini-ball pins to the top so
          you can pause without coming back.
        </p>

        {/* Orb in the center, tracks around it — no box, no grid backdrop */}
        <div className="mt-10 grid items-center gap-6 lg:grid-cols-[1fr_auto_1fr]">
          <div className="flex flex-col gap-3">{leftTracks.map(card)}</div>

          <div className="px-2 text-center">
            <FocusOrb size={320} />
            <p className="label-mono mt-2">
              {active && playing ? `Now playing · ${active.title}` : "Pick a texture"}
            </p>
            <p className="mx-auto mt-1 max-w-[260px] font-display text-xl italic leading-snug">
              {active && playing ? active.body : "Silence is also a texture."}
            </p>
            {active ? (
              <button
                onClick={stop}
                className="mt-3 rounded-md border border-border px-4 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                Stop all
              </button>
            ) : null}
          </div>

          <div className="flex flex-col gap-3">{rightTracks.map(card)}</div>
        </div>

        {/* Volume + timer */}
        <div className="panel mt-4 flex flex-wrap items-center gap-6 p-5">
          <div className="min-w-52 flex-1">
            <label htmlFor="volume" className="label-mono">
              Volume
            </label>
            <input
              id="volume"
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="mt-2 w-full accent-[var(--primary)]"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Timer className="h-4 w-4 text-primary" />
            <span className="font-display text-4xl tabular-nums">
              {mm}:{ss}
            </span>
            <div className="flex flex-wrap gap-2">
              {[10, 25, 50].map((m) => (
                <button
                  key={m}
                  onClick={() => {
                    setSecondsLeft(m * 60);
                    setTimerOn(false);
                  }}
                  className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  {m}m
                </button>
              ))}
              <button
                onClick={() => setTimerOn((v) => !v)}
                className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                {timerOn ? "Pause" : "Start"}
              </button>
              <button
                onClick={() => {
                  setTimerOn(false);
                  setSecondsLeft(25 * 60);
                }}
                className="rounded-md border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
