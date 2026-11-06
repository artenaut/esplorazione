// Prove dei passi 3.8–3.9: chiudi / annulla partita, stesso gruppo, scadenza automatica.
import { env } from "cloudflare:workers";
import { runInDurableObject, runDurableObjectAlarm } from "cloudflare:test";
import { describe, it, expect, beforeAll } from "vitest";
import { salva } from "../src/esplorazioni.js";
import { SENZA_ATTIVITA, DURATA_MASSIMA } from "../src/partita.js";
import { PIANETA, tavolo, apriWs } from "./aiuto.js";

beforeAll(async () => { expect((await salva(env.DB, PIANETA)).errore).toBeUndefined(); });

const stub = (codice) => env.PARTITA.get(env.PARTITA.idFromName(codice));
const interno = (codice) => runInDurableObject(stub(codice), async (_i, s) => ({ stato: await s.storage.get("stato"), allarme: await s.storage.getAlarm() }));
const muovi = (d, st, posto, stanza = st.posti[posto].proposte[0].id) => d.manda({ tipo: "mossa", posto, stanza, versione: st.posti[posto].versione });

describe("Chiudi e annulla partita (3.8)", () => {
  it("solo il master, con dati validi", async () => {
    const { master, telefoni } = await tavolo();
    telefoni[0].manda({ tipo: "chiudi", salva: true, poi: "fine" });
    expect((await telefoni[0].aspetta("errore")).codice).toBe("ruolo");
    master.manda({ tipo: "chiudi", salva: "sì", poi: "fine" });
    expect((await master.aspetta("errore")).codice).toBe("messaggio-non-valido");
    master.manda({ tipo: "chiudi", salva: true, poi: "dopo" });
    expect((await master.aspetta("errore")).codice).toBe("messaggio-non-valido");
  });

  it("Chiudi partita: riepilogo per la classifica a tutti, poi tutti i dati eliminati", async () => {
    const { codice, master, telefoni, stato } = await tavolo(["Alba", "Bruno"], [0]);
    let s = stato;
    for (let i = 0; i < 4; i++) {           // Alba fa un giro completo e torna all'ingresso
      muovi(master, s, 0, s.posti[0].proposte.find((x) => x.via === "a")?.id);
      s = (await master.aspetta("mossa")).stato;
    }
    muovi(master, s, 1, "IB0"); s = (await master.aspetta("mossa")).stato;

    master.manda({ tipo: "chiudi", salva: true, poi: "fine" });
    const fine = await telefoni[0].aspetta("chiusa");
    expect(fine).toMatchObject({ modo: "chiusa", poi: "fine", nuova: null });
    expect(fine.riepilogo).toEqual({
      esplorazione: "lowrenzia",
      posti: [
        { nome: "Alba", tipo: "nickname", nickname: expect.any(Number), cicli: 1, stanze: 4, perVia: { a: 4 } },
        { nome: "Bruno", tipo: "nickname", nickname: expect.any(Number), cicli: 0, stanze: 1, perVia: { b: 1 } },
      ],
    });
    expect((await master.aspetta("chiusa")).modo).toBe("chiusa");

    const dopo = await interno(codice);
    expect(dopo).toEqual({ stato: undefined, allarme: null });
    const tardi = await apriWs(codice);
    expect(await tardi.prossimo()).toMatchObject({ codice: "partita-inesistente" });
  });

  it("l'annullamento di una mossa riporta indietro anche i dati per la classifica", async () => {
    const { master, stato } = await tavolo();
    muovi(master, stato, 0, "IA0"); const s1 = (await master.aspetta("mossa")).stato;
    muovi(master, s1, 0); await master.aspetta("mossa");
    master.manda({ tipo: "annulla" }); await master.aspetta("annullata");
    master.manda({ tipo: "chiudi", salva: true, poi: "fine" });
    expect((await master.aspetta("chiusa")).riepilogo.posti[0]).toMatchObject({ nome: "Alba", cicli: 0, stanze: 1, perVia: { a: 1 } });
  });

  it("Annulla partita: nessun riepilogo, dati eliminati", async () => {
    const { codice, master, stato } = await tavolo();
    muovi(master, stato, 0); await master.aspetta("mossa");
    master.manda({ tipo: "chiudi", salva: false, poi: "fine" });
    const fine = await master.aspetta("chiusa");
    expect(fine).toMatchObject({ modo: "annullata", nuova: null });
    expect(fine.riepilogo).toBeUndefined();
    expect((await interno(codice)).stato).toBeUndefined();
  });

  it("stesso gruppo: nuova partita, master e telefoni restano al loro posto", async () => {
    const { codice, master, telefoni, stato } = await tavolo(["Alba", "Bruno", "Cleo"], [0, 2]);
    muovi(master, stato, 1); await master.aspetta("mossa");
    master.manda({ tipo: "chiudi", salva: false, poi: "stesso-gruppo" });
    const m = await master.aspetta("chiusa");
    const alba = await telefoni[0].aspetta("chiusa");
    const cleo = await telefoni[2].aspetta("chiusa");
    expect(m.nuova.codice).toMatch(/^LWR-\d{3}$/);
    expect(m.nuova.codice).not.toBe(codice);
    expect(m.nuova.codiceMaster).toBeTruthy();
    expect(alba.nuova).toMatchObject({ codice: m.nuova.codice, posto: 0, gettone: expect.any(String) });
    expect(alba.nuova.codiceMaster).toBeUndefined();
    expect(cleo.nuova.posto).toBe(2);

    // nella nuova partita: stessi nomi, tutto da capo, posti 0 e 2 occupati, posto 1 libero
    const m2 = await apriWs(m.nuova.codice);
    m2.manda({ tipo: "entra", codiceMaster: m.nuova.codiceMaster });
    const s2 = (await m2.aspetta("benvenuto")).stato;
    expect(s2.posti.map((p) => [p.nome, p.occupato, p.mosse])).toEqual([["Alba", true, 0], ["Bruno", false, 0], ["Cleo", true, 0]]);
    const a2 = await apriWs(m.nuova.codice);
    a2.manda({ tipo: "entra", gettone: alba.nuova.gettone });
    expect(await a2.aspetta("benvenuto")).toMatchObject({ ruolo: "esplorator", posto: 0 });
    // la vecchia partita non c'è più
    expect((await interno(codice)).stato).toBeUndefined();
  });
});

