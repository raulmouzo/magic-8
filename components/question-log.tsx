"use client";

// The question being asked, above the ball, and the last few answers once it's done.

import { ANSWERS, type AnswerCategory } from "@/components/magic-eight-ball/answers";

export type LogEntry = {
  id: number;
  /** Null when the ball was asked without a question. */
  question: string | null;
  answer?: string;
};

const LABELS: Record<AnswerCategory, { text: string; className: string }> = {
  yes: { text: "Yes", className: "bg-emerald-400/15 text-emerald-200" },
  no: { text: "No", className: "bg-rose-400/15 text-rose-200" },
  unsure: { text: "Maybe", className: "bg-amber-300/15 text-amber-100" },
  notYesNo: { text: "Rephrase", className: "bg-sky-400/15 text-sky-200" },
  rude: { text: "Sassy", className: "bg-fuchsia-400/15 text-fuchsia-200" },
  sensitive: { text: "Pass", className: "bg-violet-200/10 text-violet-200/70" },
};

const categoryOf = (answer: string) =>
  (Object.keys(ANSWERS) as AnswerCategory[]).find((category) =>
    ANSWERS[category].includes(answer),
  );

const QuestionText = ({ question, className }: { question: string | null; className: string }) =>
  question ? (
    <p className={className}>{question}</p>
  ) : (
    <p className={`${className} italic opacity-60`}>Random</p>
  );

type Props = {
  current: LogEntry | null;
  history: LogEntry[];
  /** Shows only the current question, e.g. while the keyboard takes the space. */
  compact?: boolean;
};

export function QuestionLog({ current, history, compact = false }: Props) {
  if (current) {
    return (
      <div
        key={current.id}
        className="flex max-w-md flex-col items-center gap-2 text-center transition duration-500 starting:translate-y-1 starting:opacity-0"
      >
        <QuestionText
          question={current.question}
          className="line-clamp-3 text-base leading-snug text-violet-50 [overflow-wrap:anywhere] md:text-lg"
        />
        {!current.answer && (
          // Waiting for the ball.
          <span className="flex gap-1" aria-label="The ball is thinking">
            {[0, 150, 300].map((delay) => (
              <i
                key={delay}
                className="size-1 animate-pulse rounded-full bg-violet-200/60"
                style={{ animationDelay: `${delay}ms` }}
              />
            ))}
          </span>
        )}
      </div>
    );
  }

  if (compact || history.length === 0) return null;

  return (
    <ul
      aria-label="Recent answers"
      className="flex w-full max-w-sm flex-col gap-2 transition duration-500 starting:opacity-0"
    >
      {history.map((entry, index) => {
        const category = entry.answer ? categoryOf(entry.answer) : undefined;
        const label = category ? LABELS[category] : null;
        return (
          <li
            key={entry.id}
            // Older answers fade into the background.
            style={{ opacity: 1 - index * 0.25 }}
            // Phones have room for two above the ball.
            className={`flex items-center gap-3 rounded-2xl border border-violet-200/10 bg-violet-950/30 px-4 py-2 backdrop-blur-md ${index >= 2 ? "max-md:hidden" : ""}`}
          >
            <div className="min-w-0 flex-1">
              <QuestionText
                question={entry.question}
                className="truncate text-xs text-violet-200/60"
              />
              <p className="truncate text-sm text-violet-50">{entry.answer}</p>
            </div>
            {label && (
              <span
                className={`flex-none rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-[0.15em] uppercase ${label.className}`}
              >
                {label.text}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
