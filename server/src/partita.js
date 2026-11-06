// Durable Object «Partita»: uno per sessione, con SQLite.
// Usa la WebSocket Hibernation API (obbligatoria, vedi docs/roadmap-server.md §1): tra un messaggio
// e l'altro l'oggetto può essere scaricato dalla memoria senza chiudere le connessioni.
// Per questo nulla vive solo in memoria: lo stato sta nello storage, il ruolo di ogni
// connessione nell'«attachment» del WebSocket.
//
// Passi 3.3–3.7: creazione, posti con gettone, ruoli (master, esplorator*, tabellone, ospite),
// mosse con estrazione sul server e annullamento dell'ultima mossa. Chiusura e scadenza: passi 3.8–3.9.
// Protocollo completo: docs/protocollo-partita.md.

import { DurableObject } from "cloudflare:workers";
import { compile, drawOffer, nextOfNode } from "../../motore.js";

export const MIN_GIOCATORI = 2, MAX_GIOCATORI = 4, MAX_NOME = 24, MAX_REGISTRO = 500;

// Ruoli di una connessione: «ospite» (ha il codice ma non ha ancora un posto), «esplorator» (ha un posto),
// «master» (ha il codice master), «tabellone» (sola lettura).

export class Partita extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    // Il ping dei dispositivi riceve risposta direttamente dal runtime, senza risvegliare l'oggetto.
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
    this.stato = null;     // copia in memoria, ricaricata dallo storage dopo l'ibernazione
    this.motore = null;    // pianeta compilato (cache)
  }

  // ---------- creazione (chiamata dal Worker via RPC) ----------

  // dati = { codice, esplorazione (file completo, già validato), nomi, codiceMaster }
  async crea({ codice, esplorazione, nomi, codiceMaster }) {
    if (await this.carica()) return { occupato: true };
    const m = compile(esplorazione);
    const shown = {};
    const ora = Date.now();
    const stato = {
      codice,
      creata: ora,
      ultimaAttivita: ora,
      versione: 1,
      esplorazione,
      masterHash: await hash(codiceMaster),
      shown,
      posti: nomi.map((nome) => nuovoPosto(m, nome, shown)),
      log: [],
    };
    this.stato = stato;
    await this.ctx.storage.put("stato", stato);
    return { ok: true };
  }

  // ---------- connessioni ----------

  async fetch(request) {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Serve una connessione WebSocket.", { status: 426 });
    }
    const { 0: client, 1: server } = new WebSocketPair();
    this.ctx.acceptWebSocket(server); // attiva l'ibernazione
    server.serializeAttachment({ ruolo: null, posto: null });
    if (!(await this.carica())) {
      invia(server, { tipo: "errore", codice: "partita-inesistente", messaggio: "Non c’è nessuna partita con questo codice. Controlla il codice o chiedi a chi l’ha creata." });
      server.close(4404, "Partita inesistente");
    }
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, messaggio) {
    let dati;
    try {
      if (typeof messaggio !== "string" || messaggio.length > 4096) throw new Error();
      dati = JSON.parse(messaggio);
      if (!dati || typeof dati !== "object") throw new Error();
    } catch {
      return errore(ws, "messaggio-non-valido", "Messaggio non leggibile.");
    }

    const stato = await this.carica();
    if (!stato) return errore(ws, "partita-inesistente", "La partita non esiste più.");
    const io = ws.deserializeAttachment() ?? {};

    if (dati.tipo === "entra") return this.entra(ws, stato, dati).catch((e) => {
      console.error("Errore nella partita:", e?.stack ?? e);
      errore(ws, "errore-server", "Qualcosa è andato storto sul server. Riprova.");
    });
    if (!io.ruolo) return errore(ws, "non-entrato", "Prima bisogna entrare nella partita.");

    try {
      switch (dati.tipo) {
        case "occupa": return await this.occupa(ws, stato, io, dati);
        case "libera": return await this.libera(ws, stato, io, dati);
        case "aggiungi": return await this.aggiungi(ws, stato, io, dati);
        case "togli": return await this.togli(ws, stato, io, dati);
        case "mossa": return await this.mossa(ws, stato, io, dati);
        case "annulla": return await this.annulla(ws, stato, io);
        case "stato": return invia(ws, { tipo: "stato", stato: this.vista(stato) });
        default: return errore(ws, "tipo-sconosciuto", "Tipo di messaggio sconosciuto.");
      }
    } catch (e) {
      console.error("Errore nella partita:", e?.stack ?? e);
      this.stato = null; // si ricarica dallo storage: lo stato salvato resta coerente
      return errore(ws, "errore-server", "Qualcosa è andato storto sul server. Riprova.");
    }
  }

  async webSocketClose(ws, codice) {
    try { ws.close(codice, "Chiusa"); } catch { /* già chiusa */ }
  }

  async webSocketError(ws, e) {
    console.error("Errore WebSocket:", e?.message ?? e);
  }

  // ---------- azioni ----------

  // { tipo:"entra", codiceMaster } → master · { gettone } → rientro nel proprio posto
  // { ruolo:"tabellone" } → sola lettura · nient'altro → ospite che sceglie un posto
  async entra(ws, stato, dati) {
    let ruolo = "ospite", posto = null;
    if (typeof dati.codiceMaster === "string") {
      if ((await hash(dati.codiceMaster)) !== stato.masterHash) {
        return errore(ws, "codice-master-errato", "Il codice master non è corretto.");
      }
      ruolo = "master";
    } else if (typeof dati.gettone === "string") {
      const h = await hash(dati.gettone);
      posto = stato.posti.findIndex((p) => p.gettoneHash === h);
      if (posto < 0) {
        // il posto è stato liberato dal master, oppure il gettone non è di questa partita
        return errore(ws, "gettone-non-valido", "Questo dispositivo non ha più un posto nella partita. Scegline uno libero.", { ruolo: null });
      }
      ruolo = "esplorator";
    } else if (dati.ruolo === "tabellone") {
      ruolo = "tabellone";
    }
    ws.serializeAttachment({ ruolo, posto });
    invia(ws, { tipo: "benvenuto", ruolo, posto, stato: this.vista(stato) });
  }

  // Un ospite occupa un posto libero e riceve il gettone che lo lega a quel posto.
  async occupa(ws, stato, io, { posto }) {
    if (io.ruolo !== "ospite") {
      return errore(ws, "ruolo", io.ruolo === "esplorator" ? "Hai già un posto in questa partita." : "Questo dispositivo non può occupare un posto.");
    }
    const p = stato.posti[posto];
    if (!Number.isInteger(posto) || !p) return errore(ws, "posto-inesistente", "Questo posto non esiste.");
    if (p.gettoneHash) return errore(ws, "posto-occupato", `Il posto di ${p.nome} è già occupato da un altro dispositivo.`);
    const gettone = casuale();
    p.gettoneHash = await hash(gettone);
    await this.salva(stato, { attivita: true });
    ws.serializeAttachment({ ruolo: "esplorator", posto });
    invia(ws, { tipo: "posto", posto, gettone });
    this.trasmetti(stato);
  }

  // Il master libera un posto: il dispositivo che lo occupava torna ospite.
  async libera(ws, stato, io, { posto }) {
    if (io.ruolo !== "master") return errore(ws, "ruolo", "Solo il master può liberare un posto.");
    const p = stato.posti[posto];
    if (!Number.isInteger(posto) || !p) return errore(ws, "posto-inesistente", "Questo posto non esiste.");
    if (!p.gettoneHash) return errore(ws, "posto-libero", `Il posto di ${p.nome} è già libero.`);
    p.gettoneHash = null;
    await this.salva(stato);
    for (const altro of this.ctx.getWebSockets()) {
      const a = altro.deserializeAttachment();
      if (a?.ruolo === "esplorator" && a.posto === posto) {
        altro.serializeAttachment({ ruolo: "ospite", posto: null });
        invia(altro, { tipo: "liberato", posto, messaggio: "Il master ha liberato il tuo posto. Puoi sceglierne un altro." });
      }
    }
    this.trasmetti(stato);
  }

  // Il master aggiunge un* esplorator*, che parte dall'ingresso.
  async aggiungi(ws, stato, io, { nome }) {
    if (io.ruolo !== "master") return errore(ws, "ruolo", "Solo il master può aggiungere esplorator*.");
    if (stato.posti.length >= MAX_GIOCATORI) return errore(ws, "troppi", `Al massimo ${MAX_GIOCATORI} esplorator* per partita.`);
    const n = controllaNome(nome, stato.posti.map((p) => p.name));
    if (n.errore) return errore(ws, "nome-non-valido", n.errore);
    stato.posti.push(nuovoPosto(this.compilato(stato), n.nome, stato.shown));
    await this.salva(stato, { attivita: true });
    this.trasmetti(stato);
  }

  // Il master toglie un* esplorator*. Chi occupava quel posto torna ospite; gli altri posti scalano.
  async togli(ws, stato, io, { posto }) {
    if (io.ruolo !== "master") return errore(ws, "ruolo", "Solo il master può togliere esplorator*.");
    if (!Number.isInteger(posto) || !stato.posti[posto]) return errore(ws, "posto-inesistente", "Questo posto non esiste.");
    if (stato.posti.length <= MIN_GIOCATORI) return errore(ws, "troppo-pochi", `Servono almeno ${MIN_GIOCATORI} esplorator*.`);
    stato.posti.splice(posto, 1);
    stato.ultima = null; // dopo una rimozione i posti scalano: l'ultima mossa non si può più annullare
    await this.salva(stato, { attivita: true });
    for (const altro of this.ctx.getWebSockets()) {
      const a = altro.deserializeAttachment();
      if (a?.ruolo !== "esplorator") continue;
      if (a.posto === posto) {
        altro.serializeAttachment({ ruolo: "ospite", posto: null });
        invia(altro, { tipo: "liberato", posto, messaggio: "Il master ti ha tolto dalla partita. Puoi scegliere un altro posto." });
      } else if (a.posto > posto) {
        altro.serializeAttachment({ ruolo: "esplorator", posto: a.posto - 1 });
      }
    }
    this.trasmetti(stato);
  }

  // Una mossa: entrare in una delle stanze proposte a un* esplorator*.
  // { tipo:"mossa", posto, stanza, versione } — «versione» è quella del posto nello stato da cui parte la mossa.
  async mossa(ws, stato, io, { posto, stanza, versione }) {
    const p = stato.posti[posto];
    if (!Number.isInteger(posto) || !p) return errore(ws, "posto-inesistente", "Questo posto non esiste.");
    if (io.ruolo === "esplorator") {
      if (io.posto !== posto) return errore(ws, "ruolo", `Puoi muovere solo per te. Per ${p.name} può muovere il master.`);
    } else if (io.ruolo !== "master") {
      return errore(ws, "ruolo", "Questo dispositivo non può muovere.");
    }
    // Conflitto sullo stesso personaggio (esplorator* e master insieme): vince la prima mossa arrivata.
    if (versione !== (p.v ?? 0)) {
      return errore(ws, "versione-superata", `${p.name} ha già mosso: ecco la situazione aggiornata.`, { stato: this.vista(stato) });
    }
    if (typeof stanza !== "string" || !p.offer.includes(stanza)) {
      return errore(ws, "stanza-non-proposta", "Questa stanza non è tra quelle proposte.", { stato: this.vista(stato) });
    }

    const m = this.compilato(stato);
    const { gettoneHash, ...giocatore } = p;
    // fotografia per l'annullamento: solo l'ultima mossa della sessione
    const ultima = { posto, autore: io.ruolo === "master" ? "master" : posto, giocatore: structuredClone(giocatore), shown: { ...stato.shown } };

    // stesse regole dell'app (enterRoom)
    if (p.node === "ingresso" && p.trail.length) { p.run++; p.trail = []; }
    p.trail.push(stanza);
    p.moves++;
    const info = m.roomMap[stanza];
    const prossimo = nextOfNode(m, p.node, info.room.path);
    stato.log.unshift({ player: p.name, room: info.room.title, path: info.room.path, step: p.trail.length, run: p.run, master: io.ruolo === "master" });
    if (stato.log.length > MAX_REGISTRO) stato.log.length = MAX_REGISTRO;
    p.node = prossimo;
    p.step = prossimo === "ingresso" ? 1 : p.trail.length + 1;
    p.seen ??= {};
    p.offer = drawOffer(m, prossimo, info.room.path, stato.shown, p.seen);
    p.v = (p.v ?? 0) + 1;
    stato.ultima = ultima;
    await this.salva(stato, { attivita: true });

    // Il testo della stanza viaggia solo qui, una volta, con la mossa di ingresso. Lo stato non lo contiene mai.
    const testo = { id: info.room.id, titolo: info.room.title, via: info.room.path, testo: info.room.content };
    this.trasmetti(stato, { tipo: "mossa", posto, stanza: testo });
  }

  // Annulla l'ultima mossa della sessione: può farlo chi l'ha fatta oppure il master.
  async annulla(ws, stato, io) {
    const u = stato.ultima;
    if (!u) return errore(ws, "niente-da-annullare", "Non c’è nessuna mossa da annullare: si può annullare solo l’ultima mossa della partita.");
    if (!(io.ruolo === "master" || (io.ruolo === "esplorator" && u.autore === io.posto))) {
      return errore(ws, "ruolo", "Solo chi ha fatto l’ultima mossa, oppure il master, può annullarla.");
    }
    const p = stato.posti[u.posto];
    const v = p.v ?? 0;
    Object.assign(p, u.giocatore); // il gettone del posto resta quello attuale
    p.v = v + 1;
    stato.shown = u.shown;         // anche i contatori «meno mostrate» tornano com'erano
    stato.log.shift();
    stato.ultima = null;
    await this.salva(stato, { attivita: true });
    this.trasmetti(stato, { tipo: "annullata", posto: u.posto });
  }

  // ---------- vista e invio ----------

  // Lo stato uguale per tutti i dispositivi. Non contiene mai i testi delle stanze,
  // né i nomi dei livelli non raggiunti (la lunghezza del percorso resta nascosta).
  vista(stato) {
    const m = this.compilato(stato);
    const stanza = (id) => {
      const r = m.roomMap[id].room;
      return { id: r.id, titolo: r.title, via: r.path };
    };
    const e = stato.esplorazione;
    return {
      codice: stato.codice,
      versione: stato.versione,
      esplorazione: {
        id: e.id, nome: e.nome, descrizione: e.descrizione ?? "",
        vie: e.vie.map(({ id, nome, breve, colore }) => ({ id, nome, breve: breve ?? nome, colore })),
        ...(e.regole ? { regole: e.regole } : {}),
        ...(e.regoleLink ? { regoleLink: e.regoleLink } : {}),
        ...(e.regoleImmagine ? { regoleImmagine: e.regoleImmagine } : {}),
      },
      posti: stato.posti.map((p) => {
        const completato = p.node === "ingresso" && p.trail.length > 0;
        return {
          nome: p.name,
          versione: p.v ?? 0,
          occupato: !!p.gettoneHash,
          giro: p.run,
          passo: p.step,
          livello: m.nodes[p.node].name || "",   // nome del livello della prossima mossa (può essere vuoto)
          completato,
          mosse: p.moves,
          percorso: p.trail.map(stanza),
          proposte: p.offer.map(stanza),
        };
      }),
      registro: stato.log.slice(0, 60).map((e) => ({ nome: e.player, stanza: e.room, via: e.path, passo: e.step, giro: e.run, master: !!e.master })),
      // L'ultima mossa della sessione, se si può ancora annullare. autore: "master" oppure il numero del posto.
      annullabile: stato.ultima
        ? { posto: stato.ultima.posto, nome: stato.posti[stato.ultima.posto]?.name ?? "", stanza: stato.log[0]?.room ?? "", autore: stato.ultima.autore }
        : null,
    };
  }

  // Manda a tutti lo stesso aggiornamento: { tipo:"stato" } oppure un evento (mossa, annullata) con lo stato.
  trasmetti(stato, evento = { tipo: "stato" }) {
    const msg = JSON.stringify({ ...evento, stato: this.vista(stato) });
    for (const ws of this.ctx.getWebSockets()) {
      if (ws.deserializeAttachment()?.ruolo) {
        try { ws.send(msg); } catch { /* connessione chiusa */ }
      }
    }
  }

  // ---------- storage ----------

  async carica() {
    this.stato ??= (await this.ctx.storage.get("stato")) ?? null;
    return this.stato;
  }

  async salva(stato, { attivita = false } = {}) {
    stato.versione += 1;
    if (attivita) stato.ultimaAttivita = Date.now();
    this.stato = stato;
    await this.ctx.storage.put("stato", stato);
  }

  compilato(stato) {
    if (!this.motore || this.motore.src !== stato.esplorazione) this.motore = compile(stato.esplorazione);
    return this.motore;
  }
}

