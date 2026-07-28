/**
 * Script detection for the bilingual name fields.
 *
 * Names are validated by the *letters* they contain — digits, spaces and
 * punctuation are script-neutral and stay allowed in either language.
 * The lookahead pairs a script with the letter category, so Arabic-Indic
 * digits (٠-٩) are not mistaken for Arabic letters.
 */

const ARABIC_LETTER = /(?=\p{Script=Arabic})\p{L}/u;
const LATIN_LETTER = /(?=\p{Script=Latin})\p{L}/u;

export function containsArabic(value: string): boolean {
  return ARABIC_LETTER.test(value);
}

export function containsLatin(value: string): boolean {
  return LATIN_LETTER.test(value);
}

/** True when the value has no Arabic letters. Empty values count as valid. */
export function isEnglishOnly(value: string): boolean {
  return !containsArabic(value);
}

/** True when the value has no Latin letters. Empty values count as valid. */
export function isArabicOnly(value: string): boolean {
  return !containsLatin(value);
}
