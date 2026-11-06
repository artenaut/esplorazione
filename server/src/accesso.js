// Verifica del token di Cloudflare Access sulle richieste dell'area /admin.
// Access sta davanti a /admin e ammette solo chi amministra; il Worker controlla comunque
// la firma del token, così una richiesta che aggira Access viene rifiutata.
// Non si salva nulla: l'email letta dal token serve solo a mostrare con chi si è entrati.

const cacheChiavi = { team: null, chiavi: null, scadenza: 0 };

async function chiaviAccess(team, forza = false) {
  const ora = Date.now();
  if (!forza && cacheChiavi.team === team && cacheChiavi.chiavi && ora < cacheChiavi.scadenza) return cacheChiavi.chiavi;
  const res = await fetch(`https://${team}/cdn-cgi/access/certs`);
  if (!res.ok) throw new Error(`Chiavi Access non disponibili (${res.status})`);
  const { keys } = await res.json();
  Object.assign(cacheChiavi, { team, chiavi: keys ?? [], scadenza: ora + 60 * 60 * 1000 });
  return cacheChiavi.chiavi;
}

const daBase64Url = (s) => {
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
};
const jsonDaBase64Url = (s) => JSON.parse(new TextDecoder().decode(daBase64Url(s)));

// Restituisce { email } se il token è valido, altrimenti null.
export async function verificaAccess(request, env) {
  const team = env.ACCESS_TEAM, aud = env.ACCESS_AUD;
  if (!team || !aud) return null;
  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token) return null;
  const parti = token.split(".");
  if (parti.length !== 3) return null;
  let intestazione, contenuto;
  try {
    intestazione = jsonDaBase64Url(parti[0]);
    contenuto = jsonDaBase64Url(parti[1]);
  } catch {
    return null;
  }
  if (intestazione.alg !== "RS256" || !intestazione.kid) return null;

  let jwk = (await chiaviAccess(team)).find((k) => k.kid === intestazione.kid);
  if (!jwk) jwk = (await chiaviAccess(team, true)).find((k) => k.kid === intestazione.kid); // chiavi ruotate
  if (!jwk) return null;

  const chiave = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const firmaOk = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5", chiave, daBase64Url(parti[2]), new TextEncoder().encode(`${parti[0]}.${parti[1]}`),
  );
  if (!firmaOk) return null;

  const adesso = Math.floor(Date.now() / 1000);
  const destinatari = Array.isArray(contenuto.aud) ? contenuto.aud : [contenuto.aud];
  if (contenuto.iss !== `https://${team}`) return null;
  if (!destinatari.includes(aud)) return null;
  if (!(contenuto.exp > adesso)) return null;
  if (contenuto.nbf && contenuto.nbf > adesso + 60) return null;
  return { email: typeof contenuto.email === "string" ? contenuto.email : "" };
}
