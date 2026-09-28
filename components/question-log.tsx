"use client";

// The question being asked, above the ball, and the last few answers once it's done.

import { useDictionary } from "@/components/dictionary-provider";
import type { AnswerCategory } from "@/components/magic-eight-ball/answers";

export type LogEntry = {
  id: number;
  /** Null when the ball was asked without a question. */
  question: string | null;
  answer?: string;
  /** Missing when the ball was given exact text. */
  category?: AnswerCategory;
};

const LABEL_STYLES: Record<AnswerCategory, string> = {
  yes: "bg-emerald-400/15 text-emerald-200",
  no: "bg-rose-400/15 text-rose-200",
  unsure: "bg-amber-300/15 text-amber-100",
  notYesNo: "bg-sky-400/15 text-sky-200",
  rude: "bg-fuchsia-400/15 text-fuchsia-200",
  sensitive: "bg-violet-200/10 text-violet-200/70",
};

function QuestionText({ question, className }: { question: string | null; className: string }) {
  const { questionLog: t } = useDictionary();
  return question ? (
    <p className={className}>{question}</p>
  ) : (
    <p className={`${className} italic opacity-60`}>{t.random}</p>
  );
}

type Props = {
  current: LogEntry | null;
  history: LogEntry[];
  /** Shows only the current question, e.g. while the keyboard takes the space. */
  compact?: boolean;
};

export function QuestionLog({ current, history, compact = false }: Props) {
  const { questionLog: t } = useDictionary();
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
          <span className="flex gap-1" aria-label={t.thinking}>
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
      aria-label={t.recent}
      className="flex w-full max-w-sm flex-col gap-2 transition duration-500 starting:opacity-0"
    >
      {history.map((entry, index) => {
        const { category } = entry;
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
            {category && (
              <span
                className={`flex-none rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-[0.15em] uppercase ${LABEL_STYLES[category]}`}
              >
                {t.labels[category]}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
