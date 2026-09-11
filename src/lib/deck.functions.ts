import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";

import { getModel } from "./ai.server";
import { splitSyllabusTopics } from "./plan.functions";
import { scenes } from "./scenes";

const DeckCardOutput = z.object({
  front: z.string().min(1).max(200),
  back: z.string().min(1).max(500),
  topic: z.string().max(120).optional(),
});

const DeckOutput = z.object({
  cards: z.array(DeckCardOutput).min(1).max(30),
});

export type AiCard = {
  front: string;
  back: string;
  topic?: string | undefined;
};

export type SyllabusDeck = {
  cards: AiCard[];
  offline: boolean;
};

/* ---------------- Offline fallback: topics + hotspot reference ---------------- */

function referenceDeck(syllabus: string, count: number): SyllabusDeck {
  const topics = splitSyllabusTopics(syllabus, count);
  const list = topics.length ? topics : ["General review"];
  const hotspots = scenes.flatMap((s) => s.hotspots.map((h) => ({ scene: s.title, h })));
  const cards: AiCard[] = list.slice(0, count).map((topic) => {
    const lower = topic.toLowerCase();
    const hit = hotspots.find(({ h }) => {
      const name = h.name.toLowerCase();
      if (name.length > 3 && lower.includes(name)) return true;
      return name
        .split(/[\s–—-]+/)
        .some((w) => w.length > 4 && lower.includes(w));
    });
    return {
      front: topic,
      back: hit
        ? `${hit.h.name} (${hit.scene}): ${hit.h.summary}${hit.h.facts[0] ? ` Remember: ${hit.h.facts[0]}.` : ""}`
        : `${topic}: the short version — what it is, why it matters, and the one formula or fact examiners always ask about. Add an API key for the full AI-written explainer.`,
      topic: hit?.scene,
    };
  });
  return { cards, offline: true };
}

function isNotConfigured(error: unknown) {
  return error instanceof Error && error.message.startsWith("AI tutor is not configured");
}

export const buildDeck = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        syllabus: z.string().min(10).max(8000),
        count: z.number().int().min(4).max(24).default(12),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<SyllabusDeck> => {
    let model;
    try {
      model = getModel();
    } catch (error) {
      if (isNotConfigured(error)) {
        return referenceDeck(data.syllabus, data.count);
      }
      throw error;
    }

    const moduleList = scenes.map((s) => `- ${s.title} (${s.subject})`).join("\n");

    const system = [
      `You are SPATIA's study-note author. A student gives you a syllabus; you write short concept explainer cards from it — mini formula sheets, not quiz questions.`,
      `Syllabus topics may overlap these Spatia 3D modules:`,
      moduleList,
      `Rules: write about ${data.count} cards, one concept per card, foundational topics first. Each front is the concept name or formula title of 80 characters or fewer — never a question. Each back is a short explainer of 400 characters or fewer: one plain sentence saying what it is, then the must-remember points or the key formula with each symbol named, grounded in the syllabus wording and in the matching module's subject where one fits. Each topic is a label of 2–4 words. Plain text only, no markdown, bullet lists or asterisks.`,
    ].join("\n");

    const prompt = `Build about ${data.count} flash cards from this syllabus:\n"""${data.syllabus}"""`;

    try {
      const result = await generateText({
        model,
        output: Output.object({ schema: DeckOutput }),
        system,
        prompt,
        temperature: 0.5,
      });

      const cards: AiCard[] = [];
      for (const card of result.output.cards) {
        const front = card.front.trim();
        const back = card.back.trim();
        if (!front || !back) continue;
        cards.push({ front, back, topic: card.topic?.trim() || undefined });
        if (cards.length === data.count) break;
      }
      if (!cards.length) return referenceDeck(data.syllabus, data.count);
      return { cards, offline: false };
    } catch (error) {
      if (isNotConfigured(error)) {
        return referenceDeck(data.syllabus, data.count);
      }
      const status =
        typeof error === "object" && error !== null && "statusCode" in error
          ? Number((error as { statusCode?: unknown }).statusCode)
          : undefined;
      if (status === 429)
        throw new Error("The card builder is rate limited right now — try again in a few seconds.");
      if (status === 401 || status === 403)
        throw new Error(
          "The AI API key was rejected. Check ANTHROPIC_API_KEY / GOOGLE_GENERATIVE_AI_API_KEY in .env.",
        );
      throw new Error(
        error instanceof Error ? error.message : "The card builder could not answer that.",
      );
    }
  });
