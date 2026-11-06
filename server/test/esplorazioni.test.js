// Prove del passo 3.2: esplorazioni in D1, elenco pubblico senza stanze, area /admin dietro Access.
import { env, exports } from "cloudflare:workers";
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { gestisciAdmin } from "../src/admin.js";
import { creaNickname, elencoPubblicoNickname } from "../src/esplorator.js";

const BASE = "https://esplorazione.artenaut.workers.dev";
const TEAM = "artenaut.cloudflareaccess.com";
const chiama = (percorso, init) => exports.default.fetch(new Request(BASE + percorso, init));

const st = (p, n, via = "a") => Array.from({ length: n }, (_, i) => ({ id: p + i, titolo: "Titolo " + p + i, via, testo: "SEGRETO " + p + i }));
const PIANETA = {
  formato: 2, id: "pianeta-prova", nome: "Pianeta di prova", descrizione: "Una via sola",
  estrazione: "meno-mostrate", regole: "## Regole\n- Si gioca.", regoleImmagine: "img/esploratore.png",
  vie: [{ id: "a", nome: "Via A", colore: "#112233" }],
  ingresso: { nome: "Ingresso", stanze: st("I", 1), successivo: "L" },
  livelli: { L: { stanze: st("L", 3), proposte: { a: { a: 2 } }, successivo: "finale" } },
  finale: { stanze: st("F", 1), proposte: { a: { a: 1 } } },
};

// --- token Access firmati dalla prova ---
let coppia, jwk;
const b64u = (b) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const b64uJson = (o) => b64u(new TextEncoder().encode(JSON.stringify(o)));
async function token(contenuto = {}, chiave = coppia.privateKey, kid = "k1") {
  const ora = Math.floor(Date.now() / 1000);
  const c = { iss: `https://${TEAM}`, aud: ["aud-di-prova"], email: "admin@esempio.it", exp: ora + 600, iat: ora, ...contenuto };
  const testa = b64uJson({ alg: "RS256", kid, typ: "JWT" }) + "." + b64uJson(c);
  const firma = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", chiave, new TextEncoder().encode(testa));
  return testa + "." + b64u(firma);
}
const comeAdmin = async (percorso, init = {}, tok) =>
  chiama(percorso, { ...init, headers: { "Cf-Access-Jwt-Assertion": tok ?? (await token()), "X-Richiesta": "admin", ...(init.headers ?? {}) } });

let spia;
beforeAll(async () => {
  const alg = { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" };
  coppia = await crypto.subtle.generateKey(alg, true, ["sign", "verify"]);
  jwk = { ...(await crypto.subtle.exportKey("jwk", coppia.publicKey)), kid: "k1", alg: "RS256" };
  const fetchVero = globalThis.fetch;
  spia = vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
    const u = typeof input === "string" ? input : input.url;
    if (u === `https://${TEAM}/cdn-cgi/access/certs`) return Promise.resolve(Response.json({ keys: [jwk] }));
    return fetchVero(input, init);
  });
});
afterAll(() => spia.mockRestore());

describe("Area /admin", () => {
  it("senza AUD configurato risponde «non configurata»", async () => {
    const res = await gestisciAdmin(new Request(BASE + "/admin"), { ACCESS_TEAM: TEAM, ACCESS_AUD: "" }, new URL(BASE + "/admin"));
    expect(res.status).toBe(503);
  });

  it("rifiuta richieste senza token, con token falso, scaduto o di un'altra applicazione", async () => {
    expect((await chiama("/admin")).status).toBe(403);
    expect((await chiama("/admin/api/esplorazioni")).status).toBe(403);
    const altra = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign"]);
    const casi = [
      await token({}, altra.privateKey),                       // firma sbagliata
      await token({ exp: Math.floor(Date.now() / 1000) - 10 }), // scaduto
      await token({ aud: ["altra-app"] }),                     // altra applicazione
      await token({ iss: "https://altro.cloudflareaccess.com" }),
      "non.un.token",
    ];
    for (const t of casi) expect((await comeAdmin("/admin/api/esplorazioni", {}, t)).status).toBe(403);
  });

  it("con token valido mostra la pagina e gestisce le esplorazioni", async () => {
    const pagina = await comeAdmin("/admin");
    expect(pagina.status).toBe(200);
    expect(await pagina.text()).toContain("Esplorazioni sul server");

    // carica
    let r = await comeAdmin("/admin/api/esplorazioni", { method: "POST", body: JSON.stringify(PIANETA), headers: { "Content-Type": "application/json" } });
    expect(await r.json()).toEqual({ esplorazione: "pianeta-prova", versione: 1, nuova: true });
    // aggiorna
    r = await comeAdmin("/admin/api/esplorazioni", { method: "POST", body: JSON.stringify({ ...PIANETA, nome: "Pianeta rinominato" }) });
    expect(await r.json()).toMatchObject({ versione: 2, nuova: false });
    // elenco admin
    const lista = await (await comeAdmin("/admin/api/esplorazioni")).json();
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({ id: "pianeta-prova", nome: "Pianeta rinominato", stanze: 5, livelli: 3, versione: 2 });
    // lettura completa (con i testi) solo da admin
    const completo = await (await comeAdmin("/admin/api/esplorazioni/pianeta-prova")).json();
    expect(completo.livelli.L.stanze[0].testo).toBe("SEGRETO L0");
    // rimozione
    expect((await comeAdmin("/admin/api/esplorazioni/pianeta-prova", { method: "DELETE" })).status).toBe(200);
    expect((await comeAdmin("/admin/api/esplorazioni/pianeta-prova")).status).toBe(404);
  });

  it("rifiuta file non validi con il messaggio del controllo del formato", async () => {
    const casi = [
      ["non json", 400, "non è un JSON valido"],
      [JSON.stringify({ ...PIANETA, livelli: { L: { ...PIANETA.livelli.L, proposte: { a: { a: 9 } } } } }), 422, "ce ne sono solo 3"],
      [JSON.stringify({ ...PIANETA, formato: 1 }), 422, "formato"],
    ];
    for (const [corpo, stato, testo] of casi) {
      const r = await comeAdmin("/admin/api/esplorazioni", { method: "POST", body: corpo });
      expect(r.status).toBe(stato);
      expect((await r.json()).errore).toContain(testo);
    }
    const grande = await comeAdmin("/admin/api/esplorazioni", { method: "POST", body: "x".repeat(1024 * 1024 + 1) });
    expect(grande.status).toBe(400);
  });

  it("le modifiche senza l'intestazione X-Richiesta vengono rifiutate (CSRF)", async () => {
    const r = await chiama("/admin/api/esplorazioni", { method: "POST", body: JSON.stringify(PIANETA), headers: { "Cf-Access-Jwt-Assertion": await token() } });
    expect(r.status).toBe(400);
  });
});

