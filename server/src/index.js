// Worker «esplorazione»: punto d'ingresso del server.
// Instrada le richieste: API pubblica, WebSocket delle partite (verso il Durable Object «Partita»)
// e l'area /admin protetta da Cloudflare Access.

export { Partita } from "./partita.js";
import { MIN_GIOCATORI, MAX_GIOCATORI, controllaNome, casuale } from "./partita.js";
import { elencoPubblico, leggi } from "./esplorazioni.js";
import { gestisciAdmin } from "./admin.js";

export const VERSIONE = "3.5";

// Codice corto della partita, es. LWR-482: tre lettere dal pianeta e tre cifre.
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

      // Area admin, protetta da Cloudflare Access (e verificata anche qui).
      if (url.pathname === "/admin" || url.pathname.startsWith("/admin/")) {
        return gestisciAdmin(request, env, url);
      }

      // Elenco pubblico dei pianeti, senza le stanze.
      if (url.pathname === "/api/esplorazioni" && request.method === "GET") {
        const elenco = await elencoPubblico(env.DB);
        return json(elenco, 200, { ...(cors ?? {}), "Cache-Control": "public, max-age=60" });
      }

      // Creazione di una partita: { esplorazione, nomi } → { codice, codiceMaster, link }
      if (url.pathname === "/api/partite" && request.method === "POST") {
        if (origine && !cors) return json({ errore: "Origine non consentita." }, 403);
        return creaPartita(request, env, cors);
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

async function creaPartita(request, env, cors) {
  const testo = await request.text();
  if (testo.length > 4096) return json({ errore: "Richiesta troppo grande." }, 413, cors);
  let dati;
  try { dati = JSON.parse(testo); } catch { return json({ errore: "Richiesta non leggibile." }, 400, cors); }

  const nomiGrezzi = Array.isArray(dati?.nomi) ? dati.nomi : [];
  if (nomiGrezzi.length < MIN_GIOCATORI || nomiGrezzi.length > MAX_GIOCATORI) {
    return json({ errore: `Servono da ${MIN_GIOCATORI} a ${MAX_GIOCATORI} esplorator*.` }, 400, cors);
  }
  const nomi = [];
  for (const n of nomiGrezzi) {
    const c = controllaNome(n, nomi);
    if (c.errore) return json({ errore: c.errore }, 400, cors);
    nomi.push(c.nome);
  }

  const id = typeof dati.esplorazione === "string" ? dati.esplorazione : "";
  const esplorazione = /^[a-z0-9-]{1,40}$/.test(id) ? await leggi(env.DB, id) : null;
  if (!esplorazione) return json({ errore: "Questa esplorazione non esiste." }, 404, cors);

  const codiceMaster = casuale();
  const prefisso = prefissoCodice(esplorazione.id);
  for (let tentativo = 0; tentativo < 20; tentativo++) {
    const cifre = 100 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900);
    const codice = `${prefisso}-${cifre}`;
    const stub = env.PARTITA.get(env.PARTITA.idFromName(codice));
    const esito = await stub.crea({ codice, esplorazione, nomi, codiceMaster });
    if (esito.ok) {
      return json({ codice, codiceMaster, link: `${env.INDIRIZZO_APP}?partita=${codice}` }, 201, cors);
    }
  }
  return json({ errore: "Non è stato possibile trovare un codice libero. Riprova." }, 503, cors);
}

// Tre lettere dal nome tecnico del pianeta: la prima, poi le consonanti (lowrenzia → LWR).
export function prefissoCodice(id) {
  const lettere = id.toUpperCase().replace(/[^A-Z]/g, "");
  const scelte = (lettere[0] ?? "") + lettere.slice(1).replace(/[AEIOU]/g, "");
  return (scelte + lettere.slice(1) + "XXX").slice(0, 3);
}

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
