// Creazione di una partita: la usano il Worker (POST /api/partite) e la partita stessa
// quando il master sceglie «nuova partita con lo stesso gruppo».

import { casuale } from "./util.js";

// Tre lettere dal nome tecnico del pianeta: la prima, poi le consonanti (lowrenzia → LWR).
export function prefissoCodice(id) {
  const lettere = id.toUpperCase().replace(/[^A-Z]/g, "");
  const scelte = (lettere[0] ?? "") + lettere.slice(1).replace(/[AEIOU]/g, "");
  return (scelte + lettere.slice(1) + "XXX").slice(0, 3);
}

// Cerca un codice libero e crea la partita. gettoniHash: impronte dei gettoni da assegnare
// ai posti (stesso ordine dei nomi), per far restare seduti i dispositivi del gruppo.
// Restituisce { codice, codiceMaster, link } oppure null se non trova un codice libero.
export async function nuovaPartita(env, esplorazione, nomi, gettoniHash = []) {
  const codiceMaster = casuale();
  const prefisso = prefissoCodice(esplorazione.id);
  for (let tentativo = 0; tentativo < 20; tentativo++) {
    const cifre = 100 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900);
    const codice = `${prefisso}-${cifre}`;
    const stub = env.PARTITA.get(env.PARTITA.idFromName(codice));
    const esito = await stub.crea({ codice, esplorazione, nomi, codiceMaster, gettoniHash });
    if (esito.ok) return { codice, codiceMaster, link: `${env.INDIRIZZO_APP}?partita=${codice}` };
  }
  return null;
}
