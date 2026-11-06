// Prove del passo 3.10: limiti ai tentativi e controllo del codice.
import { env } from "cloudflare:workers";
import { describe, it, expect, beforeAll } from "vitest";
import { salva } from "../src/esplorazioni.js";
import { PIANETA, APP, chiama, crea, apriWs } from "./aiuto.js";
import { prefissoIPv6 } from "../src/util.js";
import { MAX_MESSAGGI, MAX_CONNESSIONI, MAX_NICKNAME_RETE } from "../src/partita.js";

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

// ---------- revisione di sicurezza del 6/11/2026 ----------

describe("Revisione di sicurezza", () => {
  it("troppi messaggi da una connessione: errore e chiusura", async () => {
    const { corpo } = await crea();
    const t = await apriWs(corpo.codice);
    for (let i = 0; i <= MAX_MESSAGGI; i++) t.manda({ tipo: "stato" });
    let m;
    do { m = await t.aspetta("errore"); } while (m.codice === "non-entrato");   // le prime risposte: «prima entra»
    expect(m).toMatchObject({ codice: "troppi-messaggi" });
  });

  it(`al massimo ${MAX_CONNESSIONI} connessioni per partita`, async () => {
    const { corpo } = await crea();
    for (let i = 0; i < MAX_CONNESSIONI; i++) await apriWs(corpo.codice);
    const extra = await apriWs(corpo.codice);
    expect(await extra.aspetta("errore")).toMatchObject({ codice: "troppe-connessioni" });
  });

  it("IPv6: il limite conta per blocco /64", async () => {
    expect(prefissoIPv6("2001:db8:aa:bb:1:2:3:4")).toBe("2001:db8:aa:bb");
    expect(prefissoIPv6("2001:DB8:0aa::1")).toBe("2001:db8:aa:0");
    expect(prefissoIPv6("::1")).toBe("0:0:0:0");
    const stati = [];
    for (let i = 0; i < 32; i++) {
      stati.push((await chiama(`/api/partite/LWR-${200 + i}`, { headers: { "CF-Connecting-IP": `2001:db8:1:2::${(i + 1).toString(16)}` } })).status);
    }
    expect(stati).toEqual([...Array(30).fill(404), 429, 429]);
  });

  it(`al massimo ${MAX_NICKNAME_RETE} nuovi nickname per rete in 10 minuti; l'impronta mandata dal dispositivo non conta`, async () => {
    const { corpo } = await crea(["a", "b"], "lowrenzia", { assegna: false });
    const res = await chiama(`/api/partite/${corpo.codice}/ws`, {
      headers: { Upgrade: "websocket", Origin: APP, "CF-Connecting-IP": "192.0.2.55", "X-Impronta-Rete": "0".repeat(64) },
    });
    const ws = res.webSocket; const coda = []; let attesa = null;
    ws.addEventListener("message", (e) => { const d = JSON.parse(e.data); attesa ? (attesa(d), attesa = null) : coda.push(d); });
    ws.accept();
    const prossimo = () => (coda.length ? Promise.resolve(coda.shift()) : new Promise((r) => (attesa = r)));
    const tipo = async (t) => { for (;;) { const m = await prossimo(); if (m.tipo === t) return m; } };
    ws.send(JSON.stringify({ tipo: "entra", codiceMaster: corpo.codiceMaster })); await tipo("benvenuto");
    for (let i = 0; i < MAX_NICKNAME_RETE; i++) {
      ws.send(JSON.stringify({ tipo: "identita", posto: 0, scelta: { tipo: "nuovo", nickname: `Rete prova ${i}`, eta14: true, consenso: true } }));
      await tipo("stato");
    }
    ws.send(JSON.stringify({ tipo: "identita", posto: 0, scelta: { tipo: "nuovo", nickname: "Rete prova extra", eta14: true, consenso: true } }));
    expect((await tipo("errore")).messaggio).toContain("da questa rete");
  });

  it("niente richieste CORS preliminari per /admin", async () => {
    expect((await chiama("/admin/api/esplorazioni", { method: "OPTIONS", headers: { Origin: APP } })).status).toBe(404);
    expect((await chiama("/api/partite", { method: "OPTIONS", headers: { Origin: APP } })).status).toBe(204);
  });
});
