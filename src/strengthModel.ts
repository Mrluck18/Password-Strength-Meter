import { sha1 } from "./cryptoUtils";
import { isInBlacklist, getBlacklistSet } from "./blacklist";

export enum PatternType {
  KEYBOARD_WALK = "KEYBOARD_WALK",
  DATE = "DATE",
  YEAR = "YEAR",
  LEET = "LEET",
  REPEATED = "REPEATED",
  SEQUENCE_ALPHA = "SEQUENCE_ALPHA",
  SEQUENCE_NUM = "SEQUENCE_NUM",
  DICTIONARY = "DICTIONARY",
  STRUCTURAL = "STRUCTURAL",
}

export interface PatternMatch {
  type: PatternType; // categoria del pattern
  segment: string;      // sottostringa esatta rilevata nella password
  start: number;      // indice iniziale (incluso)
  end: number;      // indice finale (escluso)
  penalty: number;      // penalità in punti (valore positivo, verrà sottratto)
}

export type Strength = {
  baseScore: number;
  score: number;
  label: string;
  color: string;
  suggestions: string[];
  patterns: PatternMatch[];
};

const KEYBOARD_SEQUENCES: string[] = [
  // Orizzontali — riga superiore
  "qwertyuiop",
  // Orizzontali — riga centrale
  "asdfghjkl",
  // Orizzontali — riga inferiore
  "zxcvbnm",
  // Orizzontali — riga numerica
  "1234567890",
  // Verticali (colonne QWERTY)
  "qaz", "wsx", "edc", "rfv", "tgb", "yhn", "ujm",
  // Diagonali
  "qsc", "wde", "erf", "rtg", "yuj", "uik",
];

const MIN_WALK_LENGTH = 3;

// Restituisce un PatternMatch per ogni corrispondenza trovata.
export function detectKeyboardWalks(pwd: string): PatternMatch[] {
  const lower = pwd.toLowerCase();
  const matches: PatternMatch[] = [];

  for (const seq of KEYBOARD_SEQUENCES) {
    const variants = [seq, seq.split("").reverse().join("")];

    for (const variant of variants) {
      for (let len = variant.length; len >= MIN_WALK_LENGTH; len--) {
        for (let i = 0; i <= variant.length - len; i++) {
          const sub = variant.slice(i, i + len);
          let pos = lower.indexOf(sub);

          while (pos !== -1) {
            const alreadyCovered = matches.some(
              (m) => m.start <= pos && m.end >= pos + len
            );

            if (!alreadyCovered) {
              matches.push({
                type:    PatternType.KEYBOARD_WALK,
                segment: pwd.slice(pos, pos + len),
                start:   pos,
                end:     pos + len,
                penalty: len >= 6 ? 25 : len >= 4 ? 18 : 12,
              });
            }

            pos = lower.indexOf(sub, pos + 1);
          }
        }
      }
    }
  }

  return matches;
}

const DATE_PATTERNS: { regex: RegExp; label: PatternType; penalty: number }[] = [
  // Date complete 8 cifre — penalità massima
  { regex: /(?<!\d)(0[1-9]|[12]\d|3[01])(0[1-9]|1[0-2])(19|20)\d{2}(?!\d)/g, label: PatternType.DATE, penalty: 22 }, // ddmmyyyy
  { regex: /(?<!\d)(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])(19|20)\d{2}(?!\d)/g, label: PatternType.DATE, penalty: 22 }, // mmddyyyy
  { regex: /(?<!\d)(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])(?!\d)/g, label: PatternType.DATE, penalty: 22 }, // yyyymmdd

  // Date corte 6 cifre
  { regex: /(?<!\d)(0[1-9]|[12]\d|3[01])(0[1-9]|1[0-2])\d{2}(?!\d)/g, label: PatternType.DATE, penalty: 18 }, // ddmmyy

  // Anni 4 cifre — range 1900–2029 (alta frequenza nei breach)
  { regex: /(?<!\d)(19\d{2}|200\d|201\d|202[0-9])(?!\d)/g, label: PatternType.YEAR, penalty: 15 },
];

