// Copia nel pacchetto del Worker i moduli che l'area admin usa nel browser (V.8e):
// così il simulatore gira sempre con lo stesso motore del server, e la pagina non carica
// codice da GitHub Pages. Lo esegue wrangler prima di ogni costruzione (wrangler.jsonc, «build»)
// e npm test prima delle prove. I file copiati non vanno nel repository (.gitignore).
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const server = join(dirname(fileURLToPath(import.meta.url)), "..");
const radice = join(server, "..");
const dest = join(server, "src", "generati");
mkdirSync(dest, { recursive: true });
for (const [da, a] of [["motore.js", "motore.js.txt"], ["simulatore.js", "simulatore.js.txt"], ["vendor/qrcode.mjs", "qrcode.mjs.txt"]]) {
  copyFileSync(join(radice, da), join(dest, a));
}
