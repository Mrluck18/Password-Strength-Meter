export type Strength = {
  entropyBits: number;
  score: number;     
  label: string;
  color: string;
};

function baseEntropyBits(pwd: string): number {
  const L = pwd.length;
  if (L === 0) return 0;

  let bits = 0;
  bits += 4;                         
  bits += Math.min(Math.max(L - 1, 0), 7) * 2;        
  bits += Math.min(Math.max(L - 8, 0), 12) * 1.5;     
  bits += Math.max(L - 20, 0) * 1;                  
  return bits;
}

function hasUpperAndSymbol(pwd: string): boolean {
  const hasUpper = /[A-Z]/.test(pwd);
  const hasSymbol = /[^A-Za-z0-9]/.test(pwd);
  return hasUpper && hasSymbol;
}

function hasCommonPatterns(pwd: string): boolean {
  
  if (/(.)\1\1/.test(pwd)) return true;               
  if (/0123|1234|2345|3456|4567|5678|6789/.test(pwd)) return true;
  if (/abcd|bcde|cdef|defg|efgh|fghi|ghij/i.test(pwd)) return true;
  return false;
}

function entropyToScore(entropyBits: number): number {
  
  const MAX = 60;
  return Math.max(0, Math.min(100, Math.round((entropyBits / MAX) * 100)));
}

export function evaluatePasswordLocal(pwd: string): Strength {
  if (!pwd) {
    return { entropyBits: 0, score: 0, label: "Inizia a digitare…", color: "#2d7dff" };
  }

  let bits = baseEntropyBits(pwd);

  if (hasUpperAndSymbol(pwd)) bits += 6;             
  if (!hasCommonPatterns(pwd)) bits += 6;             
  // bonus 4.6 (compromessa o no) lo aggiungiamo nello step successivo 

  const score = entropyToScore(bits);

  const label =
    score < 33 ? "Debole" :
    score < 66 ? "Media" :
    "Forte";

  const color =
    score < 33 ? "#ff3b3b" :
    score < 66 ? "#ffd000" :
    "#00d084";

  return { entropyBits: bits, score, label, color };
}