// Restituisce un PatternMatch per ogni corrispondenza trovata
export function detectDatesAndYears(pwd: string): PatternMatch[] {
  const matches: PatternMatch[] = [];

  for (const { regex, label, penalty } of DATE_PATTERNS) {
    // Resetta lastIndex per ogni utilizzo (regex con flag /g sono stateful)
    regex.lastIndex = 0;

    let match: RegExpExecArray | null;
    while ((match = regex.exec(pwd)) !== null) {
      const start = match.index;
      const end   = start + match[0].length;

      // Priorità al match più specifico: salta se già coperto
      const alreadyCovered = matches.some(
        (m) => m.start <= start && m.end >= end
      );

      if (!alreadyCovered) {
        matches.push({
          type:    label,
          segment: match[0],
          start,
          end,
          penalty,
        });
      }
    }
  }

  return matches;
}


const LEET_MAP: Record<string, string> = {

  // ── Multi-carattere (processate prima per evitare sostituzioni parziali) ──
  "ph": "f",    // ph → f  (es. "ph34r" → "fear", "phd" → "fd")
  "|-|": "h",   // |-| → h  (Advanced Leet)
  "|_|": "u",   // |_| → u
  "|3":  "b",   // |3 → b
  "I3":  "b",   // I3 → b
  "13":  "b",   // 13 → b
  "|=":  "f",   // |= → f
  "|<":  "k",   // |< → k
  "/>":  "r",   // I2 / /2 → r (semplificato)
  "I2":  "r",
  "/\\":  "a",   // /\ → a
  "\\/":  "v",  // \/ → v

  "@": "a",   // A → @ (Advanced)
  "4": "a",   // A → 4 (Basic — il più comune)
  "3": "e",   // E → 3 (Basic)
  "1": "i",   // I → 1 (Basic)
  "!": "i",   // I → ! (Intermediate)
  "0": "o",   // O → 0 (Basic — zero)
  "]": "i",   // I → ] (raro ma presente in corpus)

  "8": "b",   // B → 8
  "[": "c",   // C → [
  "<": "c",   // C → <
  ")": "d",   // D → )
  "6": "g",   // G → 6
  "9": "g",   // G → 9
  "#": "h",   // H → #
  "|": "l",   // L → |
  "£": "l",   // L → £
  "5": "s",   // S → 5 (Intermediate)
  "$": "s",   // S → $ (Intermediate — molto frequente)
  "7": "t",   // T → 7
  "+": "t",   // T → +
  "2": "z",   // Z → 2 (inverso, usato in suffissi "-zorz")
};

// Caratteri che richiedono contesto alfabetico per essere sostituiti
const CONTEXT_SENSITIVE = new Set(["@", "!", "]", "|", "+"]);

// Restituisce true se il carattere in posizione index è circondato
// da lettere su entrambi i lati — cioè è "embedded" in un token alfabetico
function isEmbedded(str: string, index: number): boolean {
  const prev = index > 0 ? str[index - 1] : "";
  const next = index < str.length - 1 ? str[index + 1] : "";
  const isLetter = (c: string) => /[a-z]/i.test(c);
  return isLetter(prev) && isLetter(next);
}

// Normalizza la password sostituendo i caratteri leet con i corrispondenti
export function normalizeLeet(pwd: string): {
  normalized: string;
  offsetMap: number[];
} {
  const lower = pwd.toLowerCase();
  let normalized = "";
  const offsetMap: number[] = [];
  let i = 0;

  while (i < lower.length) {
    // Prova prima le sostituzioni multi-carattere
    let matched = false;
    for (const [leet, base] of Object.entries(LEET_MAP)) {
      if (leet.length > 1 && lower.startsWith(leet, i)) {
        // "ph" → "f": un solo carattere normalizzato, ma due originali
        // offsetMap punta all'inizio del gruppo originale
        normalized += base;
        offsetMap.push(i);
        i += leet.length;
        matched = true;
        break;
      }
    }

    if (!matched) {
      const char = lower[i];
      const replacement = LEET_MAP[char];
      if (replacement && CONTEXT_SENSITIVE.has(char)) {
          normalized += isEmbedded(lower, i) ? replacement : char;
      } else {
        normalized += replacement ?? char;
      }
      
      
      offsetMap.push(i);
      i++;
    }
  }

  return { normalized, offsetMap };
}

