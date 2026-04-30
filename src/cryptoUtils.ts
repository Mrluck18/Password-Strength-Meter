// cryptoUtils.ts
// SHA-1 condivisa tra strengthModel.ts e blacklist.ts
// Estratta qui per evitare dipendenza circolare.

export async function sha1(str: string): Promise<string> {
  const enc = new TextEncoder();
  const hash = await crypto.subtle.digest("SHA-1", enc.encode(str));
  return Array.from(new Uint8Array(hash))
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}
