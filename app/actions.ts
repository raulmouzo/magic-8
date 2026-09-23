"use server";

import type { AnswerCategory } from "@/components/magic-eight-ball/answers";

const MAX_QUESTION_LENGTH = 200;

// What Jev reads to pick each category; the keys match ANSWERS.
const CRITERIA: Record<AnswerCategory, string> = {
  yes: "a polite yes/no question whose most likely or most hopeful answer is yes",
  no: "a polite yes/no question whose most likely answer is no",
  unsure: "a polite yes/no question that is genuinely uncertain or depends on chance",
  notYesNo:
    "a polite question that can't be answered with yes or no, like what, why, how or who, or text that isn't a question",
  rude: "rude, insulting, vulgar, absurd or too personal for a toy, whether or not it is a yes/no question",
  sensitive:
    "about suicide, self-harm, killing, death, violence, abuse, dark humor about tragedies, or other fragile topics like serious illness or grief, even as a joke",
};

// Serious topics win even when Jev only partly suspects them.
const SENSITIVE_THRESHOLD = 0.3;

type EvaluateResponse = {
  answers?: {
    category?: { type: "choice"; choice: string; probabilities?: Record<string, number> };
  };
};

const isCategory = (value: unknown): value is AnswerCategory =>
  typeof value === "string" && Object.hasOwn(CRITERIA, value);

/** Picks the answer category for a question with Jev, or null if it can't. */
export async function classifyQuestion(question: string): Promise<AnswerCategory | null> {
  // Reachable by direct POST, so the argument may not be a string.
  if (typeof question !== "string") return null;
  const state = question.trim().slice(0, MAX_QUESTION_LENGTH);
  const apiKey = process.env.AI_GATEWAY_API_KEY;
  if (!state || !apiKey) return null;

  const response = await fetch("https://ai-gateway.vercel.sh/v1/evaluate", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "typesafe-ai/jev",
      state: `Someone asks a Magic 8-Ball: ${state}`,
      questions: {
        category: {
          type: "choice",
          instructions: "Which kind of Magic 8-Ball answer fits this question best?",
          criteria: CRITERIA,
        },
      },
    }),
  });
  if (!response.ok) {
    console.error(`Jev evaluation failed with ${response.status}`);
    return null;
  }

  const { answers }: EvaluateResponse = await response.json();
  const { choice, probabilities } = answers?.category ?? {};
  if ((probabilities?.sensitive ?? 0) >= SENSITIVE_THRESHOLD) return "sensitive";
  return isCategory(choice) ? choice : null;
}
