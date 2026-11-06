// Worker «esplorazione»: punto d'ingresso del server.
// Instrada le richieste: API pubblica, WebSocket delle partite (verso il Durable Object «Partita»)
// e l'area /admin protetta da Cloudflare Access.

export { Partita } from "./partita.js";
import { MIN_GIOCATORI, MAX_GIOCATORI, controllaNome } from "./partita.js";
import { nuovaPartita } from "./crea.js";
import { hash } from "./util.js";
export { prefissoCodice } from "./crea.js";
import { elencoPubblico, leggi } from "./esplorazioni.js";
import { gestisciAdmin } from "./admin.js";

export const VERSIONE = "3.10";

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

      // DIAGNOSI TEMPORANEA del limitatore (da rimuovere subito dopo la verifica)
      if (url.pathname === "/api/diagnosi-limite") {
        const ip = request.headers.get("CF-Connecting-IP");
        const chiave = ip ? (await hash(ip)).slice(0, 8) : null;
        let esito = null;
        if (env.INGRESSI) esito = await env.INGRESSI.limit({ key: "diagnosi-chiave-fissa" });
        return json({ limitatore: !!env.INGRESSI, tipo: typeof env.INGRESSI?.limit, chiave, esito, colo: request.cf?.colo ?? null });
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
        if (await troppiTentativi(env, request, "CREAZIONI")) return troppi(cors);
        return creaPartita(request, env, cors);
      }

      // Controllo del codice prima di collegarsi: { codice, esplorazione: { id, nome } } oppure 404.
      const info = url.pathname.match(/^\/api\/partite\/([^/]+)$/);
      if (info && request.method === "GET") {
        const codice = decodeURIComponent(info[1]).toUpperCase();
        if (await troppiTentativi(env, request, "INGRESSI")) return troppi(cors);
        const trovata = CODICE.test(codice) ? await env.PARTITA.get(env.PARTITA.idFromName(codice)).info() : null;
        if (!trovata) return json({ errore: "Non c’è nessuna partita con questo codice. Controlla il codice o chiedi a chi l’ha creata." }, 404, cors);
        return json(trovata, 200, { ...(cors ?? {}), "Cache-Control": "no-store" });
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
        if (await troppiTentativi(env, request, "INGRESSI")) return troppi(cors);
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

  const partita = await nuovaPartita(env, esplorazione, nomi);
  if (!partita) return json({ errore: "Non è stato possibile trovare un codice libero. Riprova." }, 503, cors);
  return json(partita, 201, cors);
}

// Limite ai tentativi per indirizzo (passo 3.10): contro chi prova i codici a caso o crea partite in serie.
// La chiave è l'impronta dell'indirizzo IP; il contatore vive solo nel limitatore di Cloudflare per un minuto.
// Senza l'intestazione CF-Connecting-IP (prove locali) il limite non si applica.
async function troppiTentativi(env, request, limitatore) {
  const ip = request.headers.get("CF-Connecting-IP");
  if (!ip || !env[limitatore]) return false;
  const { success } = await env[limitatore].limit({ key: await hash(ip) });
  return !success;
}

function troppi(cors) {
  return json({ errore: "Troppi tentativi in poco tempo. Aspetta un minuto e riprova." }, 429, { ...(cors ?? {}), "Retry-After": "60" });
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