// Rileva pattern leet speak nella password
export async function detectLeetSpeak(pwd: string): Promise<PatternMatch[]> {
  const { normalized, offsetMap } = normalizeLeet(pwd);

  // Se la stringa normalizzata è identica all'originale lowercase,
  // non c'è nessun carattere leet → nessun match
  if (normalized === pwd.toLowerCase()) return [];

  // Rilancia i detector sulla stringa normalizzata
  const rawMatches: PatternMatch[] = [
    ...detectKeyboardWalks(normalized),
    ...detectDatesAndYears(normalized),
    ...(await detectDictionaryWords(normalized)),
  ];

  // Filtra solo i match che NON si trovano anche nella password originale
  const originalMatches = new Set(
    [...detectKeyboardWalks(pwd.toLowerCase()),
     ...detectDatesAndYears(pwd.toLowerCase()),
     ...(await detectDictionaryWords(pwd.toLowerCase())),
     ].map((m) => `${m.start}-${m.end}-${m.type}`)
  );

  const leetOnlyMatches = rawMatches.filter(
    (m) => !originalMatches.has(`${m.start}-${m.end}-${m.type}`)
  );

  // Riancoura le posizioni alla password originale tramite offsetMap
  return leetOnlyMatches.map((m) => ({
    type: PatternType.LEET,
    segment: pwd.slice(offsetMap[m.start], offsetMap[m.end - 1] + 1),
    start: offsetMap[m.start],
    end: offsetMap[m.end - 1] + 1,
    penalty: m.penalty,   // eredita la penalità del pattern sottostante
  }));
}

export function detectRepeatedChars(pwd: string): PatternMatch[] {
  const lower = pwd.toLowerCase();
  const matches: PatternMatch[] = [];
  let i = 0;

  while (i < lower.length) {
    let j = i + 1;

    // Estendi il run finché il carattere è identico
    while (j < lower.length && lower[j] === lower[i]) {
      j++;
    }

    const runLength = j - i;

    // Soglia minima: run di almeno 3 caratteri identici
    if (runLength >= 3) {
      matches.push({
        type:    PatternType.REPEATED,
        segment: pwd.slice(i, j),   // preserva il case originale
        start:   i,
        end:     j,
        penalty: runLength >= 5 ? 18 : runLength >= 4 ? 14 : 10,
      });
    }

    // Salta l'intero run — non produrre match sovrapposti
    i = j;
  }

  return matches;
}

// Lunghezza minima e massima delle sottostringhe da controllare.
// Min 4: sotto questa soglia il falso positivo esplode ("the", "and"…)
// Max 20: parole sopra questa lunghezza non compaiono nei dizionari di breach
const DICT_MIN_LEN = 4;
const DICT_MAX_LEN = 20;

// Rileva sottostringhe della password presenti nella blacklist locale
export async function detectDictionaryWords(pwd: string): Promise<PatternMatch[]> {
  const set = await getBlacklistSet();
  const lower = pwd.toLowerCase();
  const matches: PatternMatch[] = [];

  for (let start = 0; start < lower.length; start++) {
    for (
      let end = start + DICT_MIN_LEN;
      end <= Math.min(lower.length, start + DICT_MAX_LEN);
      end++
    ) {
      // Salta se già coperto da un match più lungo
      const alreadyCovered = matches.some(
        (m) => m.start <= start && m.end >= end
      );
      if (alreadyCovered) continue;

      const sub = lower.slice(start, end);
      const hash = await sha1(sub);

      if (set.has(hash)) {
        matches.push({
          type:    PatternType.DICTIONARY,
          segment: pwd.slice(start, end),   // case originale
          start,
          end,
          // Penalità proporzionale alla lunghezza della parola trovata
          penalty: end - start >= 8 ? 30 : end - start >= 6 ? 25 : 20,
        });

        // Trovato il match più lungo da questa posizione:
        // avanza start al termine del match per evitare overlap
        break;
      }
    }
  }

  return matches;
}

