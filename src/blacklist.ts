// blacklist.ts
// NIST SP 800-63-4 §3.1.1 — SHALL: verificare contro password comunemente usate.

import { sha1 } from "./cryptoUtils";

// Set inizializzato una sola volta al primo check (lazy-init).
// null = non ancora caricato; Set vuoto non è lo stesso stato.
let blacklistSet: Set<string> | null = null;
let loadingPromise: Promise<void> | null = null;

async function loadBlacklist(): Promise<void> {
  // Lazy-init: se il Set è già pronto, non fare nulla
  if (blacklistSet !== null) return;

  // Evita fetch() parallele concorrenti: riusa la promise in corso
  if (loadingPromise) {
    await loadingPromise;
    return;
  }

  loadingPromise = (async () => {
    try {
      const response = await fetch("/top100k_hashes.txt");
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();

      // Ogni riga è un hash SHA-1 uppercase (40 caratteri)
      blacklistSet = new Set(
        text
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line.length === 40) // filtra righe vuote o malformate
      );
    } catch (err) {
      console.warn("[blacklist] Impossibile caricare top100k_hashes.txt:", err);
      // Fallback sicuro: Set vuoto → nessuna password bloccata dalla blacklist locale.
      // Il check HIBP online compenserà.
      blacklistSet = new Set();
    } finally {
      loadingPromise = null;
    }
  })();

  await loadingPromise;
}

// Verifica se la password è nella blacklist locale.
export async function isInBlacklist(pwd: string): Promise<boolean> {
  await loadBlacklist();
  const hash = await sha1(pwd.toLowerCase());
  return blacklistSet!.has(hash);
}
