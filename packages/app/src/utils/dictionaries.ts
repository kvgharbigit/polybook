/**
 * Dictionary URL generator with explicit language pairs and fallbacks
 */
export function getDictionaryUrls({
  sourceLang,        // ISO-2 like 'en', 'es', 'fr', 'de', 'it', 'pt', 'ru', ...
  nativeLang,        // user's home language ISO-2
  word,
}: { sourceLang: string; nativeLang: string; word: string }) {
  const w = encodeURIComponent(word.trim().toLowerCase());

  // WordReference pair slugs (most robust for Romance langs)
  const WR: Record<string, string> = {
    'en-es': `https://www.wordreference.com/enes/${w}`,
    'es-en': `https://www.wordreference.com/esen/${w}`,
    'en-fr': `https://www.wordreference.com/enfr/${w}`,
    'fr-en': `https://www.wordreference.com/fren/${w}`,
    'en-it': `https://www.wordreference.com/enit/${w}`,
    'it-en': `https://www.wordreference.com/iten/${w}`,
    'en-pt': `https://www.wordreference.com/enpt/${w}`,
    'pt-en': `https://www.wordreference.com/pten/${w}`,
    'en-de': `https://www.wordreference.com/ende/${w}`,
    'de-en': `https://www.wordreference.com/deen/${w}`,
  };

  // Cambridge bilingual (good coverage; stable paths)
  const CAM: Record<string, string> = {
    'en-es': `https://dictionary.cambridge.org/dictionary/english-spanish/${w}`,
    'es-en': `https://dictionary.cambridge.org/dictionary/spanish-english/${w}`,
    'en-fr': `https://dictionary.cambridge.org/dictionary/english-french/${w}`,
    'fr-en': `https://dictionary.cambridge.org/dictionary/french-english/${w}`,
    'en-pt': `https://dictionary.cambridge.org/dictionary/english-portuguese/${w}`,
    'pt-en': `https://dictionary.cambridge.org/dictionary/portuguese-english/${w}`,
    'en-it': `https://dictionary.cambridge.org/dictionary/english-italian/${w}`,
    'it-en': `https://dictionary.cambridge.org/dictionary/italian-english/${w}`,
    'en-de': `https://dictionary.cambridge.org/dictionary/english-german/${w}`,
    'de-en': `https://dictionary.cambridge.org/dictionary/german-english/${w}`,
    'en-zh': `https://dictionary.cambridge.org/dictionary/english-chinese-simplified/${w}`,
    'zh-en': `https://dictionary.cambridge.org/dictionary/chinese-english/${w}`,
  };

  // Context/example-focused
  const LING: Record<string, string> = {
    'en-es': `https://www.linguee.com/english-spanish/search?query=${w}`,
    'es-en': `https://www.linguee.com/spanish-english/search?query=${w}`,
    'en-fr': `https://www.linguee.com/english-french/search?query=${w}`,
    'fr-en': `https://www.linguee.com/french-english/search?query=${w}`,
    'en-de': `https://www.linguee.com/english-german/search?query=${w}`,
    'de-en': `https://www.linguee.com/german-english/search?query=${w}`,
    'en-pt': `https://www.linguee.com/english-portuguese/search?query=${w}`,
    'pt-en': `https://www.linguee.com/portuguese-english/search?query=${w}`,
    'en-it': `https://www.linguee.com/english-italian/search?query=${w}`,
    'it-en': `https://www.linguee.com/italian-english/search?query=${w}`,
  };

  // PONS (great for DE and forms)
  const PONS: Record<string, string> = {
    'en-de': `https://en.pons.com/translate/english-german/${w}`,
    'de-en': `https://en.pons.com/translate/german-english/${w}`,
    'en-es': `https://en.pons.com/translate/english-spanish/${w}`,
    'es-en': `https://en.pons.com/translate/spanish-english/${w}`,
    'en-fr': `https://en.pons.com/translate/english-french/${w}`,
    'fr-en': `https://en.pons.com/translate/french-english/${w}`,
  };

  // Reverso (covers RU, AR, etc.)
  const REVERSO: Record<string, string> = {
    'en-ru': `https://context.reverso.net/translation/english-russian/${w}`,
    'ru-en': `https://context.reverso.net/translation/russian-english/${w}`,
    'en-ar': `https://context.reverso.net/translation/english-arabic/${w}`,
    'ar-en': `https://context.reverso.net/translation/arabic-english/${w}`,
    'en-zh': `https://context.reverso.net/translation/english-chinese/${w}`,
    'zh-en': `https://context.reverso.net/translation/chinese-english/${w}`,
    'en-ja': `https://context.reverso.net/translation/english-japanese/${w}`,
    'ja-en': `https://context.reverso.net/translation/japanese-english/${w}`,
  };

  // Monolingual fallbacks (if pair missing)
  const MONO: Record<string, string> = {
    en: `https://www.merriam-webster.com/dictionary/${w}`,
    es: `https://dle.rae.es/${w}`,         // RAE
    fr: `https://www.larousse.fr/dictionnaires/francais/${w}`,
    de: `https://www.duden.de/suchen/dudenonline/${w}`,
    it: `https://www.treccani.it/vocabolario/ricerca/${w}/`,
    pt: `https://michaelis.uol.com.br/moderno-portugues/busca/portugues-brasileiro/${w}/`,
    ru: `https://dic.academic.ru/searchall.php?SWord=${w}`,
    zh: `https://www.zdic.net/hans/${w}`,
    ja: `https://jisho.org/search/${w}`,
    ar: `https://www.almaany.com/ar/dict/ar-ar/${w}/`,
  };

  const key = `${sourceLang}-${nativeLang}`.toLowerCase();

  // Ordered preference per pair type
  const ordered: string[] = [];

  // 1. WordReference first for Romance languages and major pairs
  if (WR[key]) {
    ordered.push(WR[key]);
  }

  // 2. Cambridge for comprehensive coverage
  if (CAM[key]) {
    ordered.push(CAM[key]);
  }

  // 3. Linguee for context and examples
  if (LING[key]) {
    ordered.push(LING[key]);
  }

  // 4. PONS for German and detailed forms
  if (PONS[key]) {
    ordered.push(PONS[key]);
  }

  // 5. Reverso for less common pairs and context
  if (REVERSO[key]) {
    ordered.push(REVERSO[key]);
  }

  // 6. Monolingual in user's native language as fallback
  if (MONO[nativeLang]) {
    ordered.push(MONO[nativeLang]);
  }

  // 7. As a last resort, Google Translate with bilingual UI
  ordered.push(
    `https://translate.google.com/?sl=${sourceLang}&tl=${nativeLang}&text=${w}&op=translate`
  );

  return ordered.filter(Boolean);
}

