// Costanti del server. Stanno qui e non in index.js: il modulo principale del Worker
// può esportare solo il gestore e le classi dei Durable Object.

// Versione dell'app e del server: sta in versione.js, nella cartella principale (V.8f).
export { VERSIONE } from "../../versione.js";

// Versione dell'informativa privacy in vigore (docs/informativa-privacy.md, «Ultimo aggiornamento»).
// Va cambiata insieme al testo: viene salvata con ogni nuovo consenso.
export const INFORMATIVA_VERSIONE = "2026-11-06";

// Limiti ai tentativi per indirizzo, in una finestra di un minuto (passo 3.10).
export const LIMITI = { INGRESSI: 30, CREAZIONI: 10 }, FINESTRA_LIMITI = 60 * 1000;
