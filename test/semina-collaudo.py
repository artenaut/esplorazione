"""Carica il «Pianeta di collaudo» (test/pianeta-collaudo.json) nel database locale del server.

Il pianeta è inventato: serve solo alle prove automatiche (deciso il 13/11/2026).
Uso, dalla cartella principale:
    python3 test/semina-collaudo.py [--persist-to /tmp/stato]
Poi:
    cd server && npx wrangler dev --port 8787 --persist-to /tmp/stato
"""
import argparse, json, os, subprocess, tempfile
from datetime import datetime, timezone

RADICE = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

ap = argparse.ArgumentParser()
ap.add_argument("--persist-to", default="/tmp/stato")
args = ap.parse_args()

pianeta = json.load(open(os.path.join(RADICE, "test", "pianeta-collaudo.json"), encoding="utf-8"))
ora = datetime.now(timezone.utc).isoformat()
q = lambda s: "'" + s.replace("'", "''") + "'"
dati = json.dumps(pianeta, ensure_ascii=False)

# stessa tabella di server/src/esplorazioni.js (preparaSchema)
sql = f"""CREATE TABLE IF NOT EXISTS esplorazioni (
  id TEXT PRIMARY KEY, nome TEXT NOT NULL, dati TEXT NOT NULL,
  versione INTEGER NOT NULL DEFAULT 1, caricata TEXT NOT NULL, aggiornata TEXT NOT NULL);
INSERT OR REPLACE INTO esplorazioni (id, nome, dati, versione, caricata, aggiornata)
VALUES ({q(pianeta['id'])}, {q(pianeta['nome'])}, {q(dati)}, 1, {q(ora)}, {q(ora)});
"""
with tempfile.NamedTemporaryFile("w", suffix=".sql", delete=False, encoding="utf-8") as f:
    f.write(sql)
subprocess.run(["npx", "wrangler", "d1", "execute", "esplorazione", "--local", "--persist-to", args.persist_to, "--file", f.name],
               cwd=os.path.join(RADICE, "server"), check=True)
os.unlink(f.name)
print("Pianeta di collaudo caricato in", args.persist_to)
