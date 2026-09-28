"use server";

import type { AnswerCategory } from "@/components/magic-eight-ball/answers";

const MAX_QUESTION_LENGTH = 200;

// What Jev reads to pick each category; the keys match ANSWERS.
const CRITERIA: Record<AnswerCategory, string> = {
  yes: "a yes/no question whose most likely or most hopeful answer is yes",
  no: "a yes/no question whose most likely answer is no",
  unsure:
    "a yes/no question with no reasonable basis to lean either way; a last resort, rarely the right pick",
  notYesNo:
    "a question that can't be answered with yes or no, like what, why, how or who, or text that isn't a question",
  rude: "clearly insulting, crude or vulgar, like slurs, sexual content or attacks on someone, whether or not it is a yes/no question; silly, cheeky, odd or personal questions are not rude",
  sensitive:
    "about suicide, self-harm, killing, death, violence, abuse, dark humor about tragedies, or other fragile topics like serious illness or grief, even as a joke",
};

// The categories the player may turn off.
const OPTIONAL: readonly AnswerCategory[] = ["unsure", "rude"];

// Serious topics win even when Jev only partly suspects them.
const SENSITIVE_THRESHOLD = 0.3;
// Past this, Jev counts as unreachable.
const TIMEOUT_MS = 10_000;

type EvaluateResponse = {
  answers?: {
    category?: { type: "choice"; choice: string; probabilities?: Record<string, number> };
  };
};

/**
 * `noKey`: there's no key, or the gateway rejects it. `unavailable`: Jev
 * couldn't be reached or gave no usable answer. `invalid`: nothing to ask.
 */
export type ClassifyResult =
  | { ok: true; category: AnswerCategory }
  | { ok: false; error: "noKey" | "unavailable" | "invalid" };

const isCategory = (value: unknown): value is AnswerCategory =>
  typeof value === "string" && Object.hasOwn(CRITERIA, value);

/** Picks the answer category for a question with Jev. `exclude` turns off optional categories. */
export async function classifyQuestion(
  question: string,
  exclude: AnswerCategory[] = [],
): Promise<ClassifyResult> {
  // Reachable by direct POST, so the argument may not be a string.
  console.log("[m8] classifyQuestion", { question, hasKey: Boolean(process.env.AI_GATEWAY_API_KEY) });
  const apiKey = process.env.AI_GATEWAY_API_KEY;
  if (!apiKey) return { ok: false, error: "noKey" };
  if (typeof question !== "string") return { ok: false, error: "invalid" };
  const state = question.trim().slice(0, MAX_QUESTION_LENGTH);
  if (!state) return { ok: false, error: "invalid" };
  const excluded = Array.isArray(exclude) ? OPTIONAL.filter((c) => exclude.includes(c)) : [];
  const criteria = Object.fromEntries(
    Object.entries(CRITERIA).filter(([category]) => !excluded.includes(category as AnswerCategory)),
  );

  const response = await fetch("https://ai-gateway.vercel.sh/v1/evaluate", {
    method: "POST",
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "typesafe-ai/jev",
      state: `Someone asks a Magic 8-Ball: ${state}`,
      questions: {
        category: {
          type: "choice",
          instructions:
            "Which kind of Magic 8-Ball answer fits this question best? For a yes/no question, commit to yes or no when you have some reasonable basis to lean one way; it doesn't need to be strong or certain, just more than a coin flip. Pick unsure only as a last resort. Pick rude only when the question is clearly offensive; when in doubt, answer it normally.",
          criteria,
        },
      },
    }),
  }).catch((error: unknown) => {
    // Network failure or timeout.
    console.error("Jev evaluation failed", error);
    return null;
  });
  if (!response) return { ok: false, error: "unavailable" };
  if (!response.ok) {
    console.error(`Jev evaluation failed with ${response.status}`, await response.text());
    const rejected = response.status === 401 || response.status === 403;
    return { ok: false, error: rejected ? "noKey" : "unavailable" };
  }

  const { answers }: EvaluateResponse = await response.json().catch(() => ({}));
  console.log("[m8] Jev answers", JSON.stringify(answers));
  const { choice, probabilities } = answers?.category ?? {};
  if ((probabilities?.sensitive ?? 0) >= SENSITIVE_THRESHOLD) return { ok: true, category: "sensitive" };
  return isCategory(choice) && !excluded.includes(choice)
    ? { ok: true, category: choice }
    : { ok: false, error: "unavailable" };
}
