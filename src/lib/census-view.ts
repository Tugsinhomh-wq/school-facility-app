// Small pure helpers of the /census pages (kept apart from the components so `npm test` can load them).

/** ?term= when it is one of the viewer's terms; anything else (missing, "abc", a stranger's term) is the newest, or null with no terms. */
export function resolveTerm(raw: string | string[] | undefined, terms: string[]): string | null {
  const wanted = Array.isArray(raw) ? raw[0] : raw;
  return terms.find((t) => t === wanted) ?? terms[0] ?? null;
}

/** `path` with ?term= kept, so a back link returns to the term the viewer was on. */
export const censusHref = (path: string, term: string | null) =>
  term ? `${path}?${new URLSearchParams({ term })}` : path;

/** The delete-the-term form is armed only when the typed text is the term; the action checks the same again. */
export const termConfirmed = (typed: string, term: string) => typed.trim() === term;
