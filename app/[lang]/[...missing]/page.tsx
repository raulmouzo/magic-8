import { notFound } from "next/navigation";

// Unknown paths inside a language get that language's not-found page;
// otherwise Next.js would show its default one, outside the layout.
export default function Missing() {
  notFound();
}
