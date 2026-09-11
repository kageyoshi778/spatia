import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Send, Sparkles, Crosshair } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { askTutor } from "@/lib/tutor.functions";
import type { Hotspot, SceneModule } from "@/lib/scenes";
import type { Viewpoint } from "./scene/SceneCanvas";

type Turn = { role: "user" | "assistant"; content: string; focus?: string; offline?: boolean };

/** Text pushed into the panel by the guided tour, keyed so each stop appends once. */
export type Narration = { key: string; focus: string; text: string; offline: boolean };

type Props = {
  scene: SceneModule;
  hotspot: Hotspot | null;
  viewpoint: Viewpoint | null;
  narration?: Narration | null;
  /** While a tour or quiz runs, selecting a structure must not trigger an automatic brief. */
  quiet?: boolean;
};

function describeViewpoint(v: Viewpoint): { plain: string; raw: string } {
  const azDeg = Math.round(((((v.azimuth * 180) / Math.PI) % 360) + 360) % 360);
  const el = Math.round(90 - (v.polar * 180) / Math.PI);
  const dist = v.distance < 4 ? "Close-up" : v.distance < 8 ? "Medium range" : "Wide view";
  const side =
    azDeg < 45 || azDeg >= 315
      ? "front"
      : azDeg < 135
        ? "right side"
        : azDeg < 225
          ? "rear"
          : "left side";
  const vertical = el > 25 ? "from above" : el < -25 ? "from below" : "at eye level";
  return {
    plain: `${dist} · ${side}, ${vertical}`,
    raw: `${v.distance.toFixed(1)}u · az ${azDeg}° · el ${el}°`,
  };
}

