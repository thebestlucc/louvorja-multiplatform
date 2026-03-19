export type BookCategory =
  | "pentateuch"
  | "historical"
  | "poetic"
  | "majorProphets"
  | "minorProphets"
  | "gospels"
  | "acts"
  | "pauline"
  | "generalEpistles"
  | "revelation";

export interface PeriodicBook {
  abbr: string;
  name: string;
  cat: BookCategory;
}

export type BibleLanguage = "pt" | "en" | "es";

// 66 books arranged in 6 rows × 11 columns (periodic table layout)
export const PERIODIC_BOOKS: PeriodicBook[] = [
  // Row 1: Pentateuch (5) + Historical (6)
  { abbr: "Gn", name: "Gênesis", cat: "pentateuch" },
  { abbr: "Êx", name: "Êxodo", cat: "pentateuch" },
  { abbr: "Lv", name: "Levítico", cat: "pentateuch" },
  { abbr: "Nm", name: "Números", cat: "pentateuch" },
  { abbr: "Dt", name: "Deuteronômio", cat: "pentateuch" },
  { abbr: "Js", name: "Josué", cat: "historical" },
  { abbr: "Jz", name: "Juízes", cat: "historical" },
  { abbr: "Rt", name: "Rute", cat: "historical" },
  { abbr: "1Sm", name: "1 Samuel", cat: "historical" },
  { abbr: "2Sm", name: "2 Samuel", cat: "historical" },
  { abbr: "1Rs", name: "1 Reis", cat: "historical" },
  // Row 2: Historical (6) + Poetic (5)
  { abbr: "2Rs", name: "2 Reis", cat: "historical" },
  { abbr: "1Cr", name: "1 Crônicas", cat: "historical" },
  { abbr: "2Cr", name: "2 Crônicas", cat: "historical" },
  { abbr: "Ed", name: "Esdras", cat: "historical" },
  { abbr: "Ne", name: "Neemias", cat: "historical" },
  { abbr: "Et", name: "Ester", cat: "historical" },
  { abbr: "Jó", name: "Jó", cat: "poetic" },
  { abbr: "Sl", name: "Salmos", cat: "poetic" },
  { abbr: "Pv", name: "Provérbios", cat: "poetic" },
  { abbr: "Ec", name: "Eclesiastes", cat: "poetic" },
  { abbr: "Ct", name: "Cantares", cat: "poetic" },
  // Row 3: Major Prophets (5) + Minor Prophets (6)
  { abbr: "Is", name: "Isaías", cat: "majorProphets" },
  { abbr: "Jr", name: "Jeremias", cat: "majorProphets" },
  { abbr: "Lm", name: "Lamentações", cat: "majorProphets" },
  { abbr: "Ez", name: "Ezequiel", cat: "majorProphets" },
  { abbr: "Dn", name: "Daniel", cat: "majorProphets" },
  { abbr: "Os", name: "Oséias", cat: "minorProphets" },
  { abbr: "Jl", name: "Joel", cat: "minorProphets" },
  { abbr: "Am", name: "Amós", cat: "minorProphets" },
  { abbr: "Ob", name: "Obadias", cat: "minorProphets" },
  { abbr: "Jn", name: "Jonas", cat: "minorProphets" },
  { abbr: "Mq", name: "Miquéias", cat: "minorProphets" },
  // Row 4: Minor Prophets (6) + Gospels (4) + Acts (1)
  { abbr: "Na", name: "Naum", cat: "minorProphets" },
  { abbr: "Hc", name: "Habacuque", cat: "minorProphets" },
  { abbr: "Sf", name: "Sofonias", cat: "minorProphets" },
  { abbr: "Ag", name: "Ageu", cat: "minorProphets" },
  { abbr: "Zc", name: "Zacarias", cat: "minorProphets" },
  { abbr: "Ml", name: "Malaquias", cat: "minorProphets" },
  { abbr: "Mt", name: "Mateus", cat: "gospels" },
  { abbr: "Mc", name: "Marcos", cat: "gospels" },
  { abbr: "Lc", name: "Lucas", cat: "gospels" },
  { abbr: "Jo", name: "João", cat: "gospels" },
  { abbr: "At", name: "Atos", cat: "acts" },
  // Row 5: Pauline Epistles (11)
  { abbr: "Rm", name: "Romanos", cat: "pauline" },
  { abbr: "1Co", name: "1 Coríntios", cat: "pauline" },
  { abbr: "2Co", name: "2 Coríntios", cat: "pauline" },
  { abbr: "Gl", name: "Gálatas", cat: "pauline" },
  { abbr: "Ef", name: "Efésios", cat: "pauline" },
  { abbr: "Fp", name: "Filipenses", cat: "pauline" },
  { abbr: "Cl", name: "Colossenses", cat: "pauline" },
  { abbr: "1Ts", name: "1 Tessalonicenses", cat: "pauline" },
  { abbr: "2Ts", name: "2 Tessalonicenses", cat: "pauline" },
  { abbr: "1Tm", name: "1 Timóteo", cat: "pauline" },
  { abbr: "2Tm", name: "2 Timóteo", cat: "pauline" },
  // Row 6: Pauline (2) + General Epistles (8) + Revelation (1)
  { abbr: "Tt", name: "Tito", cat: "pauline" },
  { abbr: "Fm", name: "Filemom", cat: "pauline" },
  { abbr: "Hb", name: "Hebreus", cat: "generalEpistles" },
  { abbr: "Tg", name: "Tiago", cat: "generalEpistles" },
  { abbr: "1Pe", name: "1 Pedro", cat: "generalEpistles" },
  { abbr: "2Pe", name: "2 Pedro", cat: "generalEpistles" },
  { abbr: "1Jo", name: "1 João", cat: "generalEpistles" },
  { abbr: "2Jo", name: "2 João", cat: "generalEpistles" },
  { abbr: "3Jo", name: "3 João", cat: "generalEpistles" },
  { abbr: "Jd", name: "Judas", cat: "generalEpistles" },
  { abbr: "Ap", name: "Apocalipse", cat: "revelation" },
];

