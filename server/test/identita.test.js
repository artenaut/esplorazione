// Prove della fase 4: identità dei posti (nickname del club, nuovo nickname con consenso, guest).
import { env } from "cloudflare:workers";
import { runInDurableObject } from "cloudflare:test";
import { describe, it, expect, beforeAll } from "vitest";
import { salva } from "../src/esplorazioni.js";
import { NOMI_GUEST, controllaNickname } from "../src/esplorator.js";
import { INFORMATIVA_VERSIONE } from "../src/costanti.js";
import { PIANETA, chiama, crea, apriWs, nickname } from "./aiuto.js";

beforeAll(async () => { expect((await salva(env.DB, PIANETA)).errore).toBeUndefined(); });

// partita con N posti da scegliere, master collegato e un telefono seduto al posto 0
async function partitaVuota(n = 2) {
  const { corpo } = await crea(Array.from({ length: n }, (_, i) => "x" + i), "lowrenzia", { assegna: false });
  const master = await apriWs(corpo.codice);
  master.manda({ tipo: "entra", codiceMaster: corpo.codiceMaster }); await master.aspetta("benvenuto");
  const tel = await apriWs(corpo.codice);
  tel.manda({ tipo: "entra" }); await tel.aspetta("benvenuto");
  tel.manda({ tipo: "occupa", posto: 0 }); await tel.aspetta("posto");
  await tel.aspetta("stato"); await master.aspetta("stato");
  return { corpo, master, tel };
}
const scegli = (d, posto, scelta) => d.manda({ tipo: "identita", posto, scelta });

describe("Controllo dei nickname", () => {
  it("lunghezza, caratteri, nomi riservati e nomi da guest", () => {
    expect(controllaNickname("  Zia   Pina ")).toEqual({ nickname: "Zia Pina" });
    expect(controllaNickname("Élodie_92")).toEqual({ nickname: "Élodie_92" });
    expect(controllaNickname("ab").errore).toContain("almeno 3");
    expect(controllaNickname("x".repeat(21)).errore).toContain("al massimo 20");
    expect(controllaNickname("<script>").errore).toContain("solo lettere");
    expect(controllaNickname("Admin").errore).toBeTruthy();
    expect(controllaNickname("gallina in incognito").errore).toContain("guest");
  });

  it("i nomi da guest sono un animale più un complemento (senza aggettivi di genere)", () => {
    expect(new Set(NOMI_GUEST).size).toBe(NOMI_GUEST.length);
    const preposizioni = ["in", "col", "con", "dal", "a", "sui", "sul", "senza", "di", "da", "al", "sotto"];
    for (const n of NOMI_GUEST) expect(preposizioni, n).toContain(n.split(" ")[1]);
  });
});

