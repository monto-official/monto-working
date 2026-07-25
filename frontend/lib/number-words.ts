/**
 * Parses a spoken number (0–20) out of a speech-to-text transcript.
 * Kids answer in whatever language/script they spoke in — English digits or
 * words, Nepali Devanagari digits or words, or Romanized Nepali/Hindi — so
 * this checks all of them rather than assuming one language.
 */

const WORD_TO_NUMBER: Record<string, number> = {
  // English
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19, twenty: 20,

  // Nepali (Devanagari)
  "शून्य": 0, "सुन्य": 0, "एक": 1, "दुई": 2, "तीन": 3, "चार": 4,
  "पाँच": 5, "पांच": 5, "छ": 6, "सात": 7, "आठ": 8, "नौ": 9,
  "दश": 10, "दस": 10, "एघार": 11, "बाह्र": 12, "बाह्रह": 12, "तेह्र": 13,
  "चौध": 14, "पन्ध्र": 15, "सोह्र": 16, "सत्र": 17, "अठार": 18,
  "उन्नाइस": 19, "बीस": 20,

  // Romanized Nepali / Hindi (shared vocabulary, common spelling variants)
  sunya: 0, shunya: 0, ek: 1, euta: 1, dui: 2, duy: 2, do: 2, teen: 3,
  tin: 3, char: 4, chaar: 4, panch: 5, paanch: 5, chha: 6, cha: 6, chhe: 6,
  saat: 7, sat: 7, aath: 8, aat: 8, nau: 9, nou: 9, das: 10, dash: 10,
  dus: 10, eghar: 11, egharaa: 11, baahra: 12, barha: 12, bahra: 12,
  tehra: 13, tera: 13, chaudha: 14, pandhra: 15, pandra: 15, sohra: 16,
  sora: 16, satra: 17, athhara: 18, athaara: 18, unnais: 19, unnaais: 19,
  bees: 20, bis: 20,
};

const DEVANAGARI_DIGITS: Record<string, string> = {
  "०": "0", "१": "1", "२": "2", "३": "3", "४": "4",
  "५": "5", "६": "6", "७": "7", "८": "8", "९": "9",
};

function devanagariDigitsToArabic(text: string): string {
  return text.replace(/[०-९]/g, (ch) => DEVANAGARI_DIGITS[ch] ?? ch);
}

/** Returns the first number (0–20) found in the transcript, or null if none. */
export function extractSpokenNumber(transcript: string): number | null {
  if (!transcript?.trim()) return null;

  const normalized = devanagariDigitsToArabic(transcript.toLowerCase());

  // Explicit digits win — unambiguous regardless of language.
  const digitMatch = normalized.match(/\d+/);
  if (digitMatch) return parseInt(digitMatch[0], 10);

  // Otherwise look for a known number word, in any supported language/script.
  const tokens = normalized.match(/[\p{L}]+/gu) ?? [];
  for (const token of tokens) {
    if (token in WORD_TO_NUMBER) return WORD_TO_NUMBER[token];
  }

  // Whisper sometimes appends/drops a trailing vowel or matra on a number
  // word ("chaudhai" instead of "chaudha", "बाह्रै" instead of "बाह्र") —
  // fall back to substring matching so close-enough spellings still count.
  const knownWords = Object.keys(WORD_TO_NUMBER).sort((a, b) => b.length - a.length);
  for (const token of tokens) {
    if (token.length < 3) continue; // too short to fuzzy-match safely
    const match = knownWords.find(word => word.length >= 3 && (token.startsWith(word) || word.startsWith(token)));
    if (match) return WORD_TO_NUMBER[match];
  }
  return null;
}
