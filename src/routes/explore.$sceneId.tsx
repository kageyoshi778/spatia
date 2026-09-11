import { createFileRoute, Link, notFound } from "@tanstack/react-router";

import { StudioView } from "@/components/StudioView";
import { getScene, scenes } from "@/lib/scenes";

export const Route = createFileRoute("/explore/$sceneId")({
  ssr: false,
  loader: ({ params }) => {
    const scene = getScene(params.sceneId);
    if (!scene) throw notFound();
    return { scene };
  },
  head: ({ loaderData }) => {
    const scene = loaderData?.scene;
    const title = scene ? `${scene.title} — SPATIA 3D Studio` : "Module unavailable — SPATIA";
    const description = scene
      ? `${scene.tagline}. Explore ${scene.title} in real-time 3D with an AI tutor that explains whatever structure you click.`
      : "This SPATIA learning module could not be loaded.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        ...(scene ? [] : [{ name: "robots", content: "noindex" }]),
      ],
    };
  },
  notFoundComponent: ModuleNotFound,
  component: ExplorePage,
});

function ModuleNotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="panel w-full max-w-md p-6 text-left">
        <p className="eyebrow">Plate not on the shelf</p>
        <h1 className="mt-2 font-display text-2xl font-semibold">This module isn’t available</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          The link may be mistyped, or the plate was moved. Pick a plate below — your planner and
          flashcards are untouched.
        </p>
        <ul className="mt-4 space-y-1.5">
          {scenes.map((s) => (
            <li key={s.id}>
              <Link
                to="/explore/$sceneId"
                params={{ sceneId: s.id }}
                className="flex min-h-[44px] items-center justify-between gap-3 rounded-md border border-border/70 px-3 py-2 text-sm transition-colors hover:border-primary/60 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <span>{s.title}</span>
                <span className="label-mono">{s.accentLabel}</span>
              </Link>
            </li>
          ))}
        </ul>
        <Link
          to="/"
          className="mt-4 inline-flex min-h-[44px] items-center text-sm text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          ← Back to the atlas
        </Link>
      </div>
    </div>
  );
}

function ExplorePage() {
  const { scene } = Route.useLoaderData();
  return <StudioView scene={scene} />;
}
