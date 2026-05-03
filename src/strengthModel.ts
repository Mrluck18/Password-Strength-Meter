import { sha1 } from "./cryptoUtils";
import { isInBlacklist } from "./blacklist";

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
