import { match } from "@formatjs/intl-localematcher";
import Negotiator from "negotiator";
import { type NextRequest, NextResponse } from "next/server";
import { defaultLocale, locales } from "@/i18n/locales";

// Accept-Language follows the browser's language settings, which default to the system's.
function getLocale(request: NextRequest): string {
  const headers = { "accept-language": request.headers.get("accept-language") ?? "" };
  const languages = new Negotiator({ headers }).languages();
  return match(languages, locales, defaultLocale);
}

/** Sends paths without a language prefix to the visitor's language, e.g. / to /gl. */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`,
  );
  if (pathnameHasLocale) return;

  request.nextUrl.pathname = `/${getLocale(request)}${pathname}`;
  return NextResponse.redirect(request.nextUrl);
}

export const config = {
  matcher: [
    // Everything but Next.js internals and files (icons, manifest, public/).
    "/((?!_next|.*\\..*).*)",
  ],
};
