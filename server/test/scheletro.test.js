// Prove del passo 3.1: il Worker risponde e instrada i WebSocket verso le partite.
import { exports } from "cloudflare:workers";
import { VERSIONE } from "../src/costanti.js";
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
  it("una partita che non esiste risponde con un errore e chiude", async () => {
    const a = await apriWs("ZZZ-999");
    expect(await a.prossimo()).toMatchObject({ tipo: "errore", codice: "partita-inesistente" });
  });

});