// ---------- funzioni di servizio ----------

// Un posto è un* esplorator* con il suo percorso (stessa struttura dell'app) e, se occupato,
// l'impronta del gettone del dispositivo. Il gettone vero lo conosce solo il dispositivo.
function nuovoPosto(m, nome, shown) {
  return {
    name: nome, run: 1, trail: [], node: "ingresso", step: 1, moves: 0, seen: {}, v: 0,
    offer: drawOffer(m, "ingresso", null, shown, null),
    gettoneHash: null,
  };
}

export function controllaNome(nome, esistenti = []) {
  const n = typeof nome === "string" ? nome.trim().replace(/\s+/g, " ") : "";
  if (!n) return { errore: "Il nome non può essere vuoto." };
  if (n.length > MAX_NOME) return { errore: `Il nome può avere al massimo ${MAX_NOME} caratteri.` };
  if (esistenti.some((e) => e.toLowerCase() === n.toLowerCase())) return { errore: `C’è già qualcun* con il nome «${n}».` };
  return { nome: n };
}

export function casuale(byte = 18) {
  const b = crypto.getRandomValues(new Uint8Array(byte));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hash(testo) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(testo));
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

function invia(ws, dati) {
  try { ws.send(JSON.stringify(dati)); } catch { /* connessione chiusa */ }
}

function errore(ws, codice, messaggio, extra = {}) {
  invia(ws, { tipo: "errore", codice, messaggio, ...extra });
}
