// Il motore condiviso (../motore.js) funziona anche nel runtime dei Worker.
import { describe, it, expect } from "vitest";
import { validateModule, compile, drawOffer, nextOfNode, simulate } from "../../motore.js";

const st = (p, n, via = "a") => Array.from({ length: n }, (_, i) => ({ id: p + i, titolo: p + i, via, testo: "testo " + p + i }));
const PIANETA = {
  formato: 2, id: "prova", nome: "Prova", estrazione: "meno-mostrate",
  vie: [{ id: "a", nome: "A", colore: "#112233" }, { id: "b", nome: "B", colore: "#445566" }],
  ingresso: { nome: "Ingresso", stanze: [...st("IA", 1), ...st("IB", 1, "b")], successivo: { a: "LA", b: "LB" } },
  livelli: {
    LA: { stanze: [...st("A", 4), ...st("AB", 2, "b")], proposte: { a: { a: 2, b: 1 } }, successivo: { a: "finale", b: "LB" } },
    LB: { stanze: st("B", 4, "b"), proposte: { a: { b: 2 }, b: { b: 2 } }, successivo: "finale" },
  },
  finale: { stanze: [...st("FA", 1), ...st("FB", 1, "b")], proposte: { a: { a: 1 }, b: { b: 1 } } },
};

describe("motore.js nel Worker", () => {
  it("valida, compila ed estrae", () => {
    expect(validateModule(PIANETA)).toBeNull();
    expect(validateModule({ ...PIANETA, id: "lowrenzia" }, { idRiservati: ["lowrenzia"] })).toContain("già usato");
    // immagine delle regole solo dal sito (niente indirizzi esterni)
    expect(validateModule({ ...PIANETA, regoleImmagine: "img/esploratore.png" })).toBeNull();
    expect(validateModule({ ...PIANETA, regoleImmagine: "https://esempio.it/x.png" })).toContain("cartella img/");
    const m = compile(PIANETA);
    const shown = {}, seen = {};
    const offerta = drawOffer(m, "LA", "a", shown, seen);
    expect(offerta).toHaveLength(3);
    expect(offerta.filter((id) => m.roomMap[id].room.path === "b")).toHaveLength(1);
    expect(nextOfNode(m, "LA", "b")).toBe("LB");
    expect(nextOfNode(m, "finale", "a")).toBe("ingresso");
  });

  it("il simulatore gira", () => {
    const r = simulate(compile(PIANETA), 50, 3, 8);
    expect(r.moves).toBe(50 * 3 * 8);
    expect(r.laps).toBeGreaterThan(0);
  });
});
