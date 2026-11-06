// Prove della fase 5: salvataggio alla chiusura, calcolo con spareggi, stagioni, archivio, correzioni.
import { env } from "cloudflare:workers";
import { describe, it, expect, beforeAll } from "vitest";
import { salva } from "../src/esplorazioni.js";
import { rimuoviNickname } from "../src/esplorator.js";
import { ordina, salvaPartita, chiudiStagione, rinominaStagione, partiteStagione, modificaRisultato, eliminaRisultato, eliminaPartita, RIMOSS } from "../src/classifica.js";
import { PIANETA, chiama, crea, apriWs, nickname } from "./aiuto.js";

beforeAll(async () => { expect((await salva(env.DB, PIANETA)).errore).toBeUndefined(); });

const leggi = async (q = "") => (await chiama("/api/classifica" + q)).json();
const rieplogo = (posti, esplorazione = "lowrenzia") => ({ esplorazione, posti });
const posto = async (nome, cicli, stanze, perVia = {}) => ({ nome, tipo: "nickname", nickname: await nickname(nome), cicli, stanze, perVia });
const ALTRO = { ...PIANETA, id: "altro", nome: "Altro pianeta" };

describe("Calcolo delle posizioni (5.2)", () => {
  it("spareggi in cascata e pari merito «1-2-2-4», ordine alfabetico tra pari", () => {
    const r = ordina([
      { nickname: "Zeta", a: 3, b: 1 }, { nickname: "beta", a: 5, b: 0 }, { nickname: "Alfa", a: 3, b: 1 },
      { nickname: "Gamma", a: 3, b: 2 }, { nickname: "Delta", a: 1, b: 9 },
    ], ["a", "b"]);
    expect(r.map((x) => [x.posizione, x.nickname])).toEqual([[1, "beta"], [2, "Gamma"], [3, "Alfa"], [3, "Zeta"], [5, "Delta"]]);
  });
});

describe("Salvataggio alla chiusura e classifica pubblica (5.1–5.4)", () => {
  it("«Chiudi partita» salva i nickname, non i guest; «Annulla partita» non salva nulla", async () => {
    await chiudiStagione(env.DB);
    const { corpo } = await crea(["Rossa", "Blu", "x"], "lowrenzia", { assegna: false });
    const m = await apriWs(corpo.codice);
    m.manda({ tipo: "entra", codiceMaster: corpo.codiceMaster }); await m.aspetta("benvenuto");
    for (const [i, nome] of [[0, "Rossa"], [1, "Blu"]]) { m.manda({ tipo: "identita", posto: i, scelta: { tipo: "nickname", id: await nickname(nome) } }); await m.aspetta("stato"); }
    m.manda({ tipo: "identita", posto: 2, scelta: { tipo: "guest" } });
    let s = (await m.aspetta("stato")).stato;
    const guest = s.posti[2].nome;
    for (let i = 0; i < 3; i++) {           // Rossa: ingresso, livello, finale = 1 ciclo, 3 stanze
      const scelta = s.posti[0].proposte.find((x) => x.via === "a");
      m.manda({ tipo: "mossa", posto: 0, stanza: scelta.id, versione: s.posti[0].versione });
      s = (await m.aspetta("mossa")).stato;
    }
    m.manda({ tipo: "mossa", posto: 2, stanza: "IB0", versione: s.posti[2].versione }); s = (await m.aspetta("mossa")).stato;
    m.manda({ tipo: "chiudi", salva: true, poi: "fine" }); await m.aspetta("chiusa");

    const c = await leggi();
    expect(c.generale).toEqual([
      { nickname: "Rossa", rimoss: false, pianeti: 1, esplorazioni: 1, stanze: 3, posizione: 1 },
      { nickname: "Blu", rimoss: false, pianeti: 0, esplorazioni: 0, stanze: 0, posizione: 2 },   // entra anche a zero
    ]);
    expect(JSON.stringify(c)).not.toContain(guest);
    expect(c.pianeti).toHaveLength(1);
    expect(c.pianeti[0]).toMatchObject({ id: "lowrenzia", nome: "Pianeta di prova", vie: [{ id: "a" }, { id: "b" }] });
    expect(c.pianeti[0].righe[0]).toMatchObject({ nickname: "Rossa", esplorazioni: 1, stanze: 3, perVia: { a: 3 }, posizione: 1 });
    expect(JSON.stringify(c)).not.toContain("SEGRETO");

    // Annulla partita: nulla cambia
    const due = await crea(["Rossa", "Blu"]);
    const m2 = await apriWs(due.corpo.codice);
    m2.manda({ tipo: "entra", codiceMaster: due.corpo.codiceMaster }); const s2 = (await m2.aspetta("benvenuto")).stato;
    m2.manda({ tipo: "mossa", posto: 1, stanza: "IA0", versione: s2.posti[1].versione }); await m2.aspetta("mossa");
    m2.manda({ tipo: "chiudi", salva: false, poi: "fine" }); await m2.aspetta("chiusa");
    expect((await leggi()).generale).toEqual(c.generale);
  });

  it("generale: pianeti completati contati una volta per pianeta; classifiche dei pianeti separate", async () => {
    await chiudiStagione(env.DB);
    await salvaPartita(env.DB, rieplogo([await posto("Rossa", 2, 8, { a: 8 }), await posto("Blu", 1, 5, { a: 3, b: 2 })]), PIANETA);
    await salvaPartita(env.DB, rieplogo([await posto("Rossa", 1, 4, { a: 4 })]), PIANETA);
    await salvaPartita(env.DB, rieplogo([await posto("Blu", 1, 3, { b: 3 })], "altro"), ALTRO);
    const c = await leggi();
    expect(c.generale.map((r) => [r.posizione, r.nickname, r.pianeti, r.esplorazioni, r.stanze])).toEqual([
      [1, "Blu", 2, 2, 8],      // 2 pianeti completati batte 3 esplorazioni su un solo pianeta
      [2, "Rossa", 1, 3, 12],
    ]);
    expect(c.pianeti.map((p) => p.nome)).toEqual(["Altro pianeta", "Pianeta di prova"]);
    const low = c.pianeti.find((p) => p.id === "lowrenzia");
    expect(low.righe.map((r) => [r.posizione, r.nickname, r.esplorazioni, r.stanze, r.perVia])).toEqual([
      [1, "Rossa", 3, 12, { a: 12 }], [2, "Blu", 1, 5, { a: 3, b: 2 }],
    ]);
    expect(c.pianeti.find((p) => p.id === "altro").righe.map((r) => r.nickname)).toEqual(["Blu"]);
  });
});

