import { Link } from "@tanstack/react-router";
import { CalendarCheck2, ChevronDown, Layers, Music4 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const FEATURES = [
  {
    to: "/flashcards",
    title: "Flash cards",
    body: "Flip through structure decks",
    icon: Layers,
  },
  {
    to: "/planner",
    title: "Personal tracker / planner",
    body: "Plan study sessions and track progress",
    icon: CalendarCheck2,
  },
  {
    to: "/focus-music",
    title: "Focus music",
    body: "Ambient loops for deep study",
    icon: Music4,
  },
] as const;

export function SiteNav() {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <Link to="/" className="font-display text-xl tracking-tight">
          Spatia
        </Link>
        <div className="flex items-center gap-6 text-sm">
          <div
            ref={wrapRef}
            className="relative"
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
          >
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
              className="inline-flex cursor-pointer items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
            >
              Features
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
              />
            </button>
            {open ? (
              <div className="absolute right-0 top-full w-72 pt-2">
                <div
                  role="menu"
                  className="panel overflow-hidden p-1.5"
                >
                  {FEATURES.map((f) => (
                    <Link
                      key={f.to}
                      to={f.to}
                      onClick={() => setOpen(false)}
                      className="group flex items-start gap-3 rounded-md px-3 py-2.5 transition-colors hover:bg-secondary"
                    >
                      <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-surface-raised text-muted-foreground transition-colors group-hover:text-primary">
                        <f.icon className="h-3.5 w-3.5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-foreground">
                          {f.title}
                        </span>
                        <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                          {f.body}
                        </span>
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
          <Link
            to="/explore/$sceneId"
            params={{ sceneId: "cardiac" }}
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            Studio
          </Link>
          <Link
            to="/about"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            How it works
          </Link>
        </div>
      </nav>
    </header>
  );
}
