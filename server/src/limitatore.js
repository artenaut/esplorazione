// Durable Object «Limitatore»: conta i tentativi recenti di un indirizzo (passo 3.10).
// Uno per chiave (tipo di azione + impronta dell'indirizzo IP). I conteggi stanno solo in memoria:
// nulla viene scritto nello storage e, dopo qualche minuto senza richieste, l'oggetto e i suoi
// conteggi spariscono da soli.

import { DurableObject } from "cloudflare:workers";

export class Limitatore extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.colpi = [];
  }

  // true se il tentativo è ammesso (e viene contato), false se il limite è già raggiunto.
  async conta(limite, finestraMs) {
    const ora = Date.now();
    this.colpi = this.colpi.filter((t) => ora - t < finestraMs);
    if (this.colpi.length >= limite) return false;
    this.colpi.push(ora);
    return true;
  }
}
