// Costanti del server. Stanno qui e non in index.js: il modulo principale del Worker
// può esportare solo il gestore e le classi dei Durable Object.

export const VERSIONE = "3.11";

// Limiti ai tentativi per indirizzo, in una finestra di un minuto (passo 3.10).
export const LIMITI = { INGRESSI: 30, CREAZIONI: 10 }, FINESTRA_LIMITI = 60 * 1000;
