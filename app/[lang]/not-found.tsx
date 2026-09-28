import type { Metadata } from "next";
import Link from "next/link";
import { lang } from "next/root-params";
import { getDictionary } from "./dictionaries";

export async function generateMetadata(): Promise<Metadata> {
  const { metadata } = await getDictionary();
  return { title: metadata.notFoundTitle };
}

export default async function NotFound() {
  const { notFound: t } = await getDictionary();
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-10 px-[max(1.5rem,env(safe-area-inset-left),env(safe-area-inset-right))] py-16 text-center">
      <div className="flex flex-col items-center gap-3">
        <p className="text-xs tracking-[0.3em] text-violet-200/50 uppercase">
          {t.error}
        </p>
        <h1 className="text-2xl font-semibold text-violet-50 md:text-3xl">
          {t.title}
        </h1>
        <p className="max-w-xs text-sm text-violet-200/60">
          {t.body}
        </p>
      </div>

      <Link
        href={`/${await lang()}`}
        className="rounded-full border border-violet-200/15 bg-violet-950/30 px-8 py-3 text-sm font-semibold tracking-[0.25em] text-violet-50 uppercase shadow-[0_0_40px_-8px_#A855F7] backdrop-blur-md transition hover:border-violet-200/30 hover:bg-violet-900/40 hover:shadow-[0_0_48px_-4px_#A855F7] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-300"
      >
        {t.back}
      </Link>
    </main>
  );
}