const ENGLISH_BOOK_NAMES = [
  "Genesis",
  "Exodus",
  "Leviticus",
  "Numbers",
  "Deuteronomy",
  "Joshua",
  "Judges",
  "Ruth",
  "1 Samuel",
  "2 Samuel",
  "1 Kings",
  "2 Kings",
  "1 Chronicles",
  "2 Chronicles",
  "Ezra",
  "Nehemiah",
  "Esther",
  "Job",
  "Psalms",
  "Proverbs",
  "Ecclesiastes",
  "Song of Solomon",
  "Isaiah",
  "Jeremiah",
  "Lamentations",
  "Ezekiel",
  "Daniel",
  "Hosea",
  "Joel",
  "Amos",
  "Obadiah",
  "Jonah",
  "Micah",
  "Nahum",
  "Habakkuk",
  "Zephaniah",
  "Haggai",
  "Zechariah",
  "Malachi",
  "Matthew",
  "Mark",
  "Luke",
  "John",
  "Acts",
  "Romans",
  "1 Corinthians",
  "2 Corinthians",
  "Galatians",
  "Ephesians",
  "Philippians",
  "Colossians",
  "1 Thessalonians",
  "2 Thessalonians",
  "1 Timothy",
  "2 Timothy",
  "Titus",
  "Philemon",
  "Hebrews",
  "James",
  "1 Peter",
  "2 Peter",
  "1 John",
  "2 John",
  "3 John",
  "Jude",
  "Revelation",
] as const;

const SPANISH_BOOK_NAMES = [
  "Génesis",
  "Éxodo",
  "Levítico",
  "Números",
  "Deuteronomio",
  "Josué",
  "Jueces",
  "Rut",
  "1 Samuel",
  "2 Samuel",
  "1 Reyes",
  "2 Reyes",
  "1 Crónicas",
  "2 Crónicas",
  "Esdras",
  "Nehemías",
  "Ester",
  "Job",
  "Salmos",
  "Proverbios",
  "Eclesiastés",
  "Cantares",
  "Isaías",
  "Jeremías",
  "Lamentaciones",
  "Ezequiel",
  "Daniel",
  "Oseas",
  "Joel",
  "Amós",
  "Abdías",
  "Jonás",
  "Miqueas",
  "Nahúm",
  "Habacuc",
  "Sofonías",
  "Hageo",
  "Zacarías",
  "Malaquías",
  "Mateo",
  "Marcos",
  "Lucas",
  "Juan",
  "Hechos",
  "Romanos",
  "1 Corintios",
  "2 Corintios",
  "Gálatas",
  "Efesios",
  "Filipenses",
  "Colosenses",
  "1 Tesalonicenses",
  "2 Tesalonicenses",
  "1 Timoteo",
  "2 Timoteo",
  "Tito",
  "Filemón",
  "Hebreos",
  "Santiago",
  "1 Pedro",
  "2 Pedro",
  "1 Juan",
  "2 Juan",
  "3 Juan",
  "Judas",
  "Apocalipsis",
] as const;

if (
  ENGLISH_BOOK_NAMES.length !== PERIODIC_BOOKS.length ||
  SPANISH_BOOK_NAMES.length !== PERIODIC_BOOKS.length
) {
  throw new Error("Bible book catalogs are out of sync");
}

function compactWhitespace(value: string): string {
  return value.replace(/\s+/g, "");
}

