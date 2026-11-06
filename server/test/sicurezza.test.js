// Prove del passo 3.10: limiti ai tentativi e controllo del codice.
import { env } from "cloudflare:workers";
import { describe, it, expect, beforeAll } from "vitest";
import { salva } from "../src/esplorazioni.js";
import { PIANETA, APP, chiama, crea } from "./aiuto.js";

beforeAll(async () => { expect((await salva(env.DB, PIANETA)).errore).toBeUndefined(); });

describe("Controllo del codice", () => {
  it("risponde con il pianeta se la partita esiste, 404 altrimenti", async () => {
    const { corpo } = await crea();
    const r = await chiama(`/api/partite/${corpo.codice.toLowerCase()}`, { headers: { Origin: APP } });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ codice: corpo.codice, esplorazione: { id: "lowrenzia", nome: "Pianeta di prova" } });
    expect((await chiama("/api/partite/LWR-000")).status).toBe(404);
    expect((await chiama("/api/partite/sbagliato")).status).toBe(404);
  });
});

describe("Limiti ai tentativi (3.10)", () => {
  it("dopo 30 tentativi di ingresso in un minuto dallo stesso indirizzo risponde 429", async () => {
    const ip = { "CF-Connecting-IP": "203.0.113.7" };
    const stati = [];
    for (let i = 0; i < 35; i++) stati.push((await chiama(`/api/partite/LWR-${100 + i}`, { headers: ip })).status);
    expect(stati.slice(0, 30).every((s) => s === 404)).toBe(true);
    expect(stati.slice(30).every((s) => s === 429)).toBe(true);
    // anche il WebSocket è bloccato per quell'indirizzo
    const ws = await chiama("/api/partite/LWR-100/ws", { headers: { ...ip, Upgrade: "websocket", Origin: APP } });
    expect(ws.status).toBe(429);
    expect((await ws.json()).errore).toContain("Aspetta un minuto");
    // un altro indirizzo non è toccato
    expect((await chiama("/api/partite/LWR-100", { headers: { "CF-Connecting-IP": "203.0.113.8" } })).status).toBe(404);
  });

  it("dopo 10 partite create in un minuto dallo stesso indirizzo risponde 429", async () => {
    const stati = [];
    for (let i = 0; i < 12; i++) {
      const r = await chiama("/api/partite", {
        method: "POST", headers: { Origin: APP, "CF-Connecting-IP": "198.51.100.4", "Content-Type": "application/json" },
        body: JSON.stringify({ esplorazione: "lowrenzia", posti: 2 }),
      });
      stati.push(r.status);
    }
    expect(stati.filter((s) => s === 201)).toHaveLength(10);
    expect(stati.slice(10)).toEqual([429, 429]);
  });
});