const STRUCTURAL_PATTERNS: {
  regex: RegExp;
  label: PatternType;
  penalty: number;
}[] = [
  // Sequenze numeriche crescenti/decrescenti (min 4 cifre)
  { regex: /(?<!\d)(0123|1234|2345|3456|4567|5678|6789|7890|0987|9876|8765|7654|6543|5432|4321|3210)(?!\d)/g,
    label: PatternType.SEQUENCE_NUM, penalty: 15 },

  // Sequenze alfabetiche crescenti/decrescenti (min 4 lettere)
  { regex: /(?<![a-z])(abcd|bcde|cdef|defg|efgh|fghi|ghij|hijk|ijkl|jklm|klmn|lmno|mnop|nopq|opqr|pqrs|qrst|rstu|stuv|tuvw|uvwx|vwxy|wxyz|zyxw|yxwv|xwvu|wvut|vuts|utsr|tsrq|srqp|rqpo|qpon|ponm|onml|nmlk|mlkj|lkji|kjih|jihg|ihgf|hgfe|gfed|fedc|edcb|dcba)(?![a-z])/g,
    label: PatternType.SEQUENCE_ALPHA, penalty: 15 },

  // Padding simbolo in coda
  { regex: /[!@#$%^&*\-_+=?]{1,4}$/g,
    label: PatternType.STRUCTURAL, penalty: 12 },
];

// Regex separata: parola seguita da anno
// Non messa nell'array sopra perché richiede un check sulla lunghezza del match
const WORD_YEAR_REGEX =
  /(?<![a-z])([a-z]{3,})((19|20)\d{2})(?![a-z\d])/gi;

/**
 * Rileva pattern strutturali ricorrenti nelle password:
 * sequenze numeriche/alfabetiche, padding simbolo, parola+anno.
 */
export function detectStructuralPattern(pwd: string): PatternMatch[] {
  const lower = pwd.toLowerCase();
  const matches: PatternMatch[] = [];

  // Pattern da array
  for (const { regex, label, penalty } of STRUCTURAL_PATTERNS) {
    regex.lastIndex = 0;

    let match: RegExpExecArray | null;
    while ((match = regex.exec(lower)) !== null) {
      const start = match.index;
      const end   = start + match[0].length;

      const alreadyCovered = matches.some(
        (m) => m.start <= start && m.end >= end
      );

      if (!alreadyCovered) {
        matches.push({
          type:    label,
          segment: pwd.slice(start, end),
          start,
          end,
          penalty,
        });
      }
    }
  }

  // Parola + anno
  WORD_YEAR_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = WORD_YEAR_REGEX.exec(lower)) !== null) {
    const start = match.index;
    const end   = start + match[0].length;

    const alreadyCovered = matches.some(
      (m) => m.start <= start && m.end >= end
    );

    if (!alreadyCovered) {
      matches.push({
        type:    PatternType.STRUCTURAL,
        segment: pwd.slice(start, end),
        start,
        end,
        penalty: 20,   // parola+anno è uno dei pattern più frequenti nei breach
      });
    }
  }

  return matches;
}

