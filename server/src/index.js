// Worker «esplorazione»: punto d'ingresso del server.
// Instrada le richieste: API pubblica, WebSocket delle partite (verso il Durable Object «Partita»)
// e, dal passo 3.2, l'area /admin protetta da Cloudflare Access.

export { Partita } from "./partita.js";

export const VERSIONE = "3.1";

// Codice corto della partita, es. LWR-482 (il formato definitivo arriva con il passo 3.3).
const CODICE = /^[A-Z]{3}-\d{3}$/;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origine = request.headers.get("Origin");
    const cors = intestazioniCors(origine, env);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: cors ? 204 : 403, headers: cors ?? {} });
    }

    try {
      // Pagina di prova: conferma che il server è online.
      if (url.pathname === "/" && request.method === "GET") {
        return new Response(
          `Registro dell'esplorazione · server online (versione ${VERSIONE})\n`,
          { headers: { "Content-Type": "text/plain; charset=utf-8" } },
        );
      }

      if (url.pathname === "/api/stato" && request.method === "GET") {
        return json({ ok: true, versione: VERSIONE }, 200, cors);
      }

      // WebSocket di una partita: /api/partite/:codice/ws
      const ws = url.pathname.match(/^\/api\/partite\/([^/]+)\/ws$/);
      if (ws) {
        if (request.headers.get("Upgrade") !== "websocket") {
          return json({ errore: "Serve una connessione WebSocket." }, 426, cors);
        }
        if (origine && !cors) {
          return json({ errore: "Origine non consentita." }, 403);
        }
        const codice = decodeURIComponent(ws[1]).toUpperCase();
        if (!CODICE.test(codice)) {
          return json({ errore: "Codice della partita non valido." }, 400, cors);
        }
        const stub = env.PARTITA.get(env.PARTITA.idFromName(codice));
        return stub.fetch(request);
      }

      return json({ errore: "Indirizzo non trovato." }, 404, cors);
    } catch (e) {
      console.error("Errore non gestito:", e?.stack ?? e);
      return json({ errore: "Errore del server. Riprova tra poco." }, 500, cors);
    }
  },
};

// Le origini consentite sono quelle dell'app (GitHub Pages) più, in sviluppo, localhost.
function intestazioniCors(origine, env) {
  if (!origine) return null;
  const consentite = (env.ORIGINI_CONSENTITE ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const locale = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origine);
  if (!consentite.includes(origine) && !locale) return null;
  return {
    "Access-Control-Allow-Origin": origine,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(dati, status = 200, extra = null) {
  return new Response(JSON.stringify(dati), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...(extra ?? {}) },
  });
}
