// Classifica del club (fase 5): stagioni, partite concluse, risultati, calcolo.
// Regole: docs/roadmap-classifica.md §1–8. Si salvano solo i nickname; i guest non lasciano traccia.

import { preparaSchema, permettiScrittura, inSolaLettura } from "./esplorazioni.js";

export const RIMOSS = "Esplorator* rimoss*";

// Tabelle della classifica. Si creano alla prima richiesta, come le altre.
let schemaClassifica = null;
export function preparaClassifica(db) {
  schemaClassifica ??= preparaSchema(db).then(() => db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS stagioni (
      id      INTEGER PRIMARY KEY AUTOINCREMENT,
      nome    TEXT NOT NULL,
      aperta  TEXT NOT NULL,            -- data e ora di apertura (UTC)
      chiusa  TEXT                      -- data e ora di chiusura (UTC); NULL = stagione in corso
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS partite (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      stagione     INTEGER NOT NULL,
      esplorazione TEXT NOT NULL,       -- id del pianeta
      nome         TEXT NOT NULL,       -- nome del pianeta al momento della partita
      vie          TEXT NOT NULL,       -- vie del pianeta (JSON), per le colonne della sua classifica
      chiusa       TEXT NOT NULL        -- data e ora di chiusura (UTC)
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS risultati (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      partita    INTEGER NOT NULL,
      esplorator INTEGER NOT NULL,      -- id del nickname (resta anche se il nickname viene cancellato)
      cicli      INTEGER NOT NULL,      -- esplorazioni portate a termine
      stanze     INTEGER NOT NULL,      -- stanze aperte
      per_via    TEXT NOT NULL          -- stanze aperte per via (JSON)
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS risultati_partita ON risultati (partita)"),
    db.prepare("CREATE INDEX IF NOT EXISTS partite_stagione ON partite (stagione)"),
  ])).catch((e) => { schemaClassifica = null; throw e; });
  return schemaClassifica;
}

// La stagione in corso; se non ce n'è una, si apre «Stagione N».
export async function stagioneInCorso(db) {
  await preparaClassifica(db);
  const s = await db.prepare("SELECT * FROM stagioni WHERE chiusa IS NULL ORDER BY id DESC LIMIT 1").first();
  if (s) return s;
  if (await inSolaLettura(db)) return null; // in sola lettura non si apre una nuova stagione
  const n = (await db.prepare("SELECT COUNT(*) AS n FROM stagioni").first()).n + 1;
  return db.prepare("INSERT INTO stagioni (nome, aperta) VALUES (?, ?) RETURNING *").bind(`Stagione ${n}`, new Date().toISOString()).first();
}

export async function elencoStagioni(db) {
  await stagioneInCorso(db);
  const { results } = await db.prepare("SELECT id, nome, aperta, chiusa FROM stagioni ORDER BY id DESC").all();
  return results;
}

// ---------- salvataggio alla chiusura (5.1) ----------

// riepilogo: quello calcolato dalla partita (riepilogoPartita). esplorazione: il file del pianeta della partita.
// Salva solo i posti con un nickname ancora esistente. Restituisce { partita, risultati } o null se non c'è nulla da salvare.
export async function salvaPartita(db, riepilogo, esplorazione) {
  await permettiScrittura(db);
  const s = await stagioneInCorso(db);
  const posti = riepilogo.posti.filter((p) => p.tipo === "nickname" && Number.isInteger(p.nickname));
  if (!posti.length) return null;
  const ids = posti.map((p) => p.nickname);
  const { results: esistenti } = await db.prepare(`SELECT id FROM esplorator WHERE id IN (${ids.map(() => "?").join(",")})`).bind(...ids).all();
  const validi = new Set(esistenti.map((r) => r.id));
  const daSalvare = posti.filter((p) => validi.has(p.nickname));
  if (!daSalvare.length) return null;
  const vie = esplorazione.vie.map(({ id, nome, breve, colore }) => ({ id, nome, breve: breve ?? nome, colore }));
  const p = await db
    .prepare("INSERT INTO partite (stagione, esplorazione, nome, vie, chiusa) VALUES (?, ?, ?, ?, ?) RETURNING id")
    .bind(s.id, esplorazione.id, esplorazione.nome, JSON.stringify(vie), new Date().toISOString())
    .first();
  await db.batch(daSalvare.map((r) => db
    .prepare("INSERT INTO risultati (partita, esplorator, cicli, stanze, per_via) VALUES (?, ?, ?, ?, ?)")
    .bind(p.id, r.nickname, r.cicli, r.stanze, JSON.stringify(r.perVia ?? {}))));
  return { partita: p.id, risultati: daSalvare.length };
}

// ---------- calcolo (5.2) ----------

// Posizioni con pari merito «1-2-2-4»: chi è pari su tutti i criteri ha la stessa posizione,
// la successiva salta. A pari merito l'ordine di visualizzazione è alfabetico.
export function ordina(righe, criteri) {
  const cmp = (a, b) => {
    for (const k of criteri) if (b[k] !== a[k]) return b[k] - a[k];
    return 0;
  };
  const ordinate = [...righe].sort((a, b) => cmp(a, b) || a.nickname.localeCompare(b.nickname, "it", { sensitivity: "base" }));
  ordinate.forEach((r, i) => { r.posizione = i > 0 && cmp(ordinate[i - 1], r) === 0 ? ordinate[i - 1].posizione : i + 1; });
  return ordinate;
}

// Classifica di una stagione: { stagione, stagioni, generale, pianeti }. Solo totali per nickname.
export async function classifica(db, stagioneId = null) {
  const stagioni = await elencoStagioni(db);
  const stagione = stagioneId ? stagioni.find((s) => s.id === stagioneId) : stagioni.find((s) => !s.chiusa);
  if (!stagione) return null;

  const { results } = await db.prepare(
    `SELECT r.esplorator, e.nickname, p.esplorazione, p.nome AS pianeta, p.vie, p.id AS partita, r.cicli, r.stanze, r.per_via
     FROM risultati r JOIN partite p ON p.id = r.partita LEFT JOIN esplorator e ON e.id = r.esplorator
     WHERE p.stagione = ? ORDER BY p.id`,
  ).bind(stagione.id).all();

  const pianeti = new Map();   // id → { id, nome, vie, giocatori: Map }
  const generale = new Map();  // esplorator → riga
  for (const r of results) {
    const nickname = r.nickname ?? RIMOSS;
    let pi = pianeti.get(r.esplorazione);
    if (!pi) pianeti.set(r.esplorazione, (pi = { id: r.esplorazione, nome: r.pianeta, vie: JSON.parse(r.vie), giocatori: new Map() }));
    else { pi.nome = r.pianeta; pi.vie = JSON.parse(r.vie); } // nome e vie della partita più recente
    let g = pi.giocatori.get(r.esplorator);
    if (!g) pi.giocatori.set(r.esplorator, (g = { nickname, rimoss: !r.nickname, esplorazioni: 0, stanze: 0, perVia: {} }));
    g.esplorazioni += r.cicli;
    g.stanze += r.stanze;
    for (const [via, n] of Object.entries(JSON.parse(r.per_via))) g.perVia[via] = (g.perVia[via] ?? 0) + n;

    let t = generale.get(r.esplorator);
    if (!t) generale.set(r.esplorator, (t = { nickname, rimoss: !r.nickname, pianeti: new Set(), esplorazioni: 0, stanze: 0 }));
    if (r.cicli > 0) t.pianeti.add(r.esplorazione);
    t.esplorazioni += r.cicli;
    t.stanze += r.stanze;
  }

  return {
    stagione,
    stagioni,
    generale: ordina([...generale.values()].map((t) => ({ nickname: t.nickname, rimoss: t.rimoss, pianeti: t.pianeti.size, esplorazioni: t.esplorazioni, stanze: t.stanze })),
      ["pianeti", "esplorazioni", "stanze"]),
    pianeti: [...pianeti.values()]
      .sort((a, b) => a.nome.localeCompare(b.nome, "it"))
      .map((pi) => ({ id: pi.id, nome: pi.nome, vie: pi.vie, righe: ordina([...pi.giocatori.values()], ["esplorazioni", "stanze"]) })),
  };
}

// ---------- area admin (5.3, 5.5) ----------

export async function rinominaStagione(db, id, nome) {
  await permettiScrittura(db);
  const n = typeof nome === "string" ? nome.trim().replace(/\s+/g, " ") : "";
  if (n.length < 1 || n.length > 40) return { errore: "Il nome della stagione deve avere da 1 a 40 caratteri." };
  await preparaClassifica(db);
  return (await db.prepare("UPDATE stagioni SET nome = ? WHERE id = ? RETURNING id, nome").bind(n, id).first()) ?? { errore: "Stagione non trovata.", nonTrovato: true };
}

// Chiude la stagione in corso e ne apre subito una nuova, che parte da zero per tutti.
export async function chiudiStagione(db) {
  await permettiScrittura(db);
  const s = await stagioneInCorso(db);
  await db.prepare("UPDATE stagioni SET chiusa = ? WHERE id = ?").bind(new Date().toISOString(), s.id).run();
  const nuova = await stagioneInCorso(db);
  return { chiusa: s, nuova };
}

export async function partiteStagione(db, stagioneId) {
  await preparaClassifica(db);
  const { results } = await db.prepare(
    `SELECT p.id AS partita, p.esplorazione, p.nome AS pianeta, p.vie, p.chiusa, r.id AS risultato, r.esplorator, e.nickname, r.cicli, r.stanze, r.per_via
     FROM partite p LEFT JOIN risultati r ON r.partita = p.id LEFT JOIN esplorator e ON e.id = r.esplorator
     WHERE p.stagione = ? ORDER BY p.id DESC, r.id`,
  ).bind(stagioneId).all();
  const partite = new Map();
  for (const r of results) {
    let p = partite.get(r.partita);
    if (!p) partite.set(r.partita, (p = { id: r.partita, esplorazione: r.esplorazione, pianeta: r.pianeta, vie: JSON.parse(r.vie), chiusa: r.chiusa, risultati: [] }));
    if (r.risultato) p.risultati.push({ id: r.risultato, nickname: r.nickname ?? RIMOSS, cicli: r.cicli, stanze: r.stanze, perVia: JSON.parse(r.per_via) });
  }
  return [...partite.values()];
}

const intero = (x) => Number.isInteger(x) && x >= 0 && x <= 100000;

export async function modificaRisultato(db, id, { cicli, stanze, perVia }) {
  await permettiScrittura(db);
  if (!intero(cicli) || !intero(stanze)) return { errore: "Cicli e stanze devono essere numeri interi da 0 in su." };
  if (!perVia || typeof perVia !== "object" || Array.isArray(perVia) || !Object.values(perVia).every(intero) || Object.keys(perVia).length > 8) {
    return { errore: "Le stanze per via non sono valide." };
  }
  await preparaClassifica(db);
  const r = await db.prepare("UPDATE risultati SET cicli = ?, stanze = ?, per_via = ? WHERE id = ? RETURNING id")
    .bind(cicli, stanze, JSON.stringify(perVia), id).first();
  return r ? { ok: true } : { errore: "Risultato non trovato.", nonTrovato: true };
}

export async function eliminaRisultato(db, id) {
  await permettiScrittura(db);
  await preparaClassifica(db);
  const r = await db.prepare("DELETE FROM risultati WHERE id = ? RETURNING partita").bind(id).first();
  if (!r) return false;
  // una partita senza più risultati non serve
  await db.prepare("DELETE FROM partite WHERE id = ? AND NOT EXISTS (SELECT 1 FROM risultati WHERE partita = ?)").bind(r.partita, r.partita).run();
  return true;
}

export async function eliminaPartita(db, id) {
  await permettiScrittura(db);
  await preparaClassifica(db);
  await db.prepare("DELETE FROM risultati WHERE partita = ?").bind(id).run();
  const r = await db.prepare("DELETE FROM partite WHERE id = ?").bind(id).run();
  return r.meta.changes > 0;
}

// Quando un nickname viene cancellato: i suoi risultati spariscono dalla stagione in corso.
// Nelle stagioni archiviate restano, con il nome «Esplorator* rimoss*» (le posizioni degli altri non cambiano).
export async function dimenticaNickname(db, id) {
  await permettiScrittura(db);
  const s = await stagioneInCorso(db);
  await db.prepare("DELETE FROM risultati WHERE esplorator = ? AND partita IN (SELECT id FROM partite WHERE stagione = ?)").bind(id, s.id).run();
  await db.prepare("DELETE FROM partite WHERE stagione = ? AND NOT EXISTS (SELECT 1 FROM risultati WHERE partita = partite.id)").bind(s.id).run();
}
