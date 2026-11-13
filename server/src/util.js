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

// Impronta della «rete» di chi fa la richiesta: l'indirizzo IPv4, oppure il blocco /64 per IPv6
// (con IPv6 una sola persona ha a disposizione milioni di indirizzi nello stesso blocco).
export async function improntaRete(request) {
  const ip = request.headers.get("CF-Connecting-IP");
  if (!ip) return null;
  return hash(ip.includes(":") ? `${prefissoIPv6(ip)}::/64` : ip);
}

export function prefissoIPv6(ip) {
  const [testa, coda = ""] = ip.toLowerCase().split("%")[0].split("::");
  const a = testa ? testa.split(":") : [], b = ip.includes("::") && coda ? coda.split(":") : [];
  const gruppi = ip.includes("::") ? [...a, ...Array(8 - a.length - b.length).fill("0"), ...b] : a;
  return gruppi.slice(0, 4).map((g) => (parseInt(g, 16) || 0).toString(16)).join(":");
}

// Errore di scrittura rifiutata perché il codice è più vecchio dello schema dei dati (V.8a).
export class SolaLettura extends Error {}