// Rimuove i PatternMatch sovrapposti dalla lista flat
function removeOverlaps(matches: PatternMatch[]): PatternMatch[] {
  // Ordina per penalità decrescente — in caso di parità, il più lungo vince
  const sorted = [...matches].sort((a, b) =>
    b.penalty !== a.penalty
      ? b.penalty - a.penalty
      : (b.end - b.start) - (a.end - a.start)
  );

  const accepted: PatternMatch[] = [];

  for (const candidate of sorted) {
    const overlaps = accepted.some(
      (m) => candidate.start < m.end && m.start < candidate.end
    );

    if (!overlaps) {
      accepted.push(candidate);
    }
  }

  // Riordina per posizione crescente — utile per la View
  return accepted.sort((a, b) => a.start - b.start);
}

export async function segmentPassword(pwd: string): Promise<PatternMatch[]> {
  if (!pwd) return [];

  // Chiama tutti i detector — async prima, sync dopo
  const [dictMatches, leetMatches] = await Promise.all([
    detectDictionaryWords(pwd),
    detectLeetSpeak(pwd),
  ]);

  const syncMatches: PatternMatch[] = [
    ...detectKeyboardWalks(pwd),
    ...detectDatesAndYears(pwd),
    ...detectStructuralPattern(pwd),
    ...detectRepeatedChars(pwd),
  ];

  // Lista flat di tutti i match
  const allMatches: PatternMatch[] = [
    ...dictMatches,
    ...leetMatches,
    ...syncMatches,
  ];

  return removeOverlaps(allMatches);
}

// Fattori di smorzamento per match multipli
const DIMINISHING_FACTORS = [1.0, 0.7, 0.5, 0.4, 0.3];

// Calcola la penalità totale da sottrarre al baseScore NIST
export function calcolaPenalitaPattern(matches: PatternMatch[]): number {
  if (matches.length === 0) return 0;

  const MAX_SINGLE_PENALTY = 30;
  const MAX_TOTAL_PENALTY  = 60;

  // Ordina per penalità decrescente — applica lo smorzamento ai match minori
  const sorted = [...matches].sort((a, b) => b.penalty - a.penalty);

  let total = 0;

  for (let i = 0; i < sorted.length; i++) {
    const raw    = Math.min(sorted[i].penalty, MAX_SINGLE_PENALTY);
    const factor = DIMINISHING_FACTORS[i] ?? 0.3;  // oltre il 5° match: 0.3 fisso
    total += raw * factor;
  }

  return Math.min(Math.round(total), MAX_TOTAL_PENALTY);
}

async function richiediRange(prefissoHash: string): Promise<string> {
  const response = await fetch(`https://api.pwnedpasswords.com/range/${prefissoHash}`);
  if (!response.ok) throw new Error("Network error");
  return await response.text(); // listaSuffissi 
}

function cercaSuffisso(listaSuffissi: string, suffisso: string): boolean {
  const regex = new RegExp(`^${suffisso}:`, "m");
  return regex.test(listaSuffissi);
}  
  
async function checkPwned(password: string): Promise<boolean> {
  if (!password) return false;
  // 1. Calcola Hash SHA-1
  const hash = await sha1(password);
  
  // 2. Prendi i primi 5 caratteri (prefix) e il resto (suffix)
  const prefix = hash.substring(0, 5);
  const suffix = hash.substring(5);

  try {
    const listaSuffissi = await richiediRange(prefix);
    return cercaSuffisso(listaSuffissi, suffix);
  } catch (err) {
    console.warn("Impossibile verificare HIBP, ignoro check online.", err);
    return false; // Fallback sicuro: assumiamo non compromessa se offline
  }
}

//Blacklist locale — primary check
async function checkBlacklistLocale(pwd: string): Promise<boolean> {
  return isInBlacklist(pwd);
}

function calcolaScoreNIST(pwd: string): number {
  const L = pwd.length;
  if (L < 8) return 0;
  let base = 0;
  if (L >= 8)  base += 20; // (20 < 34 → Debole)
  if (L >= 12) base += 17; // totale 37 → supera soglia "Media" (37 ≥ 34 ✓)
  if (L >= 15) base += 30; // totale 67 → soglia "Forte" NIST §3.1.1 SHALL (67 ≥ 67 ✓)
  if (L >= 20) base += 13; // totale 80 → max passphrase bonus
  return base;             // max 80
}


