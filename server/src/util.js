// Funzioni di servizio comuni al Worker e alle partite.

// Stringa casuale sicura (base64url), per codici master e gettoni.
export function casuale(byte = 18) {
  const b = crypto.getRandomValues(new Uint8Array(byte));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Impronta SHA-256 in esadecimale: sul server si conservano solo le impronte di codici e gettoni.
export async function hash(testo) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(testo));
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