describe("Scadenza automatica (3.9)", () => {
  it("alla creazione c'è l'allarme a 6 ore; le mosse lo spostano, ma mai oltre 24 ore", async () => {
    const { codice, master, stato } = await tavolo(["Alba", "Bruno"], []);
    const i0 = await interno(codice);
    expect(i0.allarme).toBe(i0.stato.ultimaAttivita + SENZA_ATTIVITA);
    expect(stato.scade).toBe(i0.allarme);

    // simulo una partita creata 20 ore fa con l'ultima attività 1 ora fa
    await runInDurableObject(stub(codice), async (istanza, s) => {
      const st = await s.storage.get("stato");
      st.creata -= 20 * 3600e3; st.ultimaAttivita -= 3600e3;
      await s.storage.put("stato", st); istanza.stato = null;
    });
    muovi(master, stato, 0); await master.aspetta("mossa");
    const i1 = await interno(codice);
    expect(i1.allarme).toBe(i1.stato.creata + DURATA_MASSIMA); // 24 ore dalla creazione, non 6 dall'ultima mossa
  });

  it("collegarsi o restare in standby non tiene viva la partita", async () => {
    const { codice, master } = await tavolo(["Alba", "Bruno"], []);
    const prima = (await interno(codice)).allarme;
    master.manda({ tipo: "stato" }); await master.aspetta("stato");
    const altro = await apriWs(codice);
    altro.manda({ tipo: "entra", ruolo: "tabellone" }); await altro.aspetta("benvenuto");
    expect((await interno(codice)).allarme).toBe(prima);
  });

  it("alla scadenza avvisa tutti, elimina tutto e libera il codice", async () => {
    const { codice, master } = await tavolo(["Alba", "Bruno"], []);
    await runInDurableObject(stub(codice), async (istanza, s) => {
      const st = await s.storage.get("stato");
      st.ultimaAttivita -= SENZA_ATTIVITA + 1000;
      await s.storage.put("stato", st); istanza.stato = null;
    });
    expect(await runDurableObjectAlarm(stub(codice))).toBe(true);
    expect(await master.aspetta("chiusa")).toMatchObject({ modo: "scaduta", nuova: null });
    expect(await interno(codice)).toEqual({ stato: undefined, allarme: null });
  });

  it("un allarme in anticipo (ci sono state mosse nel frattempo) si risposta all'ora giusta", async () => {
    const { codice } = await tavolo(["Alba", "Bruno"], []);
    await runDurableObjectAlarm(stub(codice)); // scatta subito: la partita è ancora attiva
    const i = await interno(codice);
    expect(i.stato).toBeTruthy();
    expect(i.allarme).toBe(i.stato.ultimaAttivita + SENZA_ATTIVITA);
  });
});
