// Costanti del server. Stanno qui e non in index.js: il modulo principale del Worker
// può esportare solo il gestore e le classi dei Durable Object.

// Versione dell'app e del server: sta in versione.js, nella cartella principale (V.8f).
export { VERSIONE } from "../../versione.js";

// Versione dell'informativa privacy in vigore (docs/informativa-privacy.md, «Ultimo aggiornamento»).
// Va cambiata insieme al testo: viene salvata con ogni nuovo consenso.
// Numero di schema dei dati (V.8a): sale quando una versione cambia la struttura dei dati in D1
// o nello stato delle partite (sempre e solo aggiungendo). Un codice più vecchio dei dati che trova
// passa in sola lettura invece di scrivere dati che non conosce (docs/piano.md, «Sola lettura»).
export const SCHEMA = 1;
export const MSG_SOLA_LETTURA = "Il server è stato riportato a una versione precedente: le modifiche sono sospese.";
export const MSG_PARTITA_PIU_NUOVA = "Questa partita è stata creata con una versione più recente: creane una nuova.";

export const INFORMATIVA_VERSIONE = "2026-11-06";

// Limiti ai tentativi per indirizzo, in una finestra di un minuto (passo 3.10).
export const LIMITI = { INGRESSI: 30, CREAZIONI: 10 }, FINESTRA_LIMITI = 60 * 1000;
