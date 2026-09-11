import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Bot,
  CalendarCheck2,
  CalendarDays,
  FileText,
  Loader2,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { SiteNav } from "@/components/SiteNav";
import { GENERAL_MODULE_ID, planSyllabus, type PlannedItem } from "@/lib/plan.functions";
import { scenes } from "@/lib/scenes";

export const Route = createFileRoute("/planner")({
  head: () => ({
    meta: [
      { title: "Personal tracker / planner — Spatia" },
      {
        name: "description",
        content:
          "Drop a syllabus, let AI schedule it across a calendar, then edit anything by hand.",
      },
    ],
  }),
  component: Planner,
});

type Task = {
  id: string;
  title: string;
  sceneId: string;
  minutes: number;
  date: string; // YYYY-MM-DD
  done: boolean;
  notes?: string | undefined;
};

const STORAGE_KEY = "spatia-planner-v1";
const SYLLABUS_KEY = "spatia-planner-syllabus-v1";
const SYLLABUS_DISMISSED_KEY = "spatia-planner-syllabus-cards-dismissed-v1";

/* ---------------- date helpers ---------------- */

function toISO(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function todayISO() {
  return toISO(new Date());
}

function addDaysISO(iso: string, n: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y!, m! - 1, d!);
  dt.setDate(dt.getDate() + n);
  return toISO(dt);
}

function monthLabel(cursor: string) {
  const [y, m] = cursor.split("-").map(Number);
  return new Date(y!, m! - 1, 1).toLocaleString(undefined, { month: "long", year: "numeric" });
}

