// Durable Object «Partita»: uno per sessione, con SQLite.
// Usa la WebSocket Hibernation API (obbligatoria, vedi docs/roadmap-server.md §1): tra un messaggio
// e l'altro l'oggetto può essere scaricato dalla memoria senza chiudere le connessioni.
// Per questo nulla vive solo in memoria: lo stato sta nello storage, il ruolo di ogni
// connessione nell'«attachment» del WebSocket.
//
// Passi 3.3–3.9: creazione, posti con gettone, ruoli (master, esplorator*, tabellone, ospite),
// mosse con estrazione sul server, annullamento dell'ultima mossa, chiusura e scadenza automatica.
// Fase 4: ogni posto nasce «da scegliere»; chi lo occupa (o il master) sceglie un nickname del club,
// ne crea uno nuovo con il consenso, oppure gioca come guest con un nome generato dal server.
// Protocollo completo: docs/protocollo-partita.md.

import { DurableObject } from "cloudflare:workers";
import { compile, drawOffer, nextOfNode } from "../../motore.js";
import { casuale, hash } from "./util.js";
import { nuovaPartita } from "./crea.js";
import { leggi } from "./esplorazioni.js";
import { leggiNickname, creaNickname, nomeGuest } from "./esplorator.js";

export const MIN_GIOCATORI = 2, MAX_GIOCATORI = 4, MAX_REGISTRO = 500;
// Nuovi nickname creabili in una partita (contro chi ne crea in serie).
export const MAX_NUOVI_NICKNAME = 8;
const ROMANI = ["I", "II", "III", "IV"];
// Scadenza: 6 ore senza attività, e comunque 24 ore dopo la creazione (roadmap-server.md §2).
export const SENZA_ATTIVITA = 6 * 60 * 60 * 1000, DURATA_MASSIMA = 24 * 60 * 60 * 1000;

// Ruoli di una connessione: «ospite» (ha il codice ma non ha ancora un posto), «esplorator» (ha un posto),
// «master» (ha il codice master), «tabellone» (sola lettura).

