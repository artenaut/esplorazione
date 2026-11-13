// Worker «esplorazione»: punto d'ingresso del server.
// Instrada le richieste: API pubblica, WebSocket delle partite (verso il Durable Object «Partita»)
// e l'area /admin protetta da Cloudflare Access.

export { Partita } from "./partita.js";
export { Limitatore } from "./limitatore.js";
import { MIN_GIOCATORI, MAX_GIOCATORI } from "./partita.js";
import { classifica } from "./classifica.js";
import { nuovaPartita } from "./crea.js";
import { improntaRete, SolaLettura } from "./util.js";
import { VERSIONE, LIMITI, FINESTRA_LIMITI } from "./costanti.js";
import { elencoPubblico, leggi, permettiScrittura } from "./esplorazioni.js";
import { gestisciAdmin } from "./admin.js";


// Codice corto della partita, es. LWR-482: tre lettere dal pianeta e tre cifre.
const CODICE = /^[A-Z]{3}-\d{3}$/;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origine = request.headers.get("Origin");
    const cors = intestazioniCors(origine, env);

    // richieste CORS preliminari solo per l'API pubblica (mai per /admin)
    if (request.method === "OPTIONS") {
      if (!url.pathname.startsWith("/api/")) return new Response(null, { status: 404 });
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
        return await gestisciAdmin(request, env, url);
      }

      // Elenco pubblico dei pianeti, senza le stanze.
      if (url.pathname === "/api/esplorazioni" && request.method === "GET") {
        const elenco = await elencoPubblico(env.DB);
        return json(elenco, 200, { ...(cors ?? {}), "Cache-Control": "public, max-age=60" });
      }

      // Classifica pubblica (sola lettura): ?stagione=ID, di default la stagione in corso.
      if (url.pathname === "/api/classifica" && request.method === "GET") {
        const q = url.searchParams.get("stagione");
        const id = q && /^\d{1,9}$/.test(q) ? Number(q) : null;
        const c = await classifica(env.DB, id);
        if (!c) return json({ errore: "Stagione non trovata." }, 404, cors);
        return json(c, 200, { ...(cors ?? {}), "Cache-Control": "public, max-age=60" });
      }

      // Creazione di una partita: { esplorazione, posti } → { codice, codiceMaster, link }
      if (url.pathname === "/api/partite" && request.method === "POST") {
        if (origine && !cors) return json({ errore: "Origine non consentita." }, 403);
        if (await troppiTentativi(env, request, "CREAZIONI")) return troppi(cors);
        return await creaPartita(request, env, cors);
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
        // alla partita arriva solo l'impronta della rete (per il limite sui nuovi nickname), mai l'indirizzo;
        // un'intestazione con lo stesso nome mandata dal dispositivo viene scartata
        const intestazioni = new Headers(request.headers);
        intestazioni.delete("X-Impronta-Rete");
        const rete = await improntaRete(request);
        if (rete) intestazioni.set("X-Impronta-Rete", rete);
        return stub.fetch(new Request(request, { headers: intestazioni }));
      }

      return json({ errore: "Indirizzo non trovato." }, 404, cors);
    } catch (e) {
      if (e instanceof SolaLettura) return json({ errore: e.message }, 503, cors);
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

  const n = dati?.posti;
  if (!Number.isInteger(n) || n < MIN_GIOCATORI || n > MAX_GIOCATORI) {
    return json({ errore: `Servono da ${MIN_GIOCATORI} a ${MAX_GIOCATORI} esplorator*.` }, 400, cors);
  }

  const id = typeof dati.esplorazione === "string" ? dati.esplorazione : "";
  const esplorazione = /^[a-z0-9-]{1,40}$/.test(id) ? await leggi(env.DB, id) : null;
  if (!esplorazione) return json({ errore: "Questa esplorazione non esiste." }, 404, cors);

  await permettiScrittura(env.DB); // sola lettura (V.8a): niente nuove partite
  const partita = await nuovaPartita(env, esplorazione, Array(n).fill(null));
  if (!partita) return json({ errore: "Non è stato possibile trovare un codice libero. Riprova." }, 503, cors);
  return json(partita, 201, cors);
}

// Limite ai tentativi per indirizzo (passo 3.10): contro chi prova i codici a caso o crea partite in serie.
// La chiave è l'impronta dell'indirizzo IP; il conteggio vive solo nella memoria del Limitatore per un minuto.
// Senza l'intestazione CF-Connecting-IP (prove locali) il limite non si applica.
async function troppiTentativi(env, request, tipo) {
  const rete = await improntaRete(request);
  if (!rete || !env.LIMITATORE) return false;
  const chiave = `${tipo}:${rete}`;
  const ammesso = await env.LIMITATORE.get(env.LIMITATORE.idFromName(chiave)).conta(LIMITI[tipo], FINESTRA_LIMITI);
  return !ammesso;
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