describe("Elenco pubblico", () => {
  it("contiene nome, vie e regole, ma nessuna stanza", async () => {
    await comeAdmin("/admin/api/esplorazioni", { method: "POST", body: JSON.stringify(PIANETA) });
    const r = await chiama("/api/esplorazioni", { headers: { Origin: "https://artenaut.github.io" } });
    expect(r.status).toBe(200);
    expect(r.headers.get("Access-Control-Allow-Origin")).toBe("https://artenaut.github.io");
    const testo = await r.text();
    expect(testo).not.toContain("SEGRETO");
    expect(testo).not.toContain("Titolo ");
    expect(testo).not.toContain("stanze");
    expect(JSON.parse(testo)).toEqual([{
      id: "pianeta-prova", nome: "Pianeta di prova", descrizione: "Una via sola",
      vie: [{ id: "a", nome: "Via A", breve: "Via A", colore: "#112233" }],
      regole: "## Regole\n- Si gioca.", regoleImmagine: "img/esploratore.png",
    }]);
  });
});

describe("Moderazione dei nickname (4.4)", () => {
  it("elenco con la prova del consenso, rinomina e cancellazione solo da admin", async () => {
    const { id } = await creaNickname(env.DB, "Mario Rossi");
    await creaNickname(env.DB, "Altro Nick");
    expect((await chiama("/admin/api/esplorator")).status).toBe(403);
    const lista = await (await comeAdmin("/admin/api/esplorator")).json();
    expect(lista.find((n) => n.id === id)).toMatchObject({ nickname: "Mario Rossi", eta14: 1, informativa: expect.any(String), consenso: expect.any(String) });

    const rinomina = (nuovo) => comeAdmin(`/admin/api/esplorator/${id}`, { method: "PATCH", body: JSON.stringify({ nickname: nuovo }), headers: { "Content-Type": "application/json" } });
    expect((await rinomina("altro nick")).status).toBe(422);            // esiste già
    expect((await rinomina("x")).status).toBe(422);                     // troppo corto
    expect(await (await rinomina("Esploratore Uno")).json()).toEqual({ id, nickname: "Esploratore Uno" });
    expect((await elencoPubblicoNickname(env.DB)).map((n) => n.nickname)).toContain("Esploratore Uno");

    expect((await comeAdmin(`/admin/api/esplorator/${id}`, { method: "DELETE" })).status).toBe(200);
    expect((await comeAdmin(`/admin/api/esplorator/${id}`, { method: "DELETE" })).status).toBe(404);
    expect((await elencoPubblicoNickname(env.DB)).some((n) => n.id === id)).toBe(false);
  });
});

describe("Secondo controllo dell'accesso (ADMIN_EMAILS)", () => {
  it("se il segreto c'è, entra solo un'email dell'elenco; senza, la pagina lo segnala", async () => {
    const richiesta = async (ammesse) => {
      const req = new Request(BASE + "/admin", { headers: { "Cf-Access-Jwt-Assertion": await token() } });
      return gestisciAdmin(req, { ...env, ACCESS_TEAM: TEAM, ACCESS_AUD: "aud-di-prova", ADMIN_EMAILS: ammesse }, new URL(BASE + "/admin"));
    };
    expect((await richiesta("altra@esempio.it")).status).toBe(403);
    const ok = await richiesta(" ADMIN@esempio.it , seconda@esempio.it");
    expect(ok.status).toBe(200);
    expect(await ok.text()).not.toContain("Secondo controllo dell'accesso non attivo");
    expect(await (await richiesta(undefined)).text()).toContain("Secondo controllo dell'accesso non attivo");
  });
});
