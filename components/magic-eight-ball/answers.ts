import { CanvasTexture, SRGBColorSpace } from "three";

export type AnswerCategory = "yes" | "no" | "unsure" | "notYesNo" | "rude" | "sensitive";

export const ANSWERS: Record<AnswerCategory, readonly string[]> = {
  yes: [
    "It is certain",
    "It is decidedly so",
    "Without a doubt",
    "Yes, definitely",
    "You may rely on it",
    "As I see it, yes",
    "Most likely",
    "Outlook good",
    "Signs point to yes",
    "Yes",
  ],
  no: [
    "Don’t count on it",
    "My reply is no",
    "My sources say no",
    "Outlook not so good",
    "Very doubtful",
  ],
  unsure: [
    "Reply hazy, try again",
    "Ask again later",
    "Concentrate and ask again",
    "Hard to say",
    "Could go either way",
  ],
  notYesNo: [
    "Yes or no, please",
    "I only do yes or no",
    "That’s not a yes or no",
    "Try a yes or no question",
    "Rephrase that, mortal",
    "I’m a ball, not an encyclopedia",
  ],
  rude: [
    "You’re asking me THAT?!",
    "Weird question, even for you",
    "Did you really just ask that?",
    "I’m a ball, not a therapist",
    "Nope. Not touching that one",
    "Ask your mother",
    "Who hurt you?",
    "That’s a you problem",
  ],
  // Serious topics: a plain refusal, never a joke.
  sensitive: [
    "I can’t answer that",
    "I can’t answer that one",
    "That’s not one I can answer",
    "I won’t answer that",
    "Not a question for me",
    "That’s beyond me",
    "I can’t help with that",
    "No answer for that one",
    "I’ll pass on that one",
    "Not mine to answer",
  ],
};

// Some answers only make sense for a question that called for them: the
// serious refusals, and the complaints about not being a yes/no question.
const NOT_RANDOM: readonly AnswerCategory[] = ["sensitive", "notYesNo"];
const randomPool = (exclude: readonly AnswerCategory[]) =>
  Object.entries(ANSWERS)
    .filter(([category]) => ![...NOT_RANDOM, ...exclude].includes(category as AnswerCategory))
    .flatMap(([, answers]) => answers);

export const ZOOM_QUIPS = [
  "Curious, aren't we?",
  "Personal space, please",
  "I can see your pores",
  "Too close!",
  "Ask, don't stare",
  "Boo!",
  "Nothing to see here",
  "Hi there",
] as const;

const pick = (options: readonly string[]) => options[Math.floor(Math.random() * options.length)];

/** Without a category, `exclude` leaves those categories out of the draw. */
export const randomAnswer = (
  category?: AnswerCategory,
  exclude: readonly AnswerCategory[] = [],
): string => pick(category ? ANSWERS[category] : randomPool(exclude));

// Drawn large because the shader shrinks it onto the die.
const SIZE = 1024;
const FONT_SIZE = SIZE * 0.1;
const MIN_FONT_SIZE = SIZE * 0.055;
const LINE_HEIGHT = 1.12;
// Keeps the block inside the triangle, which narrows towards the bottom.
const MAX_LINE_WIDTH = SIZE * 0.58;
const MAX_BLOCK_HEIGHT = SIZE * 0.42;

// next/font exposes Geist through a CSS variable with a generated family name.
const fontFamily = (): string =>
  getComputedStyle(document.documentElement).getPropertyValue("--font-geist-sans").trim() ||
  "system-ui, sans-serif";

export const loadWindowFont = async (): Promise<void> => {
  await document.fonts.load(`600 ${FONT_SIZE}px ${fontFamily()}`);
  await document.fonts.load(`200 ${FONT_SIZE}px ${fontFamily()}`);
};

/** "|" forces a line break; otherwise words wrap and long text shrinks to fit. */
export function createAnswerTexture(answer: string, { exclaim = false } = {}): CanvasTexture {
  return createTextTexture((ctx) => {
    const text = answer.toUpperCase();
    let size = FONT_SIZE + 4;
    let lines: string[];
    do {
      size -= 4;
      ctx.font = `600 ${size}px ${fontFamily()}`;
      ctx.letterSpacing = `${size * 0.08}px`;
      lines = text.includes("|") ? text.split("|").map((l) => l.trim()) : wrapWords(ctx, text);
      // The "!" takes about two lines of room at the top.
    } while (
      (lines.length + (exclaim ? 2 : 0)) * size * LINE_HEIGHT > MAX_BLOCK_HEIGHT &&
      size > MIN_FONT_SIZE
    );

    const lineHeight = size * LINE_HEIGHT;
    const rows = lines.length + (exclaim ? 2 : 0);
    const top = SIZE / 2 - ((rows - 1) * lineHeight) / 2;
    if (exclaim) {
      ctx.font = `700 ${size * 2}px ${fontFamily()}`;
      ctx.fillText("!", SIZE / 2, top + lineHeight * 0.5);
      ctx.font = `600 ${size}px ${fontFamily()}`;
    }
    const firstLine = top + (exclaim ? lineHeight * 2 : 0);
    lines.forEach((line, i) => ctx.fillText(line, SIZE / 2, firstLine + i * lineHeight));
  });
}

export function createSigilTexture(): CanvasTexture {
  return createTextTexture((ctx) => {
    ctx.font = `200 ${SIZE * 0.46}px ${fontFamily()}`;
    ctx.fillText("8", SIZE / 2, SIZE * 0.52);
  });
}

function createTextTexture(draw: (ctx: CanvasRenderingContext2D) => void): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SIZE;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas context is not available");

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#fff";
  // The blur becomes the glow around the letters (the shader tints it by alpha).
  ctx.shadowColor = "#fff";
  ctx.shadowBlur = SIZE * 0.04;
  draw(ctx);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  // Clamped by three.js to what the GPU supports.
  texture.anisotropy = 8;
  return texture;
}

function wrapWords(ctx: CanvasRenderingContext2D, text: string): string[] {
  const lines: string[] = [];
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const last = lines.at(-1);
    if (last && ctx.measureText(`${last} ${word}`).width <= MAX_LINE_WIDTH) {
      lines[lines.length - 1] = `${last} ${word}`;
    } else {
      lines.push(word);
    }
  }
  return lines;
}
