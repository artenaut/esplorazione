// Prove dei passi 3.3–3.5: creazione della partita, posti con gettone, ruoli.
import { env, exports } from "cloudflare:workers";
import { evictDurableObject } from "cloudflare:test";
import { describe, it, expect, beforeAll } from "vitest";
import { salva } from "../src/esplorazioni.js";
import { prefissoCodice } from "../src/crea.js";

const BASE = "https://esplorazione.artenaut.workers.dev";
const APP = "https://artenaut.github.io";
const chiama = (percorso, init) => exports.default.fetch(new Request(BASE + percorso, init));

const st = (p, n, via = "a") => Array.from({ length: n }, (_, i) => ({ id: p + i, titolo: "Titolo " + p + i, via, testo: "SEGRETO " + p + i }));
const PIANETA = {
  formato: 2, id: "lowrenzia", nome: "Pianeta di prova", estrazione: "meno-mostrate",
  vie: [{ id: "a", nome: "Via A", colore: "#112233" }, { id: "b", nome: "Via B", colore: "#445566" }],
  ingresso: { nome: "Ingresso", stanze: [...st("IA", 1), ...st("IB", 1, "b")], successivo: "L" },
  livelli: { L: { nome: "La forgia", stanze: [...st("LA", 3), ...st("LB", 3, "b")], proposte: { a: { a: 2 }, b: { b: 2 } }, successivo: "finale" } },
  finale: { nome: "La vetta", stanze: [...st("FA", 1), ...st("FB", 1, "b")], proposte: { a: { a: 1 }, b: { b: 1 } } },
};

beforeAll(async () => {
  expect((await salva(env.DB, PIANETA)).errore).toBeUndefined();
});

async function crea(nomi = ["Alba", "Bruno"], esplorazione = "lowrenzia") {
  const r = await chiama("/api/partite", { method: "POST", headers: { Origin: APP, "Content-Type": "application/json" }, body: JSON.stringify({ esplorazione, nomi }) });
  return { status: r.status, corpo: await r.json() };
}

async function apriWs(codice) {
  const res = await chiama(`/api/partite/${codice}/ws`, { headers: { Upgrade: "websocket", Origin: APP } });
  expect(res.status).toBe(101);
  const ws = res.webSocket, coda = [], attese = [];
  ws.addEventListener("message", (e) => {
    const d = typeof e.data === "string" && e.data.startsWith("{") ? JSON.parse(e.data) : e.data;
    const a = attese.shift(); a ? a(d) : coda.push(d);
  });
  ws.accept();
  const prossimo = () => (coda.length ? Promise.resolve(coda.shift()) : new Promise((r) => attese.push(r)));
  const manda = (o) => ws.send(JSON.stringify(o));
  // aspetta il primo messaggio di un certo tipo, scartando gli altri
  const aspetta = async (tipo) => { for (;;) { const m = await prossimo(); if (m.tipo === tipo) return m; } };
  return { ws, prossimo, manda, aspetta, coda };
}

describe("Creazione della partita (3.3)", () => {
  it("prefisso del codice dal nome tecnico del pianeta", () => {
    expect(prefissoCodice("lowrenzia")).toBe("LWR");
    expect(prefissoCodice("pianeta-di-prova")).toBe("PNT");
    expect(prefissoCodice("aeiou")).toBe("AEI");
    expect(prefissoCodice("x")).toBe("XXX");
  });

  it("crea la partita con codice corto, codice master e link per il QR", async () => {
    const { status, corpo } = await crea();
    expect(status).toBe(201);
    expect(corpo.codice).toMatch(/^LWR-\d{3}$/);
    expect(corpo.codiceMaster.length).toBeGreaterThanOrEqual(24);
    expect(corpo.link).toBe(`https://artenaut.github.io/esplorazione/?partita=${corpo.codice}`);
  });

  it("rifiuta dati non validi", async () => {
    expect((await crea(["Solo"])).status).toBe(400);
    expect((await crea(["A", "B", "C", "D", "E"])).status).toBe(400);
    expect((await crea(["Alba", "alba"])).corpo.errore).toContain("già qualcun*");
    expect((await crea(["Alba", " "])).status).toBe(400);
    expect((await crea(["Alba", "x".repeat(25)])).status).toBe(400);
    expect((await crea(["Alba", "Bruno"], "non-esiste")).status).toBe(404);
    const estranea = await chiama("/api/partite", { method: "POST", headers: { Origin: "https://esempio.it" }, body: "{}" });
    expect(estranea.status).toBe(403);
  });

  it("i nomi vengono ripuliti dagli spazi", async () => {
    const { corpo } = await crea(["  Alba   Rossi ", "Bruno"]);
    const t = await apriWs(corpo.codice);
    t.manda({ tipo: "entra" });
    const b = await t.aspetta("benvenuto");
    expect(b.stato.posti.map((p) => p.nome)).toEqual(["Alba Rossi", "Bruno"]);
  });
});

