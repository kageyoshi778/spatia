import { createFileRoute, getRouteApi, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Bot, Check, Loader2, RotateCcw, Shuffle, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { SiteNav } from "@/components/SiteNav";
import { buildDeck, type AiCard } from "@/lib/deck.functions";
import { scenes } from "@/lib/scenes";

export const Route = createFileRoute("/flashcards")({
  validateSearch: (search: Record<string, unknown>) => ({
    source: typeof search["source"] === "string" ? search["source"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Flash cards — Spatia" },
      {
        name: "description",
        content:
          "Short concept explainers and formula notes drawn from every Spatia module, or built by AI from your syllabus.",
      },
    ],
  }),
  component: Flashcards,
});

const routeApi = getRouteApi("/flashcards");

type Card = {
  id: string;
  sceneTitle: string;
  subject: string;
  front: string;
  category: string;
  back: string;
  facts: string[];
};

const SYLLABUS_KEY = "spatia-planner-syllabus-v1";
const SYLLABUS_DECK_KEY = "spatia-flashcards-syllabus-deck-v1";
const SYLLABUS_SNAPSHOT_KEY = "spatia-flashcards-syllabus-snapshot-v1";

function toCard(c: AiCard, i: number): Card {
  return {
    id: `syllabus:${i}`,
    sceneTitle: "Syllabus deck",
    subject: c.topic ?? "Syllabus",
    front: c.front,
    category: c.topic ?? "AI card",
    back: c.back,
    facts: [],
  };
}

function loadDeck(key: string): Card[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AiCard[];
    return Array.isArray(parsed) ? parsed.map(toCard) : [];
  } catch {
    return [];
  }
}

/* Soft eye-light tints for the note cards — cream / tan / teal washes, never neon. */
const CARD_TINTS = [
  { bg: "#f1e9d4", edge: "#cdb380" }, // sand
  { bg: "#dce8e2", edge: "#036564" }, // teal wash
  { bg: "#d9e1e6", edge: "#033649" }, // deep wash
  { bg: "#e9ddbd", edge: "#cdb380" }, // tan
  { bg: "#d3e0dc", edge: "#036564" }, // pale teal
  { bg: "#e3e6ea", edge: "#033649" }, // mist
];

function tintFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return CARD_TINTS[h % CARD_TINTS.length]!;
}

