import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";

import { getModel } from "./ai.server";
import { scenes } from "./scenes";

const PlanItemOutput = z.object({
  title: z.string().min(1).max(140),
  sceneId: z.string().min(1),
  minutes: z.number().int().min(5).max(180),
  dayOffset: z.number().int().min(0).max(60),
  notes: z.string().max(240).optional(),
});

const PlanOutput = z.object({
  summary: z.string().max(600),
  items: z.array(PlanItemOutput).min(1).max(20),
});

export type PlannedItem = {
  title: string;
  sceneId: string;
  minutes: number;
  dayOffset: number;
  notes?: string | undefined;
};

export type SyllabusPlan = {
  summary: string;
  items: PlannedItem[];
  offline: boolean;
};

export const GENERAL_MODULE_ID = "general";

export function isKnownModule(id: string) {
  return id === GENERAL_MODULE_ID || scenes.some((s) => s.id === id);
}

/* ---------------- Offline fallback: keyword categoriser ---------------- */

const MODULE_KEYWORDS: Record<string, string[]> = {
  cardiac: ["heart", "cardiac", "chamber", "valve", "aorta", "blood", "circul", "anatomy", "physiolog"],
  caffeine: ["caffeine", "molecule", "organic", "bond", "compound", "reaction"],
  cathedral: ["cathedral", "gothic", "arch", "vault", "buttress", "architecture", "medieval"],
  "solar-system": ["orbit", "planet", "solar", "gravity", "kepler", "astronom", "moon", "mars", "jupiter"],
  tectonics: ["tectonic", "plate", "earthquake", "volcano", "magma", "earth science", "geolog"],
  gearbox: ["gear", "torque", "mechanic", "machine", "engineer", "drivetrain"],
  "binary-tree": ["binary", "tree", "algorithm", "data structure", "recursion", "sort", "search", "traversal"],
  dna: ["dna", "gene", "helix", "genetic", "protein", "cell", "biolog", "heredit"],
  "wave-interference": ["wave", "interference", "frequency", "sound", "optics", "light", "wavelength"],
  lattice: ["lattice", "crystal", "ionic", "salt", "solid", "chemistry"],
};

export function splitSyllabusTopics(syllabus: string, max = 12): string[] {
  const lines = syllabus
    .split(/\r?\n/)
    .map((l) => l.replace(/^[\s>•\-*—\d.)\]]+/, "").trim())
    .filter((l) => l.length > 2);
  if (lines.length >= 2) return lines.slice(0, max);
  const parts = syllabus
    .split(/[;•]+|\.\s+(?=[A-Z0-9])/)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter((s) => s.length > 2);
  return parts.slice(0, max);
}

function matchModule(topic: string): string {
  const lower = topic.toLowerCase();
  for (const scene of scenes) {
    const keys = MODULE_KEYWORDS[scene.id] ?? [];
    if (
      lower.includes(scene.title.toLowerCase().split(",")[0] ?? "") ||
      keys.some((k) => lower.includes(k))
    ) {
      return scene.id;
    }
  }
  return GENERAL_MODULE_ID;
}

function referencePlan(syllabus: string, minutesPerSession: number): SyllabusPlan {
  const topics = splitSyllabusTopics(syllabus, 12);
  const list = topics.length ? topics : ["General review"];
  return {
    summary:
      "AI key not configured — topics were categorised locally by keyword and spread one per day. Add an API key to .env for smarter scheduling.",
    items: list.map((topic, i) => ({
      title: topic.length > 90 ? `${topic.slice(0, 87)}…` : topic,
      sceneId: matchModule(topic),
      minutes: Math.min(90, Math.max(10, minutesPerSession)),
      dayOffset: i,
    })),
    offline: true,
  };
}

function isNotConfigured(error: unknown) {
  return error instanceof Error && error.message.startsWith("AI tutor is not configured");
}

export const planSyllabus = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        syllabus: z.string().min(10).max(8000),
        startDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, "startDate must be YYYY-MM-DD"),
        daysPerWeek: z.number().int().min(1).max(7).default(4),
        minutesPerSession: z.number().int().min(10).max(120).default(30),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<SyllabusPlan> => {
    let model;
    try {
      model = getModel();
    } catch (error) {
      if (isNotConfigured(error)) {
        return referencePlan(data.syllabus, data.minutesPerSession);
      }
      throw error;
    }

    const moduleList = [
      ...scenes.map((s) => `- ${s.id} — ${s.title} (${s.subject})`),
      `- ${GENERAL_MODULE_ID} — no 3D module fits; a plain study session`,
    ].join("\n");

    const system = [
      `You are SPATIA's study planner. A student pastes a syllabus; you break it into study sessions and map each one to the closest Spatia 3D module.`,
      `Available modules (sceneId — title, subject):`,
      moduleList,
      `Rules: break the syllabus into 4–14 sessions, one topic per session, foundational topics first. Each session needs a short title of 10 words or fewer, a sceneId that MUST be one of the ids above (use "${GENERAL_MODULE_ID}" when nothing fits), minutes of roughly ${data.minutesPerSession} (10–60 range unless a topic clearly needs more or less), and a dayOffset of 0–27 spreading sessions across about four weeks starting at day 0, with at most ${data.daysPerWeek} sessions in any 7-day block. Write one sentence of plain-text summary plus the items. Plain text only, no markdown, bullet lists or asterisks.`,
    ].join("\n");

    const prompt = `Syllabus to schedule:\n"""${data.syllabus}"""`;

    try {
      const result = await generateText({
        model,
        output: Output.object({ schema: PlanOutput }),
        system,
        prompt,
        temperature: 0.4,
      });

      const items: PlannedItem[] = [];
      for (const item of result.output.items) {
        const sceneId = isKnownModule(item.sceneId) ? item.sceneId : GENERAL_MODULE_ID;
        items.push({
          title: item.title,
          sceneId,
          minutes: Math.min(180, Math.max(5, item.minutes)),
          dayOffset: Math.min(60, Math.max(0, item.dayOffset)),
          notes: item.notes,
        });
        if (items.length === 20) break;
      }
      if (!items.length) return referencePlan(data.syllabus, data.minutesPerSession);
      return { summary: result.output.summary, items, offline: false };
    } catch (error) {
      if (isNotConfigured(error)) {
        return referencePlan(data.syllabus, data.minutesPerSession);
      }
      const status =
        typeof error === "object" && error !== null && "statusCode" in error
          ? Number((error as { statusCode?: unknown }).statusCode)
          : undefined;
      if (status === 429)
        throw new Error("The planner is rate limited right now — try again in a few seconds.");
      if (status === 401 || status === 403)
        throw new Error(
          "The AI API key was rejected. Check ANTHROPIC_API_KEY / GOOGLE_GENERATIVE_AI_API_KEY in .env.",
        );
      throw new Error(error instanceof Error ? error.message : "The planner could not answer that.");
    }
  });
