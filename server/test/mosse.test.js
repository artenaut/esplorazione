// Prove dei passi 3.6–3.7: mosse sul server e annullamento dell'ultima mossa.
import { env } from "cloudflare:workers";
import { runInDurableObject } from "cloudflare:test";
import { describe, it, expect, beforeAll } from "vitest";
import { salva } from "../src/esplorazioni.js";
import { PIANETA, tavolo } from "./aiuto.js";

beforeAll(async () => { expect((await salva(env.DB, PIANETA)).errore).toBeUndefined(); });

const statoInterno = (codice) => runInDurableObject(env.PARTITA.get(env.PARTITA.idFromName(codice)), async (_i, s) => s.storage.get("stato"));
const muovi = (disp, stato, posto, stanza = stato.posti[posto].proposte[0].id) =>
  disp.manda({ tipo: "mossa", posto, stanza, versione: stato.posti[posto].versione });

describe("Mosse (3.6)", () => {
  it("il testo arriva a tutti solo con la mossa di ingresso, lo stato non lo contiene mai", async () => {
    const { master, telefoni, stato } = await tavolo();
    const alba = telefoni[0];
    muovi(alba, stato, 0, "IA0");
    const ev = await alba.aspetta("mossa");
    const evMaster = await master.aspetta("mossa");
    expect(ev.stanza).toEqual({ id: "IA0", titolo: "Titolo IA0", via: "a", testo: "SEGRETO IA0" });
    expect(evMaster.stanza.testo).toBe("SEGRETO IA0");
    expect(JSON.stringify(ev.stato)).not.toContain("SEGRETO");

    const p = ev.stato.posti[0];
    expect(p).toMatchObject({ passo: 2, giro: 1, livello: "La forgia", mosse: 1, versione: 1, completato: false });
    expect(p.percorso).toEqual([{ id: "IA0", titolo: "Titolo IA0", via: "a" }]);
    expect(p.proposte).toHaveLength(2);
    expect(p.proposte.every((x) => x.via === "a" && x.id.startsWith("LA"))).toBe(true); // proposte in base alla via scelta
    expect(ev.stato.registro[0]).toEqual({ nome: "Alba", stanza: "Titolo IA0", via: "a", passo: 1, giro: 1, master: false });
    expect(ev.stato.annullabile).toEqual({ posto: 0, nome: "Alba", stanza: "Titolo IA0", autore: 0 });

    // Lo stato richiesto di nuovo non riporta il testo
    alba.manda({ tipo: "stato" });
    expect(JSON.stringify(await alba.aspetta("stato"))).not.toContain("SEGRETO");
  });

  it("chi gioca muove solo per sé; il master muove per tutti e il registro lo dice", async () => {
    const { master, telefoni, stato } = await tavolo();
    muovi(telefoni[0], stato, 1);
    expect(await telefoni[0].aspetta("errore")).toMatchObject({ codice: "ruolo", messaggio: expect.stringContaining("Bruno") });
    muovi(master, stato, 1, "IB0");
    const ev = await master.aspetta("mossa");
    expect(ev.posto).toBe(1);
    expect(ev.stato.registro[0]).toMatchObject({ nome: "Bruno", master: true });
    expect(ev.stato.annullabile.autore).toBe("master");
  });

  it("il tabellone e l'ospite non muovono; stanze non proposte e versioni sbagliate vengono rifiutate", async () => {
    const { codice, master, stato } = await tavolo(["Alba", "Bruno"], []);
    const { apriWs } = await import("./aiuto.js");
    const t = await apriWs(codice);
    t.manda({ tipo: "entra", ruolo: "tabellone" }); await t.aspetta("benvenuto");
    muovi(t, stato, 0);
    expect((await t.aspetta("errore")).codice).toBe("ruolo");
    master.manda({ tipo: "mossa", posto: 0, stanza: "LA0", versione: 0 });
    expect(await master.aspetta("errore")).toMatchObject({ codice: "stanza-non-proposta", stato: expect.any(Object) });
    master.manda({ tipo: "mossa", posto: 0, stanza: "IA0", versione: 5 });
    expect((await master.aspetta("errore")).codice).toBe("versione-superata");
    master.manda({ tipo: "mossa", posto: 9, stanza: "IA0", versione: 0 });
    expect((await master.aspetta("errore")).codice).toBe("posto-inesistente");
  });

  it("mossa contemporanea sullo stesso personaggio: vince la prima, l'altra riceve la situazione aggiornata", async () => {
    const { master, telefoni, stato } = await tavolo();
    muovi(telefoni[0], stato, 0, "IA0");
    muovi(master, stato, 0, "IB0"); // parte dallo stesso stato
    const err = await master.aspetta("errore");
    expect(err).toMatchObject({ codice: "versione-superata", messaggio: "Alba ha già mosso: ecco la situazione aggiornata." });
    expect(err.stato.posti[0].percorso.map((x) => x.id)).toEqual(["IA0"]);
  });

  it("persone diverse possono muovere nello stesso istante", async () => {
    const { master, telefoni, stato } = await tavolo(["Alba", "Bruno"], [0, 1]);
    muovi(telefoni[0], stato, 0, "IA0");
    muovi(telefoni[1], stato, 1, "IB0");
    await master.aspetta("mossa");
    const ultimo = await master.aspetta("mossa");
    expect(ultimo.stato.posti.map((p) => p.percorso.length)).toEqual([1, 1]);
  });

  it("giro completo: ingresso → livello → finale → di nuovo ingresso", async () => {
    const { master, stato: s0 } = await tavolo(["Alba", "Bruno"], []);
    let s = s0;
    for (const atteso of [{ passo: 2, livello: "La forgia" }, { passo: 3, livello: "La vetta" }, { passo: 1, livello: "Ingresso", completato: true, giro: 1 }]) {
      muovi(master, s, 0);
      s = (await master.aspetta("mossa")).stato;
      expect(s.posti[0]).toMatchObject(atteso);
    }
    expect(s.posti[0].percorso).toHaveLength(3);
    muovi(master, s, 0);
    s = (await master.aspetta("mossa")).stato;
    expect(s.posti[0]).toMatchObject({ giro: 2, passo: 2, completato: false });
    expect(s.posti[0].percorso).toHaveLength(1);
  });

  it("«meno mostrate»: i contatori sono condivisi tra esplorator* e le stanze ruotano", async () => {
    const { codice, master, stato: s0 } = await tavolo(["Alba", "Bruno", "Cleo", "Dario"], []);
    let s = s0;
    for (let i = 0; i < 24; i++) {          // 6 giri a testa, sempre per la via A
      const posto = i % 4;
      const scelta = s.posti[posto].proposte.find((x) => x.via === "a") ?? s.posti[posto].proposte[0];
      muovi(master, s, posto, scelta.id);
      s = (await master.aspetta("mossa")).stato;
    }
    const { shown } = await statoInterno(codice);
    const la = ["LA0", "LA1", "LA2"].map((id) => shown[id] ?? 0);
    expect(Math.max(...la) - Math.min(...la)).toBeLessThanOrEqual(1);
    expect(la.reduce((a, b) => a + b)).toBeGreaterThan(6);
  });
});

