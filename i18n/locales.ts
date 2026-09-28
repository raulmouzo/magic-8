// The languages the app is translated into; the first path segment is one of these.
export const locales = ["en", "es", "gl"] as const;

export type Locale = (typeof locales)[number];

// For visitors whose browser asks for none of the above.
export const defaultLocale: Locale = "en";

export const hasLocale = (locale: string): locale is Locale =>
  (locales as readonly string[]).includes(locale);
