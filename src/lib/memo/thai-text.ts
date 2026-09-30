const segmenter = new Intl.Segmenter("th", { granularity: "word" });
const THAI = /[฀-๿]/;

/** Thai words in order, including spaces and punctuation as their own pieces. */
export function thaiWords(text: string): string[] {
  return Array.from(segmenter.segment(text), (s) => s.segment);
}

/**
 * Word does not know where Thai lines may break, so we insert zero-width spaces
 * between Thai words. Invisible, but it lets Word fill lines instead of wrapping early.
 */
export function withBreakHints(text: string): string {
  return thaiWords(text).reduce(
    (out, word, i, all) => (i > 0 && THAI.test(all[i - 1]) && THAI.test(word) ? `${out}​${word}` : out + word),
    "",
  );
}