export function TutorPanel({ scene, hotspot, viewpoint, narration = null, quiet = false }: Props) {
  const ask = useServerFn(askTutor);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const lastAuto = useRef<string | null>(null);
  const lastRequest = useRef<{
    question?: string | undefined;
    hotspotId?: string | undefined;
  } | null>(null);

  const mutation = useMutation({
    mutationFn: (vars: { question?: string | undefined; hotspotId?: string | undefined }) => {
      lastRequest.current = vars;
      return ask({
        data: {
          sceneId: scene.id,
          hotspotId: vars.hotspotId,
          question: vars.question,
          viewpoint: viewpoint ?? undefined,
          history: turns.slice(-6).map(({ role, content }) => ({ role, content })),
        },
      });
    },
    onSuccess: (reply) => {
      setTurns((t) => [
        ...t,
        {
          role: "assistant",
          content: reply.answer,
          focus: reply.focus,
          offline: reply.offline ?? false,
        },
      ]);
    },
  });

  // Auto-brief whenever the student clicks a new structure in the 3D scene.
  useEffect(() => {
    if (!hotspot || lastAuto.current === hotspot.id) return;
    lastAuto.current = hotspot.id;
    if (quiet) return;
    setTurns((t) => [...t, { role: "user", content: `Selected: ${hotspot.name}` }]);
    mutation.mutate({ hotspotId: hotspot.id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotspot?.id]);

  // Guided-tour narration arrives from the studio; append each stop as a tutor turn.
  const lastNarration = useRef<string | null>(null);
  useEffect(() => {
    if (!narration || lastNarration.current === narration.key) return;
    lastNarration.current = narration.key;
    setTurns((t) => [
      ...t,
      {
        role: "assistant",
        content: narration.text,
        focus: narration.focus,
        offline: narration.offline,
      },
    ]);
  }, [narration]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [turns, mutation.isPending]);

  function submit(question: string) {
    const q = question.trim();
    if (!q || mutation.isPending) return;
    setTurns((t) => [...t, { role: "user", content: q }]);
    setDraft("");
    mutation.mutate({ question: q, hotspotId: hotspot?.id });
  }

  const suggestions = hotspot
    ? [
        `Why is it shaped this way?`,
        `How does it relate to what's next to it?`,
        `Quiz me on this structure`,
      ]
    : [`Orient me in this model`, `What should I look at first?`, `Give me a 30-second overview`];

  return (
    <div className="panel flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-primary animate-pulse-ring" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
          </span>
          <span className="font-display text-lg">Tutor</span>
        </div>
        <span className="label-mono">viewpoint aware</span>
      </div>

      <div className="flex items-start gap-2 border-b border-border/70 bg-secondary/40 px-4 py-2.5">
        <Crosshair className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />
        <p className="text-xs leading-relaxed text-muted-foreground">
          <span className="text-foreground">{hotspot ? hotspot.name : "Free navigation"}</span>
          {viewpoint ? (
            <>
              {" · "}
              <span title={describeViewpoint(viewpoint).raw}>
                {describeViewpoint(viewpoint).plain}
              </span>
            </>
          ) : null}
        </p>
      </div>

      <div
        ref={scroller}
        role="log"
        aria-live="polite"
        aria-label="Tutor conversation"
        className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4"
      >
        {turns.length === 0 && !mutation.isPending ? (
          <div className="rounded-lg border border-dashed border-border/80 bg-background/40 p-4">
            <Sparkles className="h-4 w-4 text-primary" />
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Click any marker in the 3D model and I'll explain exactly what you're looking at —
              from the angle you're looking at it. Or just ask me something about {scene.title}.
            </p>
          </div>
        ) : null}

        {turns.map((turn, i) =>
          turn.role === "user" ? (
            <div
              key={i}
              className="ml-auto max-w-[85%] rounded-lg rounded-br-sm bg-primary/15 px-3 py-2 text-sm text-foreground"
            >
              {turn.content}
            </div>
          ) : (
            <div
              key={i}
              className="max-w-[95%] rounded-lg rounded-bl-sm border border-border/70 bg-surface-raised/70 px-3 py-2.5"
            >
              <div className="mb-1.5 flex items-center gap-2">
                {turn.focus ? <p className="label-mono">{turn.focus}</p> : null}
                {turn.offline ? (
                  <span
                    title="No AI key is configured, so this is the module's own reference text."
                    className="rounded-full border border-accent/40 bg-accent/10 px-1.5 py-px font-mono text-[9px] tracking-widest uppercase text-accent"
                  >
                    reference notes
                  </span>
                ) : null}
              </div>
              <p className="text-sm leading-relaxed text-foreground/90">{turn.content}</p>
            </div>
          ),
        )}

        {mutation.isPending ? (
          <div role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" aria-hidden />
            Reading your viewpoint…
          </div>
        ) : null}

        {mutation.isError ? (
          <div
            role="alert"
            className="rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2"
          >
            <p className="text-sm text-destructive-foreground">
              {(mutation.error as Error).message}
            </p>
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => {
                  mutation.reset();
                  if (lastRequest.current) mutation.mutate(lastRequest.current);
                }}
                className="min-h-[36px] rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                Retry
              </button>
              <button
                onClick={() => mutation.reset()}
                className="min-h-[36px] rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                Dismiss
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="border-t border-border/70 px-4 py-3">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => submit(s)}
              disabled={mutation.isPending}
              className="min-h-[32px] rounded-full border border-border/80 px-2.5 py-1.5 text-[11px] text-muted-foreground transition-colors hover:border-primary/60 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(draft);
          }}
          className="flex items-center gap-2"
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ask about what you're seeing…"
            aria-label="Ask the tutor about this module"
            className="min-w-0 flex-1 rounded-lg border border-input bg-background/60 px-3 py-2 text-sm caret-[var(--primary)] outline-none placeholder:text-muted-foreground focus:border-primary/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          />
          <button
            type="submit"
            disabled={mutation.isPending || !draft.trim()}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-40"
            aria-label="Send question"
          >
            <Send className="h-4 w-4" aria-hidden />
          </button>
        </form>
      </div>
    </div>
  );
}
