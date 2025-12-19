export type Strength = {
  entropyBits: number;
  score: number;
  label: string;
  color: string;
};

// Funzione helper per calcolare SHA-1
async function sha1(str: string): Promise<string> {
  const enc = new TextEncoder();
  const hash = await crypto.subtle.digest("SHA-1", enc.encode(str));
  return Array.from(new Uint8Array(hash))
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

// Funzione che controlla su HIBP usando k-anonymity
async function checkPwned(password: string): Promise<boolean> {
  if (!password) return false;
  
  // 1. Calcola Hash SHA-1
  const hash = await sha1(password);
  
  // 2. Prendi i primi 5 caratteri (prefix) e il resto (suffix)
  const prefix = hash.substring(0, 5);
  const suffix = hash.substring(5);

  try {
    // 3. Chiama API solo con il prefisso NON inviando la password intera!
    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`);
    if (!response.ok) throw new Error("Network error");
    
    const text = await response.text();
    
    // 4. Cerca se il suffisso è nella lista restituita
    // La risposta è tipo: "0018A45C4D1:2", "00D4F66209:1", ecc.
    const regex = new RegExp(`^${suffix}:`, "m");
    return regex.test(text); // True se trovata (compromessa)
  } catch (err) {
    console.warn("Impossibile verificare HIBP, ignoro check online.", err);
    return false; // Fallback sicuro: assumiamo non compromessa se offline
  }
}


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


export async function evaluatePasswordAsync(pwd: string): Promise<Strength> {
  if (!pwd) {
    return { entropyBits: 0, score: 0, label: "Inizia a digitare…", color: "#2d7dff" };
  }

  
  let bits = baseEntropyBits(pwd);
  if (hasUpperAndSymbol(pwd)) bits += 6;
  if (!hasCommonPatterns(pwd)) bits += 6;

  // 2. Controllo Online 
  const isPwned = await checkPwned(pwd);
  
  if (!isPwned) {
    bits += 6; 
  } else {
   
  }

  const score = entropyToScore(bits);


  let label = score < 34 ? "Debole" : score < 67 ? "Media" : "Forte";
  let color = score < 34 ? "#ff3b3b" : score < 67 ? "#ffd000" : "#00d084";

  if (isPwned) {
    label = "Questa password è apparsa in database pubblici di violazioni di dati. Sostituiscila con una frase lunga o una sequenza casuale di parole";
    color = "#ff0000"; // Rosso forte
   
  }

  return { entropyBits: bits, score, label, color };
}