export class Partita extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    // Il ping dei dispositivi riceve risposta direttamente dal runtime, senza risvegliare l'oggetto.
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
    this.stato = null;     // copia in memoria, ricaricata dallo storage dopo l'ibernazione
    this.motore = null;    // pianeta compilato (cache)
    this.allarmeVerificato = false;
  }

  // ---------- creazione (chiamata dal Worker via RPC) ----------

  // dati = { codice, esplorazione (file completo, già validato), identita (un elemento per posto:
  //          null = da scegliere, oppure l'identità da riprendere con «stesso gruppo»), codiceMaster,
  //          gettoniHash (facoltativo: impronte dei gettoni dei posti, per «stesso gruppo») }
  async crea({ codice, esplorazione, identita, codiceMaster, gettoniHash = [] }) {
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
      posti: identita.map((id, i) => ({ ...nuovoPosto(m, id, shown), gettoneHash: gettoniHash[i] ?? null })),
      log: [],
      nuoviNickname: 0,
    };
    this.stato = stato;
    await this.ctx.storage.put("stato", stato);
    await this.ctx.storage.setAlarm(scadenza(stato));
    return { ok: true };
  }

  // Controllo veloce del codice (GET /api/partite/:codice): niente nomi né stato, solo il pianeta.
  async info() {
    const stato = await this.carica();
    return stato ? { codice: stato.codice, esplorazione: { id: stato.esplorazione.id, nome: stato.esplorazione.nome } } : null;
  }

  // ---------- connessioni ----------

  async fetch(request) {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Serve una connessione WebSocket.", { status: 426 });
    }
    const { 0: client, 1: server } = new WebSocketPair();
    this.ctx.acceptWebSocket(server); // attiva l'ibernazione
    server.serializeAttachment({ ruolo: null, posto: null });
    const stato = await this.carica();
    if (!stato) {
      invia(server, { tipo: "errore", codice: "partita-inesistente", messaggio: "Non c’è nessuna partita con questo codice. Controlla il codice o chiedi a chi l’ha creata." });
      server.close(4404, "Partita inesistente");
    } else if (!this.allarmeVerificato) {
      // partite create prima del passo 3.9: si assegna la scadenza
      if ((await this.ctx.storage.getAlarm()) == null) await this.ctx.storage.setAlarm(scadenza(stato));
      this.allarmeVerificato = true;
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
        case "identita": return await this.identita(ws, stato, io, dati);
        case "mossa": return await this.mossa(ws, stato, io, dati);
        case "annulla": return await this.annulla(ws, stato, io);
        case "chiudi": return await this.chiudi(ws, stato, io, dati);
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
    if (p.gettoneHash) return errore(ws, "posto-occupato", `Il posto di ${nomePosto(p, posto)} è già occupato da un altro dispositivo.`);
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
    if (!p.gettoneHash) return errore(ws, "posto-libero", `Il posto di ${nomePosto(p, posto)} è già libero.`);
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

  // Il master aggiunge un posto «da scegliere», che parte dall'ingresso.
  async aggiungi(ws, stato, io) {
    if (io.ruolo !== "master") return errore(ws, "ruolo", "Solo il master può aggiungere esplorator*.");
    if (stato.posti.length >= MAX_GIOCATORI) return errore(ws, "troppi", `Al massimo ${MAX_GIOCATORI} esplorator* per partita.`);
    stato.posti.push(nuovoPosto(this.compilato(stato), null, stato.shown));
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

  // Chi gioca in un posto: { tipo:"identita", posto, scelta } con scelta
  //   { tipo:"nickname", id }                                  nickname del club dall'elenco
  //   { tipo:"nuovo", nickname, consenso:true, eta14:true }    nuovo nickname, con il consenso
  //   { tipo:"guest" }                                         nome buffo scelto dal server (di nuovo: un altro nome)
  // La può fare il dispositivo seduto in quel posto, oppure il master. Solo prima della prima mossa.
  async identita(ws, stato, io, { posto, scelta }) {
    const p = stato.posti[posto];
    if (!Number.isInteger(posto) || !p) return errore(ws, "posto-inesistente", "Questo posto non esiste.");
    if (!(io.ruolo === "master" || (io.ruolo === "esplorator" && io.posto === posto))) {
      return errore(ws, "ruolo", "Chi gioca in un posto lo sceglie il telefono seduto lì, oppure il master.");
    }
    if (p.moves > 0) return errore(ws, "identita-bloccata", "Dopo la prima mossa non si può più cambiare chi gioca in questo posto.");
    const altri = stato.posti.filter((_, i) => i !== posto);
    let nuova;
    if (scelta?.tipo === "guest") {
      nuova = { tipo: "guest", nome: nomeGuest(altri.map((q) => q.name).filter(Boolean), p.identita?.tipo === "guest" ? p.name : null) };
    } else if (scelta?.tipo === "nickname") {
      const id = Number(scelta.id);
      if (!Number.isInteger(id)) return errore(ws, "messaggio-non-valido", "Nickname non valido.");
      const r = await leggiNickname(this.env.DB, id);
      if (!r) return errore(ws, "nickname-inesistente", "Questo nickname non esiste più: scegline un altro.");
      if (altri.some((q) => q.identita?.tipo === "nickname" && q.identita.id === id)) {
        return errore(ws, "nickname-in-uso", `«${r.nickname}» sta già giocando in questa partita.`);
      }
      nuova = { tipo: "nickname", id: r.id, nome: r.nickname };
    } else if (scelta?.tipo === "nuovo") {
      if (scelta.eta14 !== true || scelta.consenso !== true) {
        return errore(ws, "consenso-mancante", "Per comparire in classifica servono entrambe le caselle. Altrimenti puoi giocare come guest.");
      }
      if ((stato.nuoviNickname ?? 0) >= MAX_NUOVI_NICKNAME) {
        return errore(ws, "troppi-nickname", "In questa partita sono già stati creati troppi nickname: chiedi a chi amministra.");
      }
      const r = await creaNickname(this.env.DB, scelta.nickname);
      if (r.errore) return errore(ws, "nickname-non-valido", r.errore);
      stato.nuoviNickname = (stato.nuoviNickname ?? 0) + 1;
      nuova = { tipo: "nickname", id: r.id, nome: r.nickname };
    } else {
      return errore(ws, "messaggio-non-valido", "Scelta non valida.");
    }
    p.identita = nuova;
    p.name = nuova.nome;
    await this.salva(stato, { attivita: true });
    this.trasmetti(stato);
  }

  // Una mossa: entrare in una delle stanze proposte a un* esplorator*.
  // { tipo:"mossa", posto, stanza, versione } — «versione» è quella del posto nello stato da cui parte la mossa.
  async mossa(ws, stato, io, { posto, stanza, versione }) {
    const p = stato.posti[posto];
    if (!Number.isInteger(posto) || !p) return errore(ws, "posto-inesistente", "Questo posto non esiste.");
    if (io.ruolo === "esplorator") {
      if (io.posto !== posto) return errore(ws, "ruolo", `Puoi muovere solo per te. Per ${nomePosto(p, posto)} può muovere il master.`);
    } else if (io.ruolo !== "master") {
      return errore(ws, "ruolo", "Questo dispositivo non può muovere.");
    }
    if (!p.identita) return errore(ws, "identita-mancante", "Prima bisogna scegliere chi gioca in questo posto: nickname o guest.");
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
    // dati per la classifica (fase 5): stanze per via e cicli completati (si conta l'ingresso nel finale)
    p.perVia ??= {};
    p.perVia[info.room.path] = (p.perVia[info.room.path] ?? 0) + 1;
    if (info.node === "finale") p.cicli = (p.cicli ?? 0) + 1;
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
    p.perVia = u.giocatore.perVia ?? {};
    p.cicli = u.giocatore.cicli ?? 0;
    p.v = v + 1;
    stato.shown = u.shown;         // anche i contatori «meno mostrate» tornano com'erano
    stato.log.shift();
    stato.ultima = null;
    await this.salva(stato, { attivita: true });
    this.trasmetti(stato, { tipo: "annullata", posto: u.posto });
  }

  // Chiudi partita (salva: true) o Annulla partita (salva: false), poi «fine» o «stesso-gruppo».
  // In entrambi i casi i dati della partita vengono eliminati dal server. Il riepilogo per la
  // classifica viene calcolato e inviato con «Chiudi»; il salvataggio arriva con la fase 5.
  async chiudi(ws, stato, io, { salva, poi }) {
    if (io.ruolo !== "master") return errore(ws, "ruolo", "Solo il master può chiudere o annullare la partita.");
    if (typeof salva !== "boolean" || !["fine", "stesso-gruppo"].includes(poi)) {
      return errore(ws, "messaggio-non-valido", "Indica se salvare la partita e come proseguire.");
    }
    const modo = salva ? "chiusa" : "annullata";

    // posti con un dispositivo collegato in questo momento: restano seduti nella nuova partita
    const connessioni = this.ctx.getWebSockets().map((w) => ({ w, a: w.deserializeAttachment() ?? {} }));
    let nuova = null;
    const gettoni = [];
    if (poi === "stesso-gruppo") {
      const seduti = new Set(connessioni.filter((c) => c.a.ruolo === "esplorator").map((c) => c.a.posto));
      stato.posti.forEach((_, i) => { gettoni[i] = seduti.has(i) ? casuale() : null; });
      const impronte = await Promise.all(gettoni.map((g) => (g ? hash(g) : null)));
      // la nuova partita usa la versione attuale del pianeta; se nel frattempo è stato rimosso, la copia di questa
      const esplorazione = (await leggi(this.env.DB, stato.esplorazione.id).catch(() => null)) ?? stato.esplorazione;
      nuova = await nuovaPartita(this.env, esplorazione, stato.posti.map((p) => p.identita ?? null), impronte);
      if (!nuova) return errore(ws, "errore-server", "Non è stato possibile creare la nuova partita. Riprova.");
    }

    const riepilogo = salva ? riepilogoPartita(stato) : null;
    for (const { w, a } of connessioni) {
      let n = null;
      if (nuova) {
        n = { codice: nuova.codice, link: nuova.link };
        if (a.ruolo === "master") n.codiceMaster = nuova.codiceMaster;
        if (a.ruolo === "esplorator" && gettoni[a.posto]) Object.assign(n, { posto: a.posto, gettone: gettoni[a.posto] });
      }
      invia(w, { tipo: "chiusa", modo, poi, ...(riepilogo ? { riepilogo } : {}), nuova: n });
      try { w.close(4000, salva ? "Partita chiusa" : "Partita annullata"); } catch { /* già chiusa */ }
    }
    await this.elimina();
  }

  // Scadenza automatica: l'allarme scatta all'ora di scadenza calcolata dall'ultima attività.
  async alarm() {
    const stato = await this.carica();
    if (!stato) return;
    const s = scadenza(stato);
    if (Date.now() < s - 1000) return this.ctx.storage.setAlarm(s); // c'è stata attività nel frattempo
    for (const w of this.ctx.getWebSockets()) {
      invia(w, { tipo: "chiusa", modo: "scaduta", poi: "fine", nuova: null,
        messaggio: "La partita è scaduta (6 ore senza mosse, oppure 24 ore dalla creazione): i suoi dati sono stati eliminati." });
      try { w.close(4000, "Partita scaduta"); } catch { /* già chiusa */ }
    }
    await this.elimina();
  }

  async elimina() {
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
    this.stato = null;
    this.motore = null;
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
      scade: scadenza(stato), // data e ora (ms) in cui la partita verrà eliminata se nessuno muove
      esplorazione: {
        id: e.id, nome: e.nome, descrizione: e.descrizione ?? "",
        vie: e.vie.map(({ id, nome, breve, colore }) => ({ id, nome, breve: breve ?? nome, colore })),
        ...(e.regole ? { regole: e.regole } : {}),
        ...(e.regoleLink ? { regoleLink: e.regoleLink } : {}),
        ...(e.regoleImmagine ? { regoleImmagine: e.regoleImmagine } : {}),
      },
      posti: stato.posti.map((p, i) => {
        const completato = p.node === "ingresso" && p.trail.length > 0;
        return {
          nome: nomePosto(p, i),
          // null = ancora da scegliere; { tipo:"nickname", id } oppure { tipo:"guest" }
          identita: p.identita ? (p.identita.tipo === "nickname" ? { tipo: "nickname", id: p.identita.id } : { tipo: "guest" }) : null,
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
    if (!this.stato) {
      this.stato = (await this.ctx.storage.get("stato")) ?? null;
      // partite create prima della fase 4, con i nomi scritti a mano: quei nomi valgono come guest
      for (const p of this.stato?.posti ?? []) if (p.identita === undefined) p.identita = p.name ? { tipo: "guest", nome: p.name } : null;
    }
    return this.stato;
  }

  async salva(stato, { attivita = false } = {}) {
    stato.versione += 1;
    if (attivita) stato.ultimaAttivita = Date.now();
    this.stato = stato;
    await this.ctx.storage.put("stato", stato);
    if (attivita) await this.ctx.storage.setAlarm(scadenza(stato));
  }

  compilato(stato) {
    if (!this.motore || this.motore.src !== stato.esplorazione) this.motore = compile(stato.esplorazione);
    return this.motore;
  }
}

// ---------- funzioni di servizio ----------

// Un posto è un* esplorator* con il suo percorso (stessa struttura dell'app) e, se occupato,
// l'impronta del gettone del dispositivo. Il gettone vero lo conosce solo il dispositivo.
// identita: null (da scegliere) | { tipo:"nickname", id, nome } | { tipo:"guest", nome }
function nuovoPosto(m, identita, shown) {
  return {
    identita: identita ?? null, name: identita?.nome ?? null, run: 1, trail: [], node: "ingresso", step: 1, moves: 0, seen: {}, v: 0, cicli: 0, perVia: {},
    offer: drawOffer(m, "ingresso", null, shown, null),
    gettoneHash: null,
  };
}

// Nome da mostrare: quello scelto, oppure «Posto II» finché è da scegliere.
export function nomePosto(p, i) {
  return p.name ?? `Posto ${ROMANI[i] ?? i + 1}`;
}

export function scadenza(stato) {
  return Math.min(stato.ultimaAttivita + SENZA_ATTIVITA, stato.creata + DURATA_MASSIMA);
}

// Dati per la classifica (fase 5), per ogni esplorator*: cicli completati, stanze aperte, stanze per via.
// tipo «nickname» (con l'id del nickname) entrerà in classifica; «guest» e i posti mai scelti no.
export function riepilogoPartita(stato) {
  return {
    esplorazione: stato.esplorazione.id,
    posti: stato.posti.map((p, i) => ({
      nome: nomePosto(p, i),
      tipo: p.identita?.tipo ?? null,
      nickname: p.identita?.tipo === "nickname" ? p.identita.id : null,
      cicli: p.cicli ?? 0, stanze: p.moves, perVia: { ...(p.perVia ?? {}) },
    })),
  };
}

function invia(ws, dati) {
  try { ws.send(JSON.stringify(dati)); } catch { /* connessione chiusa */ }
}

function errore(ws, codice, messaggio, extra = {}) {
  invia(ws, { tipo: "errore", codice, messaggio, ...extra });
}
