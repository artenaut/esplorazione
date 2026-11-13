// Moduli dell'app serviti dal Worker all'area admin (V.8e): stesso codice incluso nel server,
// copiato a ogni costruzione da scripts/copia-moduli.mjs.
import motore from "./generati/motore.js.txt";
import simulatore from "./generati/simulatore.js.txt";
import qrcode from "./generati/qrcode.mjs.txt";

export const MODULI = { "motore.js": motore, "simulatore.js": simulatore, "qrcode.mjs": qrcode };
