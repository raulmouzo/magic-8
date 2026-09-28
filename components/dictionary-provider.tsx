"use client";

// Hands the server-loaded texts to Client Components.

import { createContext, type ReactNode, use } from "react";
import type { Dictionary } from "@/app/[lang]/dictionaries";

const DictionaryContext = createContext<Dictionary | null>(null);

export function DictionaryProvider({
  dictionary,
  children,
}: {
  dictionary: Dictionary;
  children: ReactNode;
}) {
  return <DictionaryContext value={dictionary}>{children}</DictionaryContext>;
}

export function useDictionary(): Dictionary {
  const dictionary = use(DictionaryContext);
  if (!dictionary) throw new Error("useDictionary must be used inside a DictionaryProvider");
  return dictionary;
}
