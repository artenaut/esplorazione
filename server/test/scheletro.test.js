// Prove del passo 3.1: il Worker risponde, il WebSocket della partita funziona
// con l'ibernazione e i dati in SQLite sopravvivono allo scaricamento dell'oggetto.
import { env, exports } from "cloudflare:workers";
import { evictDurableObject, runInDurableObject } from "cloudflare:test";
import { VERSIONE } from "../src/index.js";
import { describe, it, expect } from "vitest";

const BASE = "https://esplorazione.artenaut.workers.dev";
const chiama = (percorso, init) => exports.default.fetch(new Request(BASE + percorso, init));

async function apriWs(codice, origine = "https://artenaut.github.io") {
  const res = await chiama(`/api/partite/${codice}/ws`, { headers: { Upgrade: "websocket", Origin: origine } });
  expect(res.status).toBe(101);
  const ws = res.webSocket;
  const coda = [];
  const attese = [];
  ws.addEventListener("message", (e) => {
    const dato = typeof e.data === "string" && e.data.startsWith("{") ? JSON.parse(e.data) : e.data;
    const attesa = attese.shift();
    attesa ? attesa(dato) : coda.push(dato);
  });
  ws.accept();
  const prossimo = () => (coda.length ? Promise.resolve(coda.shift()) : new Promise((r) => attese.push(r)));
  return { ws, prossimo };
}

describe("Worker", () => {
  it("la pagina principale dice che il server è online", async () => {
    const res = await chiama("/");
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("server online");
  });

  it("/api/stato risponde con CORS solo per l'app", async () => {
    const ok = await chiama("/api/stato", { headers: { Origin: "https://artenaut.github.io" } });
    expect(await ok.json()).toEqual({ ok: true, versione: VERSIONE });
    expect(ok.headers.get("Access-Control-Allow-Origin")).toBe("https://artenaut.github.io");

    const altro = await chiama("/api/stato", { headers: { Origin: "https://esempio.it" } });
    expect(altro.headers.get("Access-Control-Allow-Origin")).toBeNull();

    const pre = await chiama("/api/stato", { method: "OPTIONS", headers: { Origin: "https://esempio.it" } });
    expect(pre.status).toBe(403);
  });

  it("indirizzi sconosciuti e codici non validi vengono rifiutati", async () => {
    expect((await chiama("/niente")).status).toBe(404);
    expect((await chiama("/api/partite/LWR-482/ws")).status).toBe(426);
    const res = await chiama("/api/partite/x/ws", { headers: { Upgrade: "websocket" } });
    expect(res.status).toBe(400);
  });

  it("il WebSocket rifiuta origini estranee", async () => {
    const res = await chiama("/api/partite/LWR-482/ws", { headers: { Upgrade: "websocket", Origin: "https://esempio.it" } });
    expect(res.status).toBe(403);
  });
});

describe("Durable Object Partita", () => {
  it("accetta più dispositivi e inoltra i messaggi a tutti", async () => {
    const a = await apriWs("LWR-001");
    expect(await a.prossimo()).toEqual({ tipo: "connesso", collegati: 1 });
    const b = await apriWs("lwr-001"); // il codice si normalizza in maiuscolo
    expect(await b.prossimo()).toEqual({ tipo: "connesso", collegati: 2 });

    a.ws.send(JSON.stringify({ tipo: "prova", testo: "ciao" }));
    expect(await a.prossimo()).toEqual({ tipo: "prova", testo: "ciao", totale: 1 });
    expect(await b.prossimo()).toEqual({ tipo: "prova", testo: "ciao", totale: 1 });

    a.ws.send("non json");
    expect((await a.prossimo()).tipo).toBe("errore");
    a.ws.close(); b.ws.close();
  });

  it("risponde al ping senza risvegliarsi", async () => {
    const a = await apriWs("LWR-002");
    await a.prossimo();
    a.ws.send("ping");
    expect(await a.prossimo()).toBe("pong");
    a.ws.close();
  });

  it("partite diverse sono separate", async () => {
    const a = await apriWs("LWR-003");
    const b = await apriWs("LWR-004");
    expect((await a.prossimo()).collegati).toBe(1);
    expect((await b.prossimo()).collegati).toBe(1);
    a.ws.close(); b.ws.close();
  });

  it("le connessioni e i dati sopravvivono all'ibernazione", async () => {
    const a = await apriWs("LWR-005");
    await a.prossimo();
    a.ws.send(JSON.stringify({ tipo: "prova", testo: "uno" }));
    expect((await a.prossimo()).totale).toBe(1);

    const stub = env.PARTITA.get(env.PARTITA.idFromName("LWR-005"));
    await evictDurableObject(stub); // scarica l'oggetto dalla memoria, iberna i WebSocket

    a.ws.send(JSON.stringify({ tipo: "prova", testo: "due" }));
    expect(await a.prossimo()).toEqual({ tipo: "prova", testo: "due", totale: 2 });
    const n = await runInDurableObject(stub, (_istanza, stato) => stato.getWebSockets().length);
    expect(n).toBe(1);
    a.ws.close();
  });
});
