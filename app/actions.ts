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

type EvaluateResponse = {
  answers?: {
    category?: { type: "choice"; choice: string; probabilities?: Record<string, number> };
  };
};

const isCategory = (value: unknown): value is AnswerCategory =>
  typeof value === "string" && Object.hasOwn(CRITERIA, value);

/** Picks the answer category for a question with Jev, or null if it can't. `exclude` turns off optional categories. */
export async function classifyQuestion(
  question: string,
  exclude: AnswerCategory[] = [],
): Promise<AnswerCategory | null> {
  // Reachable by direct POST, so the argument may not be a string.
  console.log("[m8] classifyQuestion", { question, hasKey: Boolean(process.env.AI_GATEWAY_API_KEY) });
  if (typeof question !== "string") return null;
  const state = question.trim().slice(0, MAX_QUESTION_LENGTH);
  const apiKey = process.env.AI_GATEWAY_API_KEY;
  if (!state || !apiKey) return null;
  const excluded = Array.isArray(exclude) ? OPTIONAL.filter((c) => exclude.includes(c)) : [];
  const criteria = Object.fromEntries(
    Object.entries(CRITERIA).filter(([category]) => !excluded.includes(category as AnswerCategory)),
  );

  const response = await fetch("https://ai-gateway.vercel.sh/v1/evaluate", {
    method: "POST",
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
  });
  if (!response.ok) {
    console.error(`Jev evaluation failed with ${response.status}`, await response.text());
    return null;
  }

  const { answers }: EvaluateResponse = await response.json();
  console.log("[m8] Jev answers", JSON.stringify(answers));
  const { choice, probabilities } = answers?.category ?? {};
  if ((probabilities?.sensitive ?? 0) >= SENSITIVE_THRESHOLD) return "sensitive";
  return isCategory(choice) && !excluded.includes(choice) ? choice : null;
}
