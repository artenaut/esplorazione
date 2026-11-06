// Nickname del club (fase 4) e nomi dei guest.
// Di ogni nickname si conservano solo: il nickname, quando è stato creato, la data del consenso,
// la versione dell'informativa accettata e la conferma di avere almeno 14 anni (roadmap-classifica.md §9).

import { preparaSchema } from "./esplorazioni.js";
import { INFORMATIVA_VERSIONE } from "./costanti.js";
import { dimenticaNickname } from "./classifica.js";

export const NICK_MIN = 3, NICK_MAX = 20;
// lettere (anche accentate), numeri, spazi e pochi segni
const RE_NICK = /^[\p{L}\p{N}][\p{L}\p{N} ._'’-]*$/u;
const RISERVATI = ["guest", "admin", "master", "tabellone", "esplorator* rimoss*", "esploratore rimosso"];

export function controllaNickname(testo) {
  const n = typeof testo === "string" ? testo.normalize("NFC").trim().replace(/\s+/g, " ") : "";
  if (n.length < NICK_MIN) return { errore: `Il nickname deve avere almeno ${NICK_MIN} caratteri.` };
  if (n.length > NICK_MAX) return { errore: `Il nickname può avere al massimo ${NICK_MAX} caratteri.` };
  if (!RE_NICK.test(n)) return { errore: "Il nickname può contenere solo lettere, numeri, spazi e i segni . _ - '" };
  if (RISERVATI.includes(n.toLowerCase())) return { errore: "Questo nickname non si può usare: scegline un altro." };
  if (NOMI_GUEST.some((g) => g.toLowerCase() === n.toLowerCase())) return { errore: "Questo è un nome da guest: scegline un altro." };
  return { nickname: n };
}

export async function elencoPubblicoNickname(db) {
  await preparaSchema(db);
  const { results } = await db.prepare("SELECT id, nickname FROM esplorator ORDER BY nickname COLLATE NOCASE").all();
  return results;
}

export async function leggiNickname(db, id) {
  await preparaSchema(db);
  return db.prepare("SELECT id, nickname FROM esplorator WHERE id = ?").bind(id).first();
}

// Crea un nickname con il consenso dato in questo momento. Restituisce { id, nickname } oppure { errore }.
export async function creaNickname(db, testo) {
  const c = controllaNickname(testo);
  if (c.errore) return c;
  await preparaSchema(db);
  const ora = new Date().toISOString();
  try {
    return await db
      .prepare(
        `INSERT INTO esplorator (nickname, creato, consenso, informativa, eta14) VALUES (?1, ?2, ?2, ?3, 1)
         RETURNING id, nickname`,
      )
      .bind(c.nickname, ora, INFORMATIVA_VERSIONE)
      .first();
  } catch (e) {
    if (String(e?.message).includes("UNIQUE")) return { errore: `Il nickname «${c.nickname}» esiste già: se è il tuo, sceglilo dall’elenco.` };
    throw e;
  }
}

// ---------- area admin ----------

export async function elencoAdminNickname(db) {
  await preparaSchema(db);
  const { results } = await db
    .prepare("SELECT id, nickname, creato, consenso, informativa, eta14 FROM esplorator ORDER BY nickname COLLATE NOCASE")
    .all();
  return results;
}

export async function rinominaNickname(db, id, testo) {
  const c = controllaNickname(testo);
  if (c.errore) return c;
  await preparaSchema(db);
  try {
    const r = await db.prepare("UPDATE esplorator SET nickname = ? WHERE id = ? RETURNING id, nickname").bind(c.nickname, id).first();
    return r ?? { errore: "Nickname non trovato.", nonTrovato: true };
  } catch (e) {
    if (String(e?.message).includes("UNIQUE")) return { errore: `Il nickname «${c.nickname}» esiste già.` };
    throw e;
  }
}

// Cancellazione su richiesta: sparisce anche dalla classifica della stagione in corso;
// nelle stagioni archiviate i suoi risultati restano come «Esplorator* rimoss*».
export async function rimuoviNickname(db, id) {
  await preparaSchema(db);
  if (!(await leggiNickname(db, id))) return false;
  await dimenticaNickname(db, id);
  const r = await db.prepare("DELETE FROM esplorator WHERE id = ?").bind(id).run();
  return r.meta.changes > 0;
}

// ---------- guest ----------
// Un animale e un complemento invariabile: nessun aggettivo di genere (roadmap-classifica.md §10).
export const NOMI_GUEST = [
  "Gallina in incognito", "Alpaca col monocolo", "Lama dal cappello buffo", "Tartaruga a rotelle", "Volpe in pigiama",
  "Talpa con la torcia", "Lumaca a reazione", "Gufo in vacanza", "Riccio col mantello", "Panda in missione",
  "Koala senza mappa", "Polpo col cannocchiale", "Pinguino in perlustrazione", "Fenicottero sui pattini", "Criceto col jetpack",
  "Capibara in meditazione", "Bradipo di corsa", "Orso col papillon", "Lontra con la bussola", "Rana in smoking",
  "Cammello senza sete", "Giraffa in ascensore", "Ippopotamo in punta di piedi", "Struzzo col paracadute", "Tasso in missione segreta",
  "Scoiattolo con lo zaino", "Coniglio col mappamondo", "Topo da biblioteca", "Gatto col binocolo", "Cane con la lanterna",
  "Capra sul monociclo", "Pecora in tuta spaziale", "Mucca in orbita", "Asino col telescopio", "Zebra a pois",
  "Leone in ciabatte", "Tigre col ventaglio", "Elefante in bicicletta", "Canguro con le ali", "Pellicano col cilindro",
  "Tucano in gita", "Pappagallo con l’ombrello", "Corvo con la cartina", "Cigno sui trampoli", "Anatra in fuga",
  "Oca col periscopio", "Falco in pensione", "Medusa in scatola", "Granchio con la mappa", "Aragosta in maschera",
  "Delfino col casco", "Balena in miniatura", "Foca col violino", "Tricheco in ferie", "Lucertola al sole",
  "Camaleonte a righe", "Geco sul soffitto", "Cavalletta col metronomo", "Formica con la corona", "Ape in ritardo",
  "Farfalla col lanternino", "Daino col monopattino", "Marmotta in letargo", "Castoro con l’elmetto", "Procione col piccone",
  "Furetto sotto copertura", "Alce con la sciarpa", "Lemure col sombrero", "Opossum a testa in giù", "Armadillo a palla",
];

// Un nome da guest non ancora usato nella partita e diverso da quello attuale.
export function nomeGuest(usati, attuale) {
  const liberi = NOMI_GUEST.filter((n) => n !== attuale && !usati.includes(n));
  const scelta = liberi.length ? liberi : NOMI_GUEST.filter((n) => n !== attuale);
  return scelta[crypto.getRandomValues(new Uint32Array(1))[0] % scelta.length];
}