describe("Scelta dell'identità (4.1–4.2)", () => {
  it("guest: nome dal server, «un altro nome» lo cambia, due guest non hanno lo stesso nome", async () => {
    const { master, tel } = await partitaVuota();
    scegli(tel, 0, { tipo: "guest" });
    const s1 = (await tel.aspetta("stato")).stato;
    expect(s1.posti[0].identita).toEqual({ tipo: "guest" });
    expect(NOMI_GUEST).toContain(s1.posti[0].nome);
    scegli(tel, 0, { tipo: "guest" });
    const s2 = (await tel.aspetta("stato")).stato;
    expect(s2.posti[0].nome).not.toBe(s1.posti[0].nome);
    scegli(master, 1, { tipo: "guest" });
    const s3 = (await master.aspetta("stato")).stato;
    expect(s3.posti[1].nome).not.toBe(s3.posti[0].nome);
    // il nome del guest non si può scegliere a mano
    scegli(tel, 0, { tipo: "guest", nome: "Mario Rossi" });
    expect((await tel.aspetta("stato")).stato.posti[0].nome).not.toBe("Mario Rossi");
  });

  it("elenco dei nickname solo dentro la partita; non due volte nella stessa partita", async () => {
    const id = await nickname("Zia Pina");
    expect((await chiama("/api/esplorator")).status).toBe(404);   // non è pubblico
    const { corpo, master, tel } = await partitaVuota();
    tel.manda({ tipo: "nickname" });
    expect((await tel.aspetta("nickname")).elenco).toContainEqual({ id, nickname: "Zia Pina" });
    const ospite = await apriWs(corpo.codice);
    ospite.manda({ tipo: "entra" }); await ospite.aspetta("benvenuto");
    ospite.manda({ tipo: "nickname" });
    expect((await ospite.aspetta("errore")).codice).toBe("ruolo");
    scegli(tel, 0, { tipo: "nickname", id });
    expect((await tel.aspetta("stato")).stato.posti[0]).toMatchObject({ nome: "Zia Pina", identita: { tipo: "nickname", id } });
    scegli(master, 1, { tipo: "nickname", id });
    expect(await master.aspetta("errore")).toMatchObject({ codice: "nickname-in-uso", messaggio: "«Zia Pina» sta già giocando in questa partita." });
    scegli(master, 1, { tipo: "nickname", id: 999999 });
    expect((await master.aspetta("errore")).codice).toBe("nickname-inesistente");
  });

  it("nuovo nickname: servono le due caselle; si salvano data e versione del consenso", async () => {
    const { tel } = await partitaVuota();
    scegli(tel, 0, { tipo: "nuovo", nickname: "Capitana Nemo", consenso: true });
    expect((await tel.aspetta("errore")).codice).toBe("consenso-mancante");
    scegli(tel, 0, { tipo: "nuovo", nickname: "Capitana Nemo", eta14: true, consenso: "sì" });
    expect((await tel.aspetta("errore")).codice).toBe("consenso-mancante");
    scegli(tel, 0, { tipo: "nuovo", nickname: "no", eta14: true, consenso: true });
    expect((await tel.aspetta("errore")).codice).toBe("nickname-non-valido");

    scegli(tel, 0, { tipo: "nuovo", nickname: "Capitana Nemo", eta14: true, consenso: true });
    const s = (await tel.aspetta("stato")).stato;
    expect(s.posti[0]).toMatchObject({ nome: "Capitana Nemo", identita: { tipo: "nickname" } });
    const riga = await env.DB.prepare("SELECT * FROM esplorator WHERE nickname = ?").bind("Capitana Nemo").first();
    expect(riga).toMatchObject({ informativa: INFORMATIVA_VERSIONE, eta14: 1 });
    expect(Date.now() - Date.parse(riga.consenso)).toBeLessThan(60000);
    expect(Object.keys(riga).sort()).toEqual(["consenso", "creato", "eta14", "id", "informativa", "nickname"]);

    // lo stesso nickname non si crea due volte (nemmeno con maiuscole diverse)
    const altra = await partitaVuota();
    scegli(altra.tel, 0, { tipo: "nuovo", nickname: "capitana nemo", eta14: true, consenso: true });
    expect((await altra.tel.aspetta("errore")).messaggio).toContain("esiste già");
  });

  it("solo il telefono seduto o il master; si può cambiare solo prima della prima mossa", async () => {
    const { master, tel } = await partitaVuota();
    scegli(tel, 1, { tipo: "guest" });
    expect((await tel.aspetta("errore")).codice).toBe("ruolo");
    // senza identità non si muove
    master.manda({ tipo: "mossa", posto: 1, stanza: "IA0", versione: 0 });
    expect((await master.aspetta("errore")).codice).toBe("identita-mancante");
    scegli(master, 1, { tipo: "guest" });
    const s = (await master.aspetta("stato")).stato;
    master.manda({ tipo: "mossa", posto: 1, stanza: "IA0", versione: s.posti[1].versione });
    await master.aspetta("mossa");
    scegli(master, 1, { tipo: "guest" });
    expect((await master.aspetta("errore")).codice).toBe("identita-bloccata");
  });

  it("al massimo 8 nuovi nickname per partita", async () => {
    const { tel } = await partitaVuota();
    for (let i = 0; i < 8; i++) {
      scegli(tel, 0, { tipo: "nuovo", nickname: `Serie ${i} prova`, eta14: true, consenso: true });
      await tel.aspetta("stato");
    }
    scegli(tel, 0, { tipo: "nuovo", nickname: "Serie nove prova", eta14: true, consenso: true });
    expect((await tel.aspetta("errore")).codice).toBe("troppi-nickname");
  });

  it("riepilogo: i guest non portano un nickname; stesso gruppo conserva le identità", async () => {
    const id = await nickname("Lupa Grigia");
    const { master, tel } = await partitaVuota();
    scegli(tel, 0, { tipo: "nickname", id }); await master.aspetta("stato");
    scegli(master, 1, { tipo: "guest" });
    const s = (await master.aspetta("stato")).stato;
    master.manda({ tipo: "chiudi", salva: true, poi: "stesso-gruppo" });
    const fine = await master.aspetta("chiusa");
    expect(fine.riepilogo.posti).toEqual([
      expect.objectContaining({ nome: "Lupa Grigia", tipo: "nickname", nickname: id }),
      expect.objectContaining({ nome: s.posti[1].nome, tipo: "guest", nickname: null }),
    ]);
    const m2 = await apriWs(fine.nuova.codice);
    m2.manda({ tipo: "entra", codiceMaster: fine.nuova.codiceMaster });
    const s2 = (await m2.aspetta("benvenuto")).stato;
    expect(s2.posti.map((p) => [p.nome, p.identita?.tipo])).toEqual([["Lupa Grigia", "nickname"], [s.posti[1].nome, "guest"]]);
  });

  it("le partite create prima della fase 4 trattano i nomi scritti a mano come guest", async () => {
    const { corpo } = await crea(["Alba", "Bruno"]);
    const stub = env.PARTITA.get(env.PARTITA.idFromName(corpo.codice));
    await runInDurableObject(stub, async (istanza, st) => {
      const s = await st.storage.get("stato");
      for (const p of s.posti) delete p.identita;
      await st.storage.put("stato", s); istanza.stato = null;
    });
    const m = await apriWs(corpo.codice);
    m.manda({ tipo: "entra", codiceMaster: corpo.codiceMaster });
    const s = (await m.aspetta("benvenuto")).stato;
    expect(s.posti.map((p) => p.identita)).toEqual([{ tipo: "guest" }, { tipo: "guest" }]);
    m.manda({ tipo: "mossa", posto: 0, stanza: "IA0", versione: 0 });
    expect((await m.aspetta("mossa")).stato.registro[0].nome).toBe("Alba");
  });
});
