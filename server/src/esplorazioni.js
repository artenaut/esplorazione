// Esplorazioni (pianeti) salvate in D1.
// Il file completo, con i testi delle stanze, sta solo qui: l'elenco pubblico non li contiene mai.

import { validateModule } from "../../motore.js";

// Lo schema si crea da solo alla prima richiesta di ogni istanza del Worker
// (il database viene creato da wrangler alla prima pubblicazione, senza migrazioni a mano).
let schemaPronto = null;
export function preparaSchema(db) {
  schemaPronto ??= db
    .batch([
      db.prepare(`CREATE TABLE IF NOT EXISTS esplorazioni (
        id         TEXT PRIMARY KEY,
        nome       TEXT NOT NULL,
        dati       TEXT NOT NULL,          -- file JSON completo (formato 2), testi compresi
        versione   INTEGER NOT NULL DEFAULT 1,
        caricata   TEXT NOT NULL,          -- data e ora del primo caricamento (UTC)
        aggiornata TEXT NOT NULL           -- data e ora dell'ultima modifica (UTC)
      )`),
      // nickname del club (fase 4): solo il nickname e la prova del consenso
      db.prepare(`CREATE TABLE IF NOT EXISTS esplorator (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        nickname    TEXT NOT NULL UNIQUE COLLATE NOCASE,
        creato      TEXT NOT NULL,         -- data e ora di creazione (UTC)
        consenso    TEXT NOT NULL,         -- data e ora del consenso alla classifica pubblica (UTC)
        informativa TEXT NOT NULL,         -- versione dell'informativa accettata
        eta14       INTEGER NOT NULL       -- 1: ha confermato di avere almeno 14 anni
      )`),
    ])
    .catch((e) => {
      schemaPronto = null;
      throw e;
    });
  return schemaPronto;
}

// Vista pubblica: quello che serve per scegliere il pianeta e leggerne le regole.
// Niente stanze, quindi niente titoli né testi.
export function vistaPubblica(m) {
  const v = {
    id: m.id,
    nome: m.nome,
    descrizione: m.descrizione ?? "",
    vie: m.vie.map(({ id, nome, breve, colore }) => ({ id, nome, breve: breve ?? nome, colore })),
  };
  for (const k of ["regole", "regoleLink", "regoleImmagine"]) if (m[k]) v[k] = m[k];
  return v;
}

const contaStanze = (m) =>
  [m.ingresso, ...Object.values(m.livelli ?? {}), m.finale].reduce((n, l) => n + l.stanze.length, 0);

export async function elencoPubblico(db) {
  await preparaSchema(db);
  const { results } = await db.prepare("SELECT dati FROM esplorazioni ORDER BY caricata, id").all();
  return results.map((r) => vistaPubblica(JSON.parse(r.dati)));
}

export async function elencoAdmin(db) {
  await preparaSchema(db);
  const { results } = await db
    .prepare("SELECT id, nome, dati, versione, caricata, aggiornata FROM esplorazioni ORDER BY caricata, id")
    .all();
  return results.map((r) => {
    const m = JSON.parse(r.dati);
    return {
      id: r.id, nome: r.nome, descrizione: m.descrizione ?? "", versione: r.versione,
      caricata: r.caricata, aggiornata: r.aggiornata,
      livelli: Object.keys(m.livelli ?? {}).length + 2, stanze: contaStanze(m),
    };
  });
}

export async function leggi(db, id) {
  await preparaSchema(db);
  const r = await db.prepare("SELECT dati FROM esplorazioni WHERE id = ?").bind(id).first();
  return r ? JSON.parse(r.dati) : null;
}

// Carica o sostituisce un'esplorazione. Restituisce { errore } oppure { esplorazione, nuova }.
export async function salva(db, m) {
  const errore = validateModule(m);
  if (errore) return { errore };
  await preparaSchema(db);
  const ora = new Date().toISOString();
  const r = await db
    .prepare(
      `INSERT INTO esplorazioni (id, nome, dati, versione, caricata, aggiornata) VALUES (?1, ?2, ?3, 1, ?4, ?4)
       ON CONFLICT(id) DO UPDATE SET nome = ?2, dati = ?3, versione = versione + 1, aggiornata = ?4
       RETURNING versione`,
    )
    .bind(m.id, m.nome, JSON.stringify(m), ora)
    .first();
  return { esplorazione: m.id, versione: r.versione, nuova: r.versione === 1 };
}

export async function rimuovi(db, id) {
  await preparaSchema(db);
  const r = await db.prepare("DELETE FROM esplorazioni WHERE id = ?").bind(id).run();
  return r.meta.changes > 0;
}
