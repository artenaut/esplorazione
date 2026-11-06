// Strumenti comuni alle prove delle partite.
import { env, exports } from "cloudflare:workers";
import { creaNickname, elencoPubblicoNickname } from "../src/esplorator.js";
import { expect } from "vitest";

export const BASE = "https://esplorazione.artenaut.workers.dev";
export const APP = "https://artenaut.github.io";
export const chiama = (percorso, init) => exports.default.fetch(new Request(BASE + percorso, init));

const st = (p, n, via = "a") => Array.from({ length: n }, (_, i) => ({ id: p + i, titolo: "Titolo " + p + i, via, testo: "SEGRETO " + p + i }));
export const PIANETA = {
  formato: 2, id: "lowrenzia", nome: "Pianeta di prova", estrazione: "meno-mostrate",
  vie: [{ id: "a", nome: "Via A", colore: "#112233" }, { id: "b", nome: "Via B", colore: "#445566" }],
  ingresso: { nome: "Ingresso", stanze: [...st("IA", 1), ...st("IB", 1, "b")], successivo: "L" },
  livelli: { L: { nome: "La forgia", stanze: [...st("LA", 3), ...st("LB", 3, "b")], proposte: { a: { a: 2 }, b: { b: 2 } }, successivo: "finale" } },
  finale: { nome: "La vetta", stanze: [...st("FA", 1), ...st("FB", 1, "b")], proposte: { a: { a: 1 }, b: { b: 1 } } },
};

// Nickname del club per le prove (lo crea se manca).
export async function nickname(nome) {
  const r = await creaNickname(env.DB, nome);
  if (!r.errore) return r.id;
  return (await elencoPubblicoNickname(env.DB)).find((n) => n.nickname.toLowerCase() === nome.toLowerCase()).id;
}

// Crea una partita con un posto per nome e assegna a ogni posto il nickname con quel nome.
export async function crea(nomi = ["Alba", "Bruno"], esplorazione = "lowrenzia", { assegna = true } = {}) {
  const r = await chiama("/api/partite", { method: "POST", headers: { Origin: APP, "Content-Type": "application/json" }, body: JSON.stringify({ esplorazione, posti: nomi.length }) });
  const corpo = await r.json();
  if (r.status === 201 && assegna) {
    const m = await apriWs(corpo.codice);
    m.manda({ tipo: "entra", codiceMaster: corpo.codiceMaster });
    await m.aspetta("benvenuto");
    for (let i = 0; i < nomi.length; i++) {
      m.manda({ tipo: "identita", posto: i, scelta: { tipo: "nickname", id: await nickname(nomi[i]) } });
      await m.aspetta("stato");
    }
    m.ws.close();
  }
  return { status: r.status, corpo };
}

export async function apriWs(codice) {
  const res = await chiama(`/api/partite/${codice}/ws`, { headers: { Upgrade: "websocket", Origin: APP } });
  expect(res.status).toBe(101);
  const ws = res.webSocket, coda = [], attese = [], tutti = [];
  ws.addEventListener("message", (e) => {
    const d = typeof e.data === "string" && e.data.startsWith("{") ? JSON.parse(e.data) : e.data;
    tutti.push(d);
    const a = attese.shift(); a ? a(d) : coda.push(d);
  });
  ws.accept();
  const prossimo = () => (coda.length ? Promise.resolve(coda.shift()) : new Promise((r) => attese.push(r)));
  const manda = (o) => ws.send(JSON.stringify(o));
  const aspetta = async (tipo) => { for (;;) { const m = await prossimo(); if (m.tipo === tipo) return m; } };
  return { ws, prossimo, manda, aspetta, tutti };
}

// master + un dispositivo per ogni posto indicato
export async function tavolo(nomi = ["Alba", "Bruno"], postiConTelefono = [0]) {
  const { corpo } = await crea(nomi);
  const master = await apriWs(corpo.codice);
  master.manda({ tipo: "entra", codiceMaster: corpo.codiceMaster });
  let stato = (await master.aspetta("benvenuto")).stato;
  const telefoni = [];
  for (const posto of postiConTelefono) {
    const t = await apriWs(corpo.codice);
    t.manda({ tipo: "entra" }); await t.aspetta("benvenuto");
    t.manda({ tipo: "occupa", posto }); await t.aspetta("posto");
    stato = (await master.aspetta("stato")).stato;
    telefoni[posto] = t;
  }
  return { codice: corpo.codice, master, telefoni, stato };
}