function shiftMonth(cursor: string, delta: number) {
  const [y, m] = cursor.split("-").map(Number);
  const dt = new Date(y!, m! - 1 + delta, 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
}

function monthCells(cursor: string): (string | null)[] {
  const [y, m] = cursor.split("-").map(Number);
  const first = new Date(y!, m! - 1, 1);
  // Monday-first grid
  const lead = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(y!, m!, 0).getDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function moduleTitle(id: string) {
  if (id === GENERAL_MODULE_ID) return "General study";
  return scenes.find((s) => s.id === id)?.title ?? id;
}

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function loadTasks(): Task[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Task[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/* ---------------- component ---------------- */

const MODULE_OPTIONS = [
  ...scenes.map((s) => ({ id: s.id, label: s.title })),
  { id: GENERAL_MODULE_ID, label: "General study" },
];

function Planner() {
  const planFn = useServerFn(planSyllabus);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [month, setMonth] = useState(() => todayISO().slice(0, 7));
  const [selected, setSelected] = useState<string>(() => todayISO());
  const [dragOver, setDragOver] = useState<string | null>(null);

  // syllabus
  const [syllabus, setSyllabus] = useState("");
  const [syllabusName, setSyllabusName] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(() => todayISO());
  const [daysPerWeek, setDaysPerWeek] = useState(4);
  const [minutesPerSession, setMinutesPerSession] = useState(30);
  const [preview, setPreview] = useState<PlannedItem[] | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissedSyllabus, setDismissedSyllabus] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // quick add (right rail)
  const [title, setTitle] = useState("");
  const [sceneId, setSceneId] = useState(scenes[0]?.id ?? GENERAL_MODULE_ID);
  const [minutes, setMinutes] = useState(25);
  const [date, setDate] = useState(() => todayISO());

  useEffect(() => {
    setTasks(loadTasks());
    try {
      setSyllabus(localStorage.getItem(SYLLABUS_KEY) ?? "");
      setDismissedSyllabus(localStorage.getItem(SYLLABUS_DISMISSED_KEY));
    } catch {
      /* noop */
    }
  }, []);

  // Debounced save so the "make flash cards?" prompt only appears after real edits.
  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        localStorage.setItem(SYLLABUS_KEY, syllabus);
      } catch {
        /* noop */
      }
    }, 600);
    return () => window.clearTimeout(id);
  }, [syllabus]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch {
      /* storage unavailable */
    }
  }, [tasks]);

  const syllabusReady = syllabus.trim().length >= 10;
  const showCardsPrompt = syllabusReady && dismissedSyllabus !== syllabus;

  function dismissCardsPrompt() {
    setDismissedSyllabus(syllabus);
    try {
      localStorage.setItem(SYLLABUS_DISMISSED_KEY, syllabus);
    } catch {
      /* noop */
    }
  }

  const stats = useMemo(() => {
    const total = tasks.length;
    const done = tasks.filter((t) => t.done).length;
    const doneMinutes = tasks.filter((t) => t.done).reduce((n, t) => n + t.minutes, 0);
    const plannedMinutes = tasks.reduce((n, t) => n + t.minutes, 0);
    return { total, done, doneMinutes, plannedMinutes };
  }, [tasks]);

  const byDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of tasks) {
      const arr = map.get(t.date) ?? [];
      arr.push(t);
      map.set(t.date, arr);
    }
    for (const arr of map.values()) arr.sort((a, b) => Number(a.done) - Number(b.done));
    return map;
  }, [tasks]);

  const selectedTasks = byDate.get(selected) ?? [];
  const upcoming = useMemo(
    () =>
      [...tasks]
        .filter((t) => !t.done && t.date >= todayISO())
        .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
        .slice(0, 8),
    [tasks],
  );

  function patch(id: string, p: Partial<Task>) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...p } : t)));
  }

  function remove(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  function addQuick() {
    const name = title.trim() || "Study session";
    setTasks((t) => [...t, { id: uid(), title: name, sceneId, minutes, date, done: false }]);
    setTitle("");
    setSelected(date);
    setMonth(date.slice(0, 7));
  }

  function moveTask(id: string, newDate: string) {
    patch(id, { date: newDate });
  }

  /* -------- syllabus: file + plan -------- */

  function readFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      setSyllabus(text.slice(0, 8000));
      setSyllabusName(file.name);
      setPreview(null);
    };
    reader.readAsText(file);
  }

  async function generate() {
    if (busy || syllabus.trim().length < 10) return;
    setBusy(true);
    setError(null);
    try {
      const plan = await planFn({
        data: { syllabus: syllabus.trim(), startDate, daysPerWeek, minutesPerSession },
      });
      setPreview(plan.items);
      setSummary(plan.summary);
      setOffline(plan.offline);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The planner could not answer that.");
    } finally {
      setBusy(false);
    }
  }

  function addPreviewToCalendar() {
    if (!preview?.length) return;
    const rows: Task[] = preview.map((p) => ({
      id: uid(),
      title: p.title,
      sceneId: p.sceneId,
      minutes: p.minutes,
      date: addDaysISO(startDate, p.dayOffset),
      done: false,
      notes: p.notes,
    }));
    setTasks((prev) => [...prev, ...rows]);
    setMonth(startDate.slice(0, 7));
    setSelected(startDate);
    setPreview(null);
  }

  return (
    <main>
      <SiteNav />
      <div className="mx-auto max-w-7xl px-6 py-10 md:py-12">
        <p className="eyebrow">Features · Personal tracker / planner</p>
        <h1 className="mt-3 text-4xl leading-tight md:text-5xl">Plan the work. Track the win.</h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
          Drop a syllabus, let the AI spread it across the calendar, then edit anything by hand —
          click a day, drag sessions between days, or rewrite them inline.
        </p>

        <div className="mt-8 grid items-start gap-5 lg:grid-cols-[3fr_1fr]">
          {/* -------- left (75%): calendar + syllabus -------- */}
          <div className="min-w-0 space-y-5">
            <section className="panel p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-primary" />
                  <h2 className="text-xl">{monthLabel(month)}</h2>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <button
                    onClick={() => setMonth((m) => shiftMonth(m, -1))}
                    className="rounded-md border border-border px-2.5 py-1.5 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    ← Prev
                  </button>
                  <button
                    onClick={() => {
                      setMonth(todayISO().slice(0, 7));
                      setSelected(todayISO());
                    }}
                    className="rounded-md border border-border px-2.5 py-1.5 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Today
                  </button>
                  <button
                    onClick={() => setMonth((m) => shiftMonth(m, 1))}
                    className="rounded-md border border-border px-2.5 py-1.5 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Next →
                  </button>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-7 gap-1.5">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                  <div key={d} className="label-mono pb-1 text-center">
                    {d}
                  </div>
                ))}
                {monthCells(month).map((iso, i) => {
                  if (!iso) return <div key={`e${i}`} />;
                  const dayTasks = byDate.get(iso) ?? [];
                  const isSel = iso === selected;
                  const isToday = iso === todayISO();
                  return (
                    <div
                      key={iso}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelected(iso)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") setSelected(iso);
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOver(iso);
                      }}
                      onDragLeave={() => setDragOver((d) => (d === iso ? null : d))}
                      onDrop={(e) => {
                        e.preventDefault();
                        const id = e.dataTransfer.getData("text/spatia-task");
                        if (id) moveTask(id, iso);
                        setDragOver(null);
                        setSelected(iso);
                      }}
                      className={`min-h-[86px] cursor-pointer rounded-md border p-1.5 text-left transition-colors ${
                        isSel
                          ? "border-primary bg-primary/10"
                          : dragOver === iso
                            ? "border-primary/60 bg-primary/5"
                            : "border-border hover:border-primary/40"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`font-mono text-[11px] ${isToday ? "font-semibold text-primary" : "text-muted-foreground"}`}
                        >
                          {Number(iso.slice(8))}
                        </span>
                        {dayTasks.length > 0 ? (
                          <span className="label-mono">{dayTasks.length}</span>
                        ) : null}
                      </div>
                      <div className="mt-1 space-y-1">
                        {dayTasks.slice(0, 3).map((t) => (
                          <div
                            key={t.id}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData("text/spatia-task", t.id);
                              e.stopPropagation();
                            }}
                            onClick={(e) => e.stopPropagation()}
                            title={`${t.title} · ${t.minutes} min — drag to move`}
                            className={`truncate rounded px-1.5 py-0.5 text-[11px] leading-relaxed ${
                              t.done
                                ? "bg-secondary text-muted-foreground line-through"
                                : "bg-primary/15 text-foreground"
                            }`}
                          >
                            {t.title}
                          </div>
                        ))}
                        {dayTasks.length > 3 ? (
                          <div className="label-mono pl-1">+{dayTasks.length - 3} more</div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* selected day editor */}
              <div className="hairline mt-4 pt-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-lg">
                    {selected}{" "}
                    <span className="text-sm text-muted-foreground">
                      · {selectedTasks.length} session{selectedTasks.length === 1 ? "" : "s"}
                    </span>
                  </h3>
                  <button
                    onClick={() => {
                      setTasks((prev) => [
                        ...prev,
                        {
                          id: uid(),
                          title: "New session",
                          sceneId: scenes[0]?.id ?? GENERAL_MODULE_ID,
                          minutes: 25,
                          date: selected,
                          done: false,
                        },
                      ]);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add here
                  </button>
                </div>
                {selectedTasks.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Nothing scheduled — drag a session here or add one.
                  </p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {selectedTasks.map((t) => (
                      <li key={t.id} className="rounded-md border border-border p-3">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={t.done}
                            onChange={() => patch(t.id, { done: !t.done })}
                            className="h-4 w-4 accent-[var(--primary)]"
                            aria-label={`Mark ${t.title} done`}
                          />
                          <input
                            value={t.title}
                            onChange={(e) => patch(t.id, { title: e.target.value })}
                            className={`min-w-0 flex-1 bg-transparent text-sm font-medium outline-none ${t.done ? "line-through opacity-60" : ""}`}
                          />
                          <button
                            onClick={() => remove(t.id)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                            aria-label={`Delete ${t.title}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                          <select
                            value={t.sceneId}
                            onChange={(e) => patch(t.id, { sceneId: e.target.value })}
                            className="rounded-md border border-input bg-background px-2 py-1.5 text-xs outline-none focus:border-primary"
                          >
                            {MODULE_OPTIONS.map((o) => (
                              <option key={o.id} value={o.id}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                          <select
                            value={t.minutes}
                            onChange={(e) => patch(t.id, { minutes: Number(e.target.value) })}
                            className="rounded-md border border-input bg-background px-2 py-1.5 text-xs outline-none focus:border-primary"
                          >
                            {[10, 15, 25, 30, 45, 60, 90].map((m) => (
                              <option key={m} value={m}>
                                {m} min
                              </option>
                            ))}
                          </select>
                          <input
                            type="date"
                            value={t.date}
                            onChange={(e) => {
                              if (e.target.value) {
                                patch(t.id, { date: e.target.value });
                                setSelected(e.target.value);
                                setMonth(e.target.value.slice(0, 7));
                              }
                            }}
                            className="rounded-md border border-input bg-background px-2 py-1.5 text-xs outline-none focus:border-primary"
                          />
                          <input
                            value={t.notes ?? ""}
                            onChange={(e) => patch(t.id, { notes: e.target.value })}
                            placeholder="Notes (optional)"
                            className="rounded-md border border-input bg-background px-2 py-1.5 text-xs outline-none placeholder:text-muted-foreground/60 focus:border-primary"
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            {/* syllabus */}
            <section className="panel p-5">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <h2 className="text-xl">Syllabus → AI schedule</h2>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Paste or drop a syllabus file. The AI categorises each topic onto the closest Spatia
                module and spreads sessions from the start date. .
              </p>

              <div
                role="button"
                tabIndex={0}
                onClick={() => fileRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") fileRef.current?.click();
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const f = e.dataTransfer.files[0];
                  if (f) readFile(f);
                }}
                className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-input px-4 py-5 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
              >
                <Upload className="h-4 w-4" />
                {syllabusName ? (
                  <span>
                    Loaded <span className="font-medium text-foreground">{syllabusName}</span> — click
                    or drop to replace
                  </span>
                ) : (
                  <span>Drop a .txt / .md syllabus here, or click to browse</span>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept=".txt,.md,.markdown,text/plain"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) readFile(f);
                    e.target.value = "";
                  }}
                />
              </div>

              <textarea
                value={syllabus}
                onChange={(e) => {
                  setSyllabus(e.target.value);
                  setPreview(null);
                }}
                rows={6}
                placeholder={"Paste your syllabus — one topic per line works best:\n1. Cardiac chambers and valves\n2. Coronary circulation\n3. DNA replication…"}
                className="mt-3 w-full rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed outline-none placeholder:text-muted-foreground/60 focus:border-primary"
              />

              <div className="mt-3 grid gap-3 sm:grid-cols-[150px_130px_150px_1fr]">
                <label className="block">
                  <span className="label-mono">Start date</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => e.target.value && setStartDate(e.target.value)}
                    className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs outline-none focus:border-primary"
                  />
                </label>
                <label className="block">
                  <span className="label-mono">Days / week</span>
                  <select
                    value={daysPerWeek}
                    onChange={(e) => setDaysPerWeek(Number(e.target.value))}
                    className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs outline-none focus:border-primary"
                  >
                    {[2, 3, 4, 5, 6, 7].map((d) => (
                      <option key={d} value={d}>
                        {d} days
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="label-mono">Min / session</span>
                  <select
                    value={minutesPerSession}
                    onChange={(e) => setMinutesPerSession(Number(e.target.value))}
                    className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs outline-none focus:border-primary"
                  >
                    {[15, 25, 30, 45, 60].map((m) => (
                      <option key={m} value={m}>
                        {m} min
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex items-end">
                  <button
                    onClick={generate}
                    disabled={busy || syllabus.trim().length < 10}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
                    {busy ? "Planning…" : "Generate plan"}
                  </button>
                </div>
              </div>
              {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}

              {summary ? (
                <div className="mt-3 rounded-md border border-border bg-surface-raised p-3 text-sm leading-relaxed">
                  <span className="label-mono">AI plan · </span>
                  {offline ? (
                    <span className="font-mono text-[10px] uppercase tracking-widest text-accent">
                      local fallback — no key&nbsp;·&nbsp;
                    </span>
                  ) : null}
                  {summary}
                </div>
              ) : null}

              {preview?.length ? (
                <div className="mt-3">
                  <div className="flex items-center justify-between">
                    <p className="label-mono">{preview.length} sessions proposed</p>
                    <button
                      onClick={addPreviewToCalendar}
                      className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
                    >
                      Add all to calendar
                    </button>
                  </div>
                  <ul className="mt-2 space-y-2">
                    {preview.map((p, i) => (
                      <li key={i} className="rounded-md border border-border p-3">
                        <div className="flex items-center gap-2">
                          <span className="label-mono w-14 shrink-0">
                            Day {p.dayOffset + 1}
                          </span>
                          <input
                            value={p.title}
                            onChange={(e) =>
                              setPreview((prev) =>
                                prev?.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) ??
                                null,
                              )
                            }
                            className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none"
                          />
                          <button
                            onClick={() => setPreview((prev) => prev?.filter((_, j) => j !== i) ?? null)}
                            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                            aria-label={`Remove ${p.title}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <select
                            value={p.sceneId}
                            onChange={(e) =>
                              setPreview((prev) =>
                                prev?.map((x, j) => (j === i ? { ...x, sceneId: e.target.value } : x)) ??
                                null,
                              )
                            }
                            className="rounded-md border border-input bg-background px-2 py-1.5 text-xs outline-none focus:border-primary"
                          >
                            {MODULE_OPTIONS.map((o) => (
                              <option key={o.id} value={o.id}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                          <select
                            value={p.minutes}
                            onChange={(e) =>
                              setPreview((prev) =>
                                prev?.map((x, j) =>
                                  j === i ? { ...x, minutes: Number(e.target.value) } : x,
                                ) ?? null,
                              )
                            }
                            className="rounded-md border border-input bg-background px-2 py-1.5 text-xs outline-none focus:border-primary"
                          >
                            {[10, 15, 25, 30, 45, 60, 90].map((m) => (
                              <option key={m} value={m}>
                                {m} min
                              </option>
                            ))}
                          </select>
                          <span className="label-mono self-center">
                            → {addDaysISO(startDate, p.dayOffset)}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {/* Prompt to turn this syllabus into flash cards */}
              {showCardsPrompt ? (
                <div className="mt-3 flex flex-wrap items-center gap-3 rounded-md border border-primary/40 bg-primary/5 p-3">
                  <p className="min-w-52 flex-1 text-sm leading-relaxed">
                    Want flash cards from this syllabus? The AI will build a deck on these topics.
                  </p>
                  <div className="flex gap-2">
                    <Link
                      to="/flashcards"
                      search={{ source: "syllabus" }}
                      onClick={dismissCardsPrompt}
                      className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
                    >
                      Yes, make cards
                    </Link>
                    <button
                      onClick={dismissCardsPrompt}
                      className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                    >
                      Not now
                    </button>
                  </div>
                </div>
              ) : null}
            </section>
          </div>

          {/* -------- right (25%): boxes as a list -------- */}
          <aside className="min-w-0 space-y-4 lg:sticky lg:top-20">
            <section className="panel p-4">
              <p className="label-mono">Progress</p>
              <dl className="mt-2 space-y-2">
                {[
                  [`${stats.done} / ${stats.total}`, "sessions done"],
                  [`${stats.doneMinutes} / ${stats.plannedMinutes}`, "minutes focused / planned"],
                ].map(([v, l]) => (
                  <div key={String(l)} className="rounded-md bg-surface-raised p-3">
                    <dt className="font-display text-2xl leading-none">{v}</dt>
                    <dd className="label-mono mt-1">{l}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section className="panel p-4">
              <div className="flex items-center gap-2">
                <CalendarCheck2 className="h-4 w-4 text-primary" />
                <h2 className="text-lg">New session</h2>
              </div>
              <div className="mt-3 space-y-2">
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addQuick();
                  }}
                  placeholder="e.g. Heart chambers tour"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/60 focus:border-primary"
                />
                <select
                  value={sceneId}
                  onChange={(e) => setSceneId(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                >
                  {MODULE_OPTIONS.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={minutes}
                    onChange={(e) => setMinutes(Number(e.target.value))}
                    className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                  >
                    {[10, 15, 25, 30, 45, 60].map((m) => (
                      <option key={m} value={m}>
                        {m} min
                      </option>
                    ))}
                  </select>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => e.target.value && setDate(e.target.value)}
                    className="rounded-md border border-input bg-background px-2 py-2 text-xs outline-none focus:border-primary"
                  />
                </div>
                <button
                  onClick={addQuick}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
                >
                  <Plus className="h-4 w-4" /> Add session
                </button>
              </div>
            </section>

            <section className="panel p-4">
              <p className="label-mono">Up next</p>
              {upcoming.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  Nothing upcoming — generate a plan or add a session.
                </p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {upcoming.map((t) => (
                    <li key={t.id} className="flex items-center gap-2 rounded-md bg-surface-raised p-2.5">
                      <input
                        type="checkbox"
                        checked={t.done}
                        onChange={() => patch(t.id, { done: !t.done })}
                        className="h-3.5 w-3.5 shrink-0 accent-[var(--primary)]"
                        aria-label={`Mark ${t.title} done`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium">{t.title}</p>
                        <p className="label-mono mt-0.5">
                          {t.date.slice(5)} · {t.minutes}m · {moduleTitle(t.sceneId)}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setSelected(t.date);
                          setMonth(t.date.slice(0, 7));
                        }}
                        className="shrink-0 text-[11px] text-primary hover:underline"
                      >
                        Open
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