describe("Stagioni e archivio (5.3)", () => {
  it("chiudere la stagione ne apre una nuova vuota; l'archivio resta consultabile; il nome si cambia", async () => {
    await chiudiStagione(env.DB);
    await salvaPartita(env.DB, rieplogo([await posto("Rossa", 1, 4, { a: 4 })]), PIANETA);
    const prima = await leggi();
    const { chiusa, nuova } = await chiudiStagione(env.DB);
    expect(chiusa.id).toBe(prima.stagione.id);
    expect(nuova.nome).toMatch(/^Stagione \d+$/);
    const ora = await leggi();
    expect(ora.stagione.id).toBe(nuova.id);
    expect(ora.generale).toEqual([]);
    const archivio = await leggi(`?stagione=${chiusa.id}`);
    expect(archivio.stagione.chiusa).toBeTruthy();
    expect(archivio.generale.map((r) => r.nickname)).toEqual(["Rossa"]);
    expect(ora.stagioni.map((s) => s.id)).toContain(chiusa.id);
    expect((await rinominaStagione(env.DB, chiusa.id, "  Inverno   2026 ")).nome).toBe("Inverno 2026");
    expect((await rinominaStagione(env.DB, chiusa.id, "")).errore).toBeTruthy();
    expect((await chiama("/api/classifica?stagione=999999")).status).toBe(404);
  });

  it("nickname cancellato: sparisce dalla stagione in corso, nell'archivio diventa «Esplorator* rimoss*»", async () => {
    await chiudiStagione(env.DB);
    const verde = await posto("Verde", 1, 6, { a: 6 });
    await salvaPartita(env.DB, rieplogo([verde, await posto("Rossa", 0, 2, { b: 2 })]), PIANETA);
    const { chiusa } = await chiudiStagione(env.DB);
    await salvaPartita(env.DB, rieplogo([{ ...verde, cicli: 0, stanze: 1, perVia: { a: 1 } }]), PIANETA);
    expect((await leggi()).generale.map((r) => r.nickname)).toEqual(["Verde"]);

    expect(await rimuoviNickname(env.DB, verde.nickname)).toBe(true);
    expect((await leggi()).generale).toEqual([]);
    const archivio = await leggi(`?stagione=${chiusa.id}`);
    expect(archivio.generale.map((r) => [r.posizione, r.nickname, r.rimoss])).toEqual([[1, RIMOSS, true], [2, "Rossa", false]]);
    // e se un nickname viene cancellato durante una partita, alla chiusura non si salva
    expect(await salvaPartita(env.DB, rieplogo([{ ...verde }]), PIANETA)).toBeNull();
  });
});

describe("Correzioni dell'admin (5.5)", () => {
  it("modificare ed eliminare un risultato o una partita", async () => {
    await chiudiStagione(env.DB);
    const { partita } = await salvaPartita(env.DB, rieplogo([await posto("Rossa", 1, 4, { a: 4 }), await posto("Blu", 0, 1, { b: 1 })]), PIANETA);
    const s = (await leggi()).stagione;
    const [p] = await partiteStagione(env.DB, s.id);
    expect(p).toMatchObject({ id: partita, pianeta: "Pianeta di prova", risultati: [{ nickname: "Rossa", cicli: 1 }, { nickname: "Blu", cicli: 0 }] });

    expect((await modificaRisultato(env.DB, p.risultati[1].id, { cicli: -1, stanze: 1, perVia: {} })).errore).toBeTruthy();
    expect(await modificaRisultato(env.DB, p.risultati[1].id, { cicli: 2, stanze: 9, perVia: { b: 9 } })).toEqual({ ok: true });
    expect((await leggi()).generale[0]).toMatchObject({ nickname: "Blu", esplorazioni: 2, stanze: 9 });

    expect(await eliminaRisultato(env.DB, p.risultati[1].id)).toBe(true);
    expect((await leggi()).generale.map((r) => r.nickname)).toEqual(["Rossa"]);
    expect(await eliminaPartita(env.DB, partita)).toBe(true);
    expect((await leggi()).generale).toEqual([]);
    expect(await partiteStagione(env.DB, s.id)).toEqual([]);
  });

  it("le API admin della classifica sono protette", async () => {
    for (const [metodo, percorso] of [["GET", "/admin/api/stagioni"], ["POST", "/admin/api/stagioni/chiudi"], ["DELETE", "/admin/api/partite/1"], ["PATCH", "/admin/api/risultati/1"]]) {
      expect((await chiama(percorso, { method: metodo, headers: { "X-Richiesta": "admin" } })).status).toBe(403);
    }
  });
});