describe("Annulla (3.7)", () => {
  it("chi ha mosso annulla: posizione, proposte e contatori tornano com'erano", async () => {
    const { codice, master, telefoni, stato } = await tavolo();
    const alba = telefoni[0];
    muovi(alba, stato, 0, "IA0");
    const dopo1 = (await alba.aspetta("mossa")).stato;
    const interno1 = await statoInterno(codice);
    muovi(alba, dopo1, 0);
    await alba.aspetta("mossa");

    alba.manda({ tipo: "annulla" });
    const ev = await alba.aspetta("annullata");
    expect(ev.posto).toBe(0);
    const p = ev.stato.posti[0];
    expect(p.percorso).toEqual(dopo1.posti[0].percorso);
    expect(p.proposte).toEqual(dopo1.posti[0].proposte);
    expect(p.versione).toBe(dopo1.posti[0].versione + 2);
    expect(ev.stato.registro).toEqual(dopo1.registro);
    expect(ev.stato.annullabile).toBeNull();
    const interno2 = await statoInterno(codice);
    expect(interno2.shown).toEqual(interno1.shown);
    expect(interno2.posti[0].seen).toEqual(interno1.posti[0].seen);
    expect(interno2.posti[0].gettoneHash).toBe(interno1.posti[0].gettoneHash);

    // si annulla solo l'ultima mossa: non si torna più indietro
    alba.manda({ tipo: "annulla" });
    expect((await alba.aspetta("errore")).codice).toBe("niente-da-annullare");
    await master.aspetta("annullata");
  });

  it("solo chi ha fatto la mossa o il master; se ha mosso qualcun altro non si può più", async () => {
    const { master, telefoni, stato } = await tavolo(["Alba", "Bruno"], [0, 1]);
    const [alba, bruno] = telefoni;
    muovi(alba, stato, 0, "IA0");
    const s1 = (await bruno.aspetta("mossa")).stato;
    bruno.manda({ tipo: "annulla" });
    expect((await bruno.aspetta("errore")).codice).toBe("ruolo");

    muovi(bruno, s1, 1, "IB0");
    await alba.aspetta("mossa");
    alba.manda({ tipo: "annulla" });         // ha mosso Bruno dopo di lei
    expect((await alba.aspetta("errore")).codice).toBe("ruolo");

    master.manda({ tipo: "annulla" });       // il master annulla l'ultima, quella di Bruno
    const ev = await master.aspetta("annullata");
    expect(ev.posto).toBe(1);
    expect(ev.stato.posti.map((p) => p.percorso.length)).toEqual([1, 0]);
  });

  it("il master annulla una mossa fatta per qualcun altro; dopo una rimozione non si annulla", async () => {
    const { master, stato } = await tavolo(["Alba", "Bruno", "Cleo"], []);
    muovi(master, stato, 2);
    await master.aspetta("mossa");
    master.manda({ tipo: "annulla" });
    const dopoAnnulla = (await master.aspetta("annullata")).stato;
    expect(dopoAnnulla.posti[2].mosse).toBe(0);

    // la versione del posto è cambiata: una mossa partita dallo stato vecchio viene rifiutata
    muovi(master, stato, 2);
    expect((await master.aspetta("errore")).codice).toBe("versione-superata");
    muovi(master, dopoAnnulla, 2);
    const s = (await master.aspetta("mossa")).stato;
    expect(s.annullabile).not.toBeNull();
    master.manda({ tipo: "togli", posto: 0 });
    expect((await master.aspetta("stato")).stato.annullabile).toBeNull();
  });
});
