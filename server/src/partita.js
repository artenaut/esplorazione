// Durable Object «Partita»: uno per sessione, con SQLite.
// Usa la WebSocket Hibernation API (obbligatoria, vedi docs/roadmap-server.md §1):
// tra un messaggio e l'altro l'oggetto può essere scaricato dalla memoria senza
// chiudere le connessioni, e non consuma tempo di calcolo.
//
// Passo 3.1: solo lo scheletro. Accetta le connessioni, risponde al ping senza
// risvegliarsi, conta i messaggi in SQLite e inoltra un messaggio di prova a tutti.
// Stato della partita, posti, mosse e scadenza arrivano nei passi 3.3–3.9.

import { DurableObject } from "cloudflare:workers";

export class Partita extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    // Il ping dei dispositivi riceve risposta direttamente dal runtime, senza risvegliare l'oggetto.
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
    ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(
        "CREATE TABLE IF NOT EXISTS meta (chiave TEXT PRIMARY KEY, valore TEXT NOT NULL)",
      );
    });
  }

  async fetch(request) {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Serve una connessione WebSocket.", { status: 426 });
    }
    const { 0: client, 1: server } = new WebSocketPair();
    // acceptWebSocket (e non server.accept()) attiva l'ibernazione.
    this.ctx.acceptWebSocket(server);
    server.send(JSON.stringify({ tipo: "connesso", collegati: this.ctx.getWebSockets().length }));
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, messaggio) {
    let dati;
    try {
      dati = JSON.parse(typeof messaggio === "string" ? messaggio : new TextDecoder().decode(messaggio));
    } catch {
      ws.send(JSON.stringify({ tipo: "errore", messaggio: "Messaggio non leggibile." }));
      return;
    }

    if (dati?.tipo === "prova") {
      const totale = this.incrementa("messaggi");
      const risposta = JSON.stringify({ tipo: "prova", testo: String(dati.testo ?? "").slice(0, 200), totale });
      for (const altro of this.ctx.getWebSockets()) {
        try { altro.send(risposta); } catch { /* connessione già chiusa */ }
      }
      return;
    }

    ws.send(JSON.stringify({ tipo: "errore", messaggio: "Tipo di messaggio sconosciuto." }));
  }

  async webSocketClose(ws, codice) {
    try { ws.close(codice, "Chiusa"); } catch { /* già chiusa */ }
  }

  async webSocketError(ws, errore) {
    console.error("Errore WebSocket:", errore?.message ?? errore);
  }

  incrementa(chiave) {
    const riga = this.ctx.storage.sql
      .exec(
        `INSERT INTO meta (chiave, valore) VALUES (?, '1')
         ON CONFLICT(chiave) DO UPDATE SET valore = CAST(valore AS INTEGER) + 1
         RETURNING valore`,
        chiave,
      )
      .one();
    return Number(riga.valore);
  }
}