describe("Ruoli, posti e gettoni (3.4–3.5)", () => {
  it("lo stato non contiene mai i testi e mostra solo il livello attuale", async () => {
    const { corpo } = await crea(["Alba", "Bruno", "Cleo"]);
    const t = await apriWs(corpo.codice);
    t.manda({ tipo: "entra", ruolo: "tabellone" });
    const b = await t.aspetta("benvenuto");
    expect(b.ruolo).toBe("tabellone");
    const testo = JSON.stringify(b);
    expect(testo).not.toContain("SEGRETO");
    expect(testo).not.toContain("La forgia");  // livello non ancora raggiunto
    expect(testo).not.toContain("La vetta");
    const p = b.stato.posti[0];
    expect(p).toMatchObject({ nome: "Alba", occupato: false, giro: 1, passo: 1, livello: "Ingresso", completato: false, mosse: 0, percorso: [] });
    expect(p.proposte.map((x) => x.id).sort()).toEqual(["IA0", "IB0"]);
    expect(p.proposte[0]).toEqual({ id: expect.any(String), titolo: expect.stringContaining("Titolo"), via: expect.any(String) });
    expect(b.stato.esplorazione.vie).toHaveLength(2);
    expect(b.stato.esplorazione.ingresso).toBeUndefined();
  });

  it("un ospite occupa un posto, riceve il gettone e rientra da solo dopo l'ibernazione", async () => {
    const { corpo } = await crea();
    const a = await apriWs(corpo.codice);
    a.manda({ tipo: "entra" });
    expect((await a.aspetta("benvenuto")).ruolo).toBe("ospite");
    a.manda({ tipo: "occupa", posto: 1 });
    const { gettone, posto } = await a.aspetta("posto");
    expect(posto).toBe(1);
    expect((await a.aspetta("stato")).stato.posti[1].occupato).toBe(true);

    // un altro dispositivo non può prendere lo stesso posto
    const b = await apriWs(corpo.codice);
    b.manda({ tipo: "entra" }); await b.aspetta("benvenuto");
    b.manda({ tipo: "occupa", posto: 1 });
    expect(await b.aspetta("errore")).toMatchObject({ codice: "posto-occupato" });
    // e chi ha già un posto non ne prende un secondo
    a.manda({ tipo: "occupa", posto: 0 });
    expect(await a.aspetta("errore")).toMatchObject({ codice: "ruolo" });

    // ibernazione: il ruolo resta legato alla connessione
    await evictDurableObject(env.PARTITA.get(env.PARTITA.idFromName(corpo.codice)));
    a.manda({ tipo: "occupa", posto: 0 });
    expect(await a.aspetta("errore")).toMatchObject({ codice: "ruolo" });

    // il telefono va in standby e torna: rientra con il gettone
    a.ws.close();
    const a2 = await apriWs(corpo.codice);
    a2.manda({ tipo: "entra", gettone });
    expect(await a2.aspetta("benvenuto")).toMatchObject({ ruolo: "esplorator", posto: 1 });
    // un gettone inventato non vale
    const c = await apriWs(corpo.codice);
    c.manda({ tipo: "entra", gettone: "inventato" });
    expect(await c.aspetta("errore")).toMatchObject({ codice: "gettone-non-valido" });
  });

  it("il master libera un posto: il gettone non vale più e il posto torna libero", async () => {
    const { corpo } = await crea();
    const g = await apriWs(corpo.codice);
    g.manda({ tipo: "entra" }); await g.aspetta("benvenuto");
    g.manda({ tipo: "occupa", posto: 0 });
    const { gettone } = await g.aspetta("posto");

    const m = await apriWs(corpo.codice);
    m.manda({ tipo: "entra", codiceMaster: "sbagliato" });
    expect(await m.aspetta("errore")).toMatchObject({ codice: "codice-master-errato" });
    m.manda({ tipo: "entra", codiceMaster: corpo.codiceMaster });
    expect((await m.aspetta("benvenuto")).ruolo).toBe("master");

    // solo il master può liberare
    g.manda({ tipo: "libera", posto: 0 });
    expect(await g.aspetta("errore")).toMatchObject({ codice: "ruolo" });

    m.manda({ tipo: "libera", posto: 0 });
    expect(await g.aspetta("liberato")).toMatchObject({ posto: 0 });
    expect((await m.aspetta("stato")).stato.posti[0].occupato).toBe(false);

    const g2 = await apriWs(corpo.codice);
    g2.manda({ tipo: "entra", gettone });
    expect(await g2.aspetta("errore")).toMatchObject({ codice: "gettone-non-valido" });
    // il dispositivo liberato è tornato ospite e può scegliere di nuovo
    g.manda({ tipo: "occupa", posto: 0 });
    expect((await g.aspetta("posto")).posto).toBe(0);
  });

  it("un altro dispositivo con il codice master prende il ruolo di master", async () => {
    const { corpo } = await crea();
    const m1 = await apriWs(corpo.codice);
    m1.manda({ tipo: "entra", codiceMaster: corpo.codiceMaster }); await m1.aspetta("benvenuto");
    m1.ws.close();
    const m2 = await apriWs(corpo.codice);
    m2.manda({ tipo: "entra", codiceMaster: corpo.codiceMaster });
    expect((await m2.aspetta("benvenuto")).ruolo).toBe("master");
  });

  it("il master aggiunge e toglie esplorator*, nei limiti 2–4; gli altri no", async () => {
    const { corpo } = await crea(["Alba", "Bruno", "Cleo"]);
    const m = await apriWs(corpo.codice);
    m.manda({ tipo: "entra", codiceMaster: corpo.codiceMaster }); await m.aspetta("benvenuto");
    const g = await apriWs(corpo.codice);
    g.manda({ tipo: "entra" }); await g.aspetta("benvenuto");
    g.manda({ tipo: "occupa", posto: 2 }); await g.aspetta("posto");

    g.manda({ tipo: "aggiungi", nome: "Dario" });
    expect(await g.aspetta("errore")).toMatchObject({ codice: "ruolo" });

    m.manda({ tipo: "aggiungi", nome: "bruno" });
    expect((await m.aspetta("errore")).codice).toBe("nome-non-valido");
    m.manda({ tipo: "aggiungi", nome: "Dario" });
    let s = (await m.aspetta("stato")).stato;
    expect(s.posti.map((p) => p.nome)).toEqual(["Alba", "Bruno", "Cleo", "Dario"]);
    expect(s.posti[3]).toMatchObject({ passo: 1, giro: 1, percorso: [] });
    m.manda({ tipo: "aggiungi", nome: "Elia" });
    expect((await m.aspetta("errore")).codice).toBe("troppi");

    // togliendo Bruno, Cleo (occupata da g) scala dal posto 2 al posto 1
    m.manda({ tipo: "togli", posto: 1 });
    s = (await m.aspetta("stato")).stato;
    expect(s.posti.map((p) => p.nome)).toEqual(["Alba", "Cleo", "Dario"]);
    expect(s.posti[1].occupato).toBe(true);
    m.manda({ tipo: "togli", posto: 2 }); await m.aspetta("stato");
    m.manda({ tipo: "togli", posto: 0 });
    expect((await m.aspetta("errore")).codice).toBe("troppo-pochi");

    // g è ancora Cleo, ora al posto 1: togliendo Cleo torna ospite
    m.manda({ tipo: "aggiungi", nome: "Elia" }); await m.aspetta("stato");
    m.manda({ tipo: "togli", posto: 1 });
    expect(await g.aspetta("liberato")).toMatchObject({ posto: 1 });
  });

  it("risponde al ping senza risvegliarsi", async () => {
    const { corpo } = await crea();
    const a = await apriWs(corpo.codice);
    a.ws.send("ping");
    expect(await a.prossimo()).toBe("pong");
  });

  it("il tabellone e l'ospite non possono fare azioni da master", async () => {
    const { corpo } = await crea();
    const t = await apriWs(corpo.codice);
    t.manda({ tipo: "entra", ruolo: "tabellone" }); await t.aspetta("benvenuto");
    for (const msg of [{ tipo: "occupa", posto: 0 }, { tipo: "libera", posto: 0 }, { tipo: "aggiungi", nome: "X" }, { tipo: "togli", posto: 0 }]) {
      t.manda(msg);
      expect((await t.aspetta("errore")).codice).toBe("ruolo");
    }
    const n = await apriWs(corpo.codice);
    n.manda({ tipo: "occupa", posto: 0 });
    expect((await n.aspetta("errore")).codice).toBe("non-entrato");
    n.ws.send("non json");
    expect((await n.aspetta("errore")).codice).toBe("messaggio-non-valido");
  });

  it("le modifiche dell'admin al pianeta non toccano una partita già creata", async () => {
    const { corpo } = await crea();
    await salva(env.DB, { ...PIANETA, nome: "Nome cambiato" });
    const t = await apriWs(corpo.codice);
    t.manda({ tipo: "entra" });
    expect((await t.aspetta("benvenuto")).stato.esplorazione.nome).toBe("Pianeta di prova");
    await salva(env.DB, PIANETA);
  });
});
