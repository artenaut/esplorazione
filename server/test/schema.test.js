// Prove del numero di schema e della sola lettura (V.8a, docs/piano.md «Sola lettura»).
// Si simula un ritorno indietro: i dati hanno uno schema più nuovo di quello che il codice conosce.
import { env } from "cloudflare:workers";
import { runInDurableObject } from "cloudflare:test";
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { SCHEMA, MSG_SOLA_LETTURA, MSG_PARTITA_PIU_NUOVA } from "../src/costanti.js";
import { salva, rimuovi, dimenticaSchemaPerProve } from "../src/esplorazioni.js";
import { creaNickname, rinominaNickname } from "../src/esplorator.js";
import { chiudiStagione } from "../src/classifica.js";
import { chiama, crea, apriWs, tavolo, nickname, APP, PIANETA } from "./aiuto.js";

const schemaNelDb = async () => Number((await env.DB.prepare("SELECT valore FROM meta WHERE chiave = 'schema'").first()).valore);
async function impostaSchema(n) {
  await env.DB.prepare("UPDATE meta SET valore = ? WHERE chiave = 'schema'").bind(String(n)).run();
  dimenticaSchemaPerProve();
}

beforeAll(async () => {
  expect((await salva(env.DB, PIANETA)).errore).toBeUndefined();
  await nickname("Alba"); await nickname("Bruno");
});
afterEach(() => impostaSchema(SCHEMA));

describe("Numero di schema", () => {
  it("il database ha il numero di schema del codice", async () => {
    expect(await schemaNelDb()).toBe(SCHEMA);
  });

  it("un numero più vecchio viene portato a quello del codice", async () => {
    await impostaSchema(SCHEMA - 1);
    await chiama("/api/esplorazioni");
    expect(await schemaNelDb()).toBe(SCHEMA);
  });

  it("le nuove partite salvano il numero di schema nel loro stato", async () => {
    const { corpo } = await crea(["Alba", "Bruno"], "lowrenzia", { assegna: false });
    const stub = env.PARTITA.get(env.PARTITA.idFromName(corpo.codice));
    await runInDurableObject(stub, async (_, st) => expect((await st.storage.get("stato")).schema).toBe(SCHEMA));
  });
});

describe("Sola lettura: dati più nuovi del codice", () => {
  it("classifica ed elenco dei pianeti si leggono ancora", async () => {
    expect((await chiama("/api/classifica")).status).toBe(200); // apre la stagione, come in produzione
    await impostaSchema(SCHEMA + 1);
    expect((await chiama("/api/esplorazioni")).status).toBe(200);
    expect((await chiama("/api/classifica")).status).toBe(200);
    expect(await schemaNelDb()).toBe(SCHEMA + 1); // il codice vecchio non abbassa il numero
  });

  it("niente nuove partite, con il messaggio previsto", async () => {
    await impostaSchema(SCHEMA + 1);
    const r = await chiama("/api/partite", { method: "POST", headers: { Origin: APP, "Content-Type": "application/json" }, body: JSON.stringify({ esplorazione: "lowrenzia", posti: 2 }) });
    expect(r.status).toBe(503);
    expect(await r.json()).toEqual({ errore: MSG_SOLA_LETTURA });
  });

  it("le modifiche dell'area admin e i nickname sono rifiutati", async () => {
    await impostaSchema(SCHEMA + 1);
    await expect(salva(env.DB, PIANETA)).rejects.toThrow(MSG_SOLA_LETTURA);
    await expect(rimuovi(env.DB, "lowrenzia")).rejects.toThrow(MSG_SOLA_LETTURA);
    await expect(creaNickname(env.DB, "Nuova Zia")).rejects.toThrow(MSG_SOLA_LETTURA);
    await expect(rinominaNickname(env.DB, 1, "Altro Nome")).rejects.toThrow(MSG_SOLA_LETTURA);
    await expect(chiudiStagione(env.DB)).rejects.toThrow(MSG_SOLA_LETTURA);
  });

  it("in una partita: niente nuovi nickname né salvataggio, ma le mosse e «Annulla partita» sì", async () => {
    const { master, codice } = await tavolo(["Alba", "Bruno"], []);
    await impostaSchema(SCHEMA + 1);
    master.manda({ tipo: "identita", posto: 0, scelta: { tipo: "nuovo", nickname: "Zia Nuova", eta14: true, consenso: true } });
    expect(await master.aspetta("errore")).toMatchObject({ codice: "sola-lettura", messaggio: MSG_SOLA_LETTURA });
    master.manda({ tipo: "mossa", posto: 0, stanza: "IA0", versione: 0 });
    await master.aspetta("mossa");
    master.manda({ tipo: "chiudi", salva: true, poi: "fine" });
    expect(await master.aspetta("errore")).toMatchObject({ codice: "sola-lettura" });
    master.manda({ tipo: "chiudi", salva: false, poi: "stesso-gruppo" });
    expect(await master.aspetta("errore")).toMatchObject({ codice: "sola-lettura" });
    master.manda({ tipo: "chiudi", salva: false, poi: "fine" });
    expect(await master.aspetta("chiusa")).toMatchObject({ modo: "annullata" });
    expect((await chiama(`/api/partite/${codice}`)).status).toBe(404);
  });

  it("una partita scritta da una versione più nuova non si tocca", async () => {
    const { corpo } = await crea(["Alba", "Bruno"], "lowrenzia", { assegna: false });
    const stub = env.PARTITA.get(env.PARTITA.idFromName(corpo.codice));
    await runInDurableObject(stub, async (istanza, st) => {
      const s = await st.storage.get("stato");
      s.schema = SCHEMA + 1;
      await st.storage.put("stato", s); istanza.stato = null;
    });
    const m = await apriWs(corpo.codice);
    m.manda({ tipo: "entra", codiceMaster: corpo.codiceMaster });
    expect(await m.aspetta("errore")).toMatchObject({ codice: "partita-piu-nuova", messaggio: MSG_PARTITA_PIU_NUOVA });
  });
});