function Flashcards() {
  const deckFn = useServerFn(buildDeck);
  const { source } = routeApi.useSearch();

  const moduleDeck: Card[] = useMemo(
    () =>
      scenes.flatMap((s) =>
        s.hotspots.map((h) => ({
          id: `${s.id}:${h.id}`,
          sceneTitle: s.title,
          subject: s.subject,
          front: h.name,
          category: h.category,
          back: h.summary,
          facts: h.facts,
        })),
      ),
    [],
  );

  const [deckName, setDeckName] = useState<"modules" | "syllabus">("modules");
  const [syllabusDeck, setSyllabusDeck] = useState<Card[]>([]);
  const [syllabusSnapshot, setSyllabusSnapshot] = useState<string | null>(null);
  const [syllabusStale, setSyllabusStale] = useState(false);
  const [building, setBuilding] = useState(false);
  const [buildError, setBuildError] = useState<string | null>(null);
  const [buildOffline, setBuildOffline] = useState(false);
  const [count, setCount] = useState(12);

  const deck = deckName === "syllabus" ? syllabusDeck : moduleDeck;

  const [filter, setFilter] = useState<string>("All");
  const [order, setOrder] = useState<number[]>(() => moduleDeck.map((_, i) => i));
  const [pos, setPos] = useState(0);
  const [known, setKnown] = useState<Set<string>>(new Set());

  useEffect(() => {
    setSyllabusDeck(loadDeck(SYLLABUS_DECK_KEY));
    try {
      const snap = localStorage.getItem(SYLLABUS_SNAPSHOT_KEY);
      setSyllabusSnapshot(snap);
      const current = localStorage.getItem(SYLLABUS_KEY);
      if (snap !== null && current !== null && current.trim().length >= 10 && snap !== current) {
        setSyllabusStale(true);
      }
    } catch {
      /* noop */
    }
    if (source === "syllabus") setDeckName("syllabus");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep ordering valid when the active deck or filter changes.
  useEffect(() => {
    setOrder(deck.map((_, i) => i));
    setPos(0);
    setFilter("All");
    setKnown(new Set());
  }, [deckName, syllabusDeck.length, moduleDeck.length]);

  const subjects = useMemo(
    () => ["All", ...Array.from(new Set(deck.map((c) => c.sceneTitle)))],
    [deck],
  );

  const filtered = useMemo(() => {
    const idx = order.filter((i) => filter === "All" || deck[i]?.sceneTitle === filter);
    return idx;
  }, [order, filter, deck]);

  const currentIdx = filtered.length ? filtered[pos % filtered.length] : undefined;
  const card = currentIdx !== undefined ? deck[currentIdx] : undefined;
  const knownCount = known.size;

  async function generateSyllabusDeck() {
    let syllabus: string | null = null;
    try {
      syllabus = localStorage.getItem(SYLLABUS_KEY);
    } catch {
      /* noop */
    }
    if (!syllabus || syllabus.trim().length < 10) {
      setBuildError("No syllabus found — add one in the planner first.");
      return;
    }
    setBuilding(true);
    setBuildError(null);
    try {
      const result = await deckFn({ data: { syllabus: syllabus.trim(), count } });
      const cards = result.cards.map(toCard);
      setSyllabusDeck(cards);
      setDeckName("syllabus");
      setBuildOffline(result.offline);
      setSyllabusStale(false);
      try {
        localStorage.setItem(SYLLABUS_DECK_KEY, JSON.stringify(result.cards));
        localStorage.setItem(SYLLABUS_SNAPSHOT_KEY, syllabus);
        setSyllabusSnapshot(syllabus);
      } catch {
        /* noop */
      }
    } catch (e) {
      setBuildError(e instanceof Error ? e.message : "The card builder could not answer that.");
    } finally {
      setBuilding(false);
    }
  }

  function go(delta: number) {
    if (!filtered.length) return;
    setPos((p) => (p + delta + filtered.length) % filtered.length);
  }

  function goTo(i: number) {
    setPos(((i % filtered.length) + filtered.length) % filtered.length);
  }

  function shuffle() {
    const arr = deck.map((_, i) => i);
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j]!, arr[i]!];
    }
    setOrder(arr);
    setPos(0);
  }

  function mark(id: string, value: boolean) {
    setKnown((prev) => {
      const next = new Set(prev);
      if (value) next.add(id);
      else next.delete(id);
      return next;
    });
    go(1);
  }

  return (
    <main>
      <SiteNav />
      <div className="mx-auto max-w-6xl px-6 py-10 md:py-12">
        <p className="eyebrow">Features · Flash cards</p>
        <h1 className="mt-3 text-4xl leading-tight md:text-5xl">Concepts, minus the fluff.</h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
          Short explainers and formula notes — the module deck distils the same reference notes as
          the studio tutor, or build an AI deck from your planner syllabus.
        </p>

        {/* deck switcher + AI builder */}
        <div className="mt-6 flex flex-wrap items-center gap-2">
          {(["modules", "syllabus"] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDeckName(d)}
              className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${
                deckName === d
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {d === "modules" ? `Module deck (${moduleDeck.length})` : `Syllabus deck (${syllabusDeck.length})`}
            </button>
          ))}
          <div className="mx-1 h-5 w-px bg-border" />
          <select
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="rounded-md border border-input bg-background px-2 py-1.5 text-xs outline-none focus:border-primary"
            aria-label="Cards per deck"
          >
            {[8, 12, 16, 20].map((n) => (
              <option key={n} value={n}>
                {n} cards
              </option>
            ))}
          </select>
          <button
            onClick={generateSyllabusDeck}
            disabled={building}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {building ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bot className="h-3.5 w-3.5" />}
            {building ? "Building…" : syllabusDeck.length ? "Rebuild from syllabus" : "Build from syllabus"}
          </button>
          <Link
            to="/planner"
            className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Edit syllabus →
          </Link>
        </div>
        {syllabusStale && deckName === "syllabus" ? (
          <p className="mt-2 text-xs text-primary">
            Your syllabus changed since this deck was built — rebuild to pick up the new topics.
          </p>
        ) : null}
        {buildOffline ? (
          <p className="mt-2 font-mono text-[11px] uppercase tracking-widest text-accent">
            Local deck — add an API key for AI-written cards
          </p>
        ) : null}
        {buildError ? <p className="mt-2 text-xs text-destructive">{buildError}</p> : null}

        {deckName === "modules" ? (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {subjects.map((s) => (
              <button
                key={s}
                onClick={() => {
                  setFilter(s);
                  setPos(0);
                }}
                className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${
                  filter === s
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {s}
              </button>
            ))}
            <div className="mx-1 h-5 w-px bg-border" />
            <button
              onClick={shuffle}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <Shuffle className="h-3.5 w-3.5" /> Shuffle
            </button>
          </div>
        ) : null}

        <div className="mt-6 flex items-center justify-between">
          <span className="label-mono">
            Card {filtered.length ? (pos % filtered.length) + 1 : 0} / {filtered.length}
          </span>
          <span className="label-mono">{knownCount} marked known</span>
        </div>

        {/* left: card list · right: vertical card */}
        <div className="mt-3 grid items-start gap-5 lg:grid-cols-2">
          <div className="min-w-0">
            {filtered.length === 0 ? (
              <div className="panel p-6 text-sm text-muted-foreground">
                {deckName === "syllabus"
                  ? "No syllabus deck yet — build one from your planner syllabus."
                  : "No cards in this deck."}
              </div>
            ) : (
              <ol className="panel max-h-[560px] divide-y divide-border overflow-y-auto">
                {filtered.map((deckIdx, i) => {
                  const c = deck[deckIdx];
                  if (!c) return null;
                  const isCurrent = i === pos % filtered.length;
                  const isKnown = known.has(c.id);
                  const tint = tintFor(c.id);
                  return (
                    <li key={c.id}>
                      <button
                        onClick={() => goTo(i)}
                        className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
                          isCurrent ? "bg-primary/10" : "hover:bg-secondary"
                        }`}
                      >
                        <span
                          aria-hidden
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: tint.edge }}
                        />
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span
                            className={`block truncate text-sm font-medium ${isCurrent ? "text-primary" : ""}`}
                          >
                            {c.front}
                          </span>
                          <span className="label-mono mt-0.5 block truncate">{c.category}</span>
                        </span>
                        {isKnown ? <Check className="h-3.5 w-3.5 shrink-0 text-accent" /> : null}
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>

          <div className="min-w-0 lg:sticky lg:top-20">
            {card ? (
              <article
                className="card-lift mx-auto block aspect-[4/5] w-full max-w-[400px] overflow-y-auto rounded-lg border p-8"
                style={{
                  backgroundColor: tintFor(card.id).bg,
                  borderColor: tintFor(card.id).edge,
                  boxShadow: "var(--shadow-panel)",
                }}
              >
                <p className="eyebrow">Concept notes</p>
                <p className="label-mono mt-4">
                  {card.sceneTitle} · {card.category}
                </p>
                <p className="mt-2 font-display text-2xl leading-tight md:text-3xl">
                  {card.front}
                </p>
                <div
                  aria-hidden
                  className="my-5 h-px w-full"
                  style={{ backgroundColor: tintFor(card.id).edge }}
                />
                <p className="text-base leading-relaxed">{card.back}</p>
                {card.facts.length ? (
                  <div className="mt-5">
                    <p className="label-mono">Key points</p>
                    <ul className="mt-2 space-y-1.5">
                      {card.facts.map((f) => (
                        <li
                          key={f}
                          className="rounded-md border border-border bg-background/60 px-2.5 py-1.5 text-xs text-muted-foreground"
                        >
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </article>
            ) : (
              <div className="panel p-8 text-sm text-muted-foreground">No cards in this deck.</div>
            )}

            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <button
                onClick={() => go(-1)}
                className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                ← Prev
              </button>
              <button
                onClick={() => go(1)}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                Next →
              </button>
              {card ? (
                <>
                  <button
                    onClick={() => mark(card.id, true)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-accent/40 px-4 py-2 text-sm text-accent transition-colors hover:bg-accent/10"
                  >
                    <Check className="h-4 w-4" /> Got it
                  </button>
                  <button
                    onClick={() => mark(card.id, false)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <X className="h-4 w-4" /> Review later
                  </button>
                </>
              ) : null}
              <button
                onClick={() => {
                  setKnown(new Set());
                  setPos(0);
                }}
                className="inline-flex items-center gap-1.5 px-2 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Reset progress
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