/**
 * Get human-readable language name
 */
export function getLanguageName(code: string): string {
  const names: Record<string, string> = {
    en: 'English',
    es: 'Spanish',
    fr: 'French',
    de: 'German',
    it: 'Italian',
    pt: 'Portuguese',
    ru: 'Russian',
    zh: 'Chinese',
    ja: 'Japanese',
    ar: 'Arabic',
    ko: 'Korean',
    hi: 'Hindi',
    nl: 'Dutch',
    sv: 'Swedish',
    no: 'Norwegian',
    da: 'Danish',
    fi: 'Finnish',
    pl: 'Polish',
    cs: 'Czech',
    sk: 'Slovak',
    hu: 'Hungarian',
    ro: 'Romanian',
    bg: 'Bulgarian',
    hr: 'Croatian',
    sr: 'Serbian',
    sl: 'Slovenian',
    et: 'Estonian',
    lv: 'Latvian',
    lt: 'Lithuanian',
    mt: 'Maltese',
    ga: 'Irish',
    cy: 'Welsh',
    eu: 'Basque',
    ca: 'Catalan',
    gl: 'Galician',
    tr: 'Turkish',
    he: 'Hebrew',
    th: 'Thai',
    vi: 'Vietnamese',
    id: 'Indonesian',
    ms: 'Malay',
    tl: 'Filipino',
    sw: 'Swahili',
    am: 'Amharic',
    fa: 'Persian',
    ur: 'Urdu',
    bn: 'Bengali',
    ta: 'Tamil',
    te: 'Telugu',
    kn: 'Kannada',
    ml: 'Malayalam',
    si: 'Sinhala',
    my: 'Myanmar',
    km: 'Khmer',
    lo: 'Lao',
    ka: 'Georgian',
    hy: 'Armenian',
    az: 'Azerbaijani',
    kk: 'Kazakh',
    ky: 'Kyrgyz',
    uz: 'Uzbek',
    mn: 'Mongolian',
    ne: 'Nepali',
    ps: 'Pashto',
    sd: 'Sindhi',
    gu: 'Gujarati',
    pa: 'Punjabi',
    or: 'Odia',
    as: 'Assamese',
    mk: 'Macedonian',
    sq: 'Albanian',
    is: 'Icelandic',
    fo: 'Faroese',
    lb: 'Luxembourgish',
    rm: 'Romansh',
    co: 'Corsican',
    br: 'Breton',
    gd: 'Scottish Gaelic',
    mn: 'Mongolian',
  };
  return names[code] || code.toUpperCase();
}