function controlloPattern(pwd: string): boolean {
  const lower = pwd.toLowerCase();

  // 1. Caratteri ripetuti (es. "aaa")
  if (/(.)\1\1/.test(lower)) return true;

  // 2. Sequenze numeriche (es. "1234", "4321")
  if (/0123|1234|2345|3456|4567|5678|6789|7890/.test(lower)) return true;
  if (/0987|9876|8765|7654|6543|5432|4321|3210/.test(lower)) return true;

  // 3. Sequenze alfabetiche (es. "abcd", "dcba")
  if (/abcd|bcde|cdef|defg|efgh|fghi|ghij|hijk|ijkl|jklm|klmn|lmno|mnop|nopq|opqr|pqrs|qrst|rstu|stuv|tuvw|uvwx|vwxy|wxyz/.test(lower)) return true;

  // 4. Tastiera QWERTY (es. "qwer", "asdf")
  if (/qwer|wert|erty|rtyu|tyui|yuio|uiop/.test(lower)) return true;
  if (/asdf|sdfg|dfgh|fghj|ghjk|hjkl/.test(lower)) return true;
  if (/zxcv|xcvb|cvbn|vbnm/.test(lower)) return true;

  // 5. Anni comuni (19xx o 20xx)
  if (/(19|20)\d{2}/.test(lower)) return true;

  return false;
}


function computeLabelAndColor(
  score: number,
  L: number,
  isPwned: boolean
): { label: string; color: string } {
  if (isPwned) {
    return {
      label:
        "Questa password è apparsa in database pubblici di violazioni di dati. " +
        "Sostituiscila con una frase lunga o una sequenza casuale di parole.",
      color: "#ff0000",
    };
  }
  // "Forte" richiede esplicitamente L≥15 [NIST §3.1.1]
  if (score >= 67 && L >= 15) return { label: "Forte",  color: "#00d084" };
  if (score >= 34 && L >= 8)  return { label: "Media",  color: "#ffd000" };
  return                             { label: "Debole", color: "#ff3b3b" };
}

function getSuggestions(pwd: string, hasPattern: boolean, isPwned: boolean): string[] {
  const suggestions: string[] = [];

  if (isPwned) {
    return []; 
  }

  if (pwd.length < 8) {
    suggestions.push("Usa almeno 8 caratteri.");
  }
  
  if (hasPattern) {
    suggestions.push("Evita sequenze comuni (es. '1234', 'abcd') o caratteri ripetuti.");
  }
  
  if (suggestions.length === 0 && pwd.length < 12) {
    suggestions.push("Allunga la password con più parole o caratteri casuali.");
  }

  return suggestions;
}

export async function calcoloRobustezza(pwd: string): Promise<Strength> {
  if (!pwd) {
    return { baseScore: 0, score: 0, label: "Inizia a digitare…", color: "#2d7dff", suggestions: [], patterns: []};
  }  
  
  const base = calcolaScoreNIST(pwd);
  const hasPattern = controlloPattern(pwd);
  
  let scoreCalc = base;  

  if (!hasPattern) scoreCalc += 6;


  // Blacklist-primary → HIBP solo come fallback online
  const isBlacklisted = await checkBlacklistLocale(pwd);

  let isPwned = false;
  if (!isBlacklisted) {
    // Chiama HIBP solo se la blacklist locale non ha trovato match:
    // evita una chiamata di rete inutile per le password più comuni.
    isPwned = await checkPwned(pwd);
  }

  const isCompromised = isBlacklisted || isPwned;

  if (!isCompromised) scoreCalc += 6;

  const score = isCompromised ? 0 : Math.min(100, Math.round(scoreCalc));
  const { label, color } = computeLabelAndColor(score, pwd.length, isCompromised);
  const suggestions = getSuggestions(pwd, hasPattern, isCompromised);

  return {baseScore: base, score, label, color, suggestions, patterns: [] };  
} 