export function normalizeBookText(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

export function getBibleLanguage(language?: string): BibleLanguage {
  const normalized = language?.toLowerCase() ?? "pt";
  if (normalized.startsWith("en")) return "en";
  if (normalized.startsWith("es")) return "es";
  return "pt";
}

export function getLocalizedBookNameByIndex(index: number, language?: string): string {
  const fallback = PERIODIC_BOOKS[index]?.name ?? "";
  if (!fallback) return "";

  switch (getBibleLanguage(language)) {
    case "en":
      return ENGLISH_BOOK_NAMES[index] ?? fallback;
    case "es":
      return SPANISH_BOOK_NAMES[index] ?? fallback;
    default:
      return fallback;
  }
}

export function getLocalizedBookAbbrByIndex(index: number): string {
  return PERIODIC_BOOKS[index]?.abbr ?? "";
}

// Extended aliases for books whose names vary across common PT bible translations.
// Keys must already be in normalizeBookText() form (diacritics stripped, lowercase).
const EXTENDED_PT_ALIASES: [string, number][] = [
  // Song of Solomon (index 21) — "Cântico dos Cânticos" in ARC, ARA, NVI, etc.
  ["cantico dos canticos", 21],
  ["canticos", 21],
  ["cantares de salomao", 21],
  // Acts (index 43) — "Atos dos Apóstolos" in ARC, ARA; "Actos" in European PT
  ["atos dos apostolos", 43],
  ["actos dos apostolos", 43],
  ["actos", 43],
  // Lamentations (index 24) — some bibles use "Lamentações de Jeremias"
  ["lamentacoes de jeremias", 24],
];

const BOOK_INDEX_BY_ALIAS = (() => {
  const map = new Map<string, number>();

  // First-writer-wins: earlier books (lower index) keep their normalized key.
  // This prevents collision between "Jó" (Job=17) and "Jo" (João=42) — both strip
  // diacritics to "jo", so without first-writer-wins João would overwrite Job.
  const trySet = (key: string, index: number) => {
    if (key && !map.has(key)) map.set(key, index);
  };

  PERIODIC_BOOKS.forEach((book, index) => {
    const aliases = [book.abbr, book.name, ENGLISH_BOOK_NAMES[index], SPANISH_BOOK_NAMES[index]];

    for (const alias of aliases) {
      if (!alias) continue;
      const normalized = normalizeBookText(alias);
      if (!normalized) continue;
      trySet(normalized, index);
      trySet(compactWhitespace(normalized), index);
    }
  });

  // Extended aliases (force-set, these are unambiguous full-name variants)
  for (const [alias, index] of EXTENDED_PT_ALIASES) {
    const normalized = normalizeBookText(alias);
    map.set(normalized, index);
    map.set(compactWhitespace(normalized), index);
  }

  return map;
})();

export function resolveBookIndex(bookName: string): number | null {
  const normalized = normalizeBookText(bookName);
  if (!normalized) return null;

  const direct = BOOK_INDEX_BY_ALIAS.get(normalized);
  if (direct !== undefined) return direct;

  const compact = BOOK_INDEX_BY_ALIAS.get(compactWhitespace(normalized));
  return compact ?? null;
}

export function getLocalizedBookName(bookName: string, language?: string): string {
  const index = resolveBookIndex(bookName);
  if (index === null) return bookName;
  return getLocalizedBookNameByIndex(index, language);
}

function getBookSearchTokens(index: number, language?: string, sourceName?: string): string[] {
  const book = PERIODIC_BOOKS[index];
  if (!book) return [];

  return [
    book.abbr,
    getLocalizedBookNameByIndex(index, language),
    book.name,
    ENGLISH_BOOK_NAMES[index],
    SPANISH_BOOK_NAMES[index],
    sourceName ?? "",
  ];
}

export function matchesBookQuery(index: number, query: string, language?: string, sourceName?: string): boolean {
  const normalizedQuery = normalizeBookText(query);
  if (!normalizedQuery) return false;
  const compactQuery = compactWhitespace(normalizedQuery);

  return getBookSearchTokens(index, language, sourceName).some((token) => {
    const normalizedToken = normalizeBookText(token);
    if (!normalizedToken) return false;

    const compactToken = compactWhitespace(normalizedToken);
    return normalizedToken.startsWith(normalizedQuery) || compactToken.startsWith(compactQuery);
  });
}

export function findBookIndexByQuery(query: string, language?: string): number | null {
  const normalized = normalizeBookText(query);
  if (!normalized) return null;

  const direct = BOOK_INDEX_BY_ALIAS.get(normalized) ?? BOOK_INDEX_BY_ALIAS.get(compactWhitespace(normalized));
  if (direct !== undefined) return direct;

  for (let index = 0; index < PERIODIC_BOOKS.length; index++) {
    if (matchesBookQuery(index, normalized, language)) {
      return index;
    }
  }

  return null;
}
