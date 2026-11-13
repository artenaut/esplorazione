// Prove della versione 0.2.0: un solo numero (versione.js) per app e server (V.8f, V.5, V.6).
import { describe, it, expect } from "vitest";
import { VERSIONE } from "../../versione.js";
import { VERSIONE as DAL_SERVER } from "../src/costanti.js";
import { chiama, crea, apriWs, APP } from "./aiuto.js";
import { PIANETA } from "./aiuto.js";
import { env } from "cloudflare:workers";
import { salva } from "../src/esplorazioni.js";

describe("Versione", () => {
  it("è nel formato MAGGIORE.MINORE.CORREZIONE e il server usa la stessa di versione.js", () => {
    expect(VERSIONE).toMatch(/^\d+\.\d+\.\d+$/);
    expect(DAL_SERVER).toBe(VERSIONE);
  });

  it("/api/stato e la pagina principale dicono la versione", async () => {
    expect(await (await chiama("/api/stato", { headers: { Origin: APP } })).json()).toEqual({ ok: true, versione: VERSIONE });
    expect(await (await chiama("/")).text()).toContain(`versione ${VERSIONE}`);
  });

  it("il messaggio di benvenuto della partita porta la versione del server", async () => {
    await salva(env.DB, PIANETA);
    const { corpo } = await crea(["Alba", "Bruno"], "lowrenzia", { assegna: false });
    const t = await apriWs(corpo.codice);
    t.manda({ tipo: "entra" });
    expect(await t.aspetta("benvenuto")).toMatchObject({ ruolo: "ospite", versione: VERSIONE });
  });
});
