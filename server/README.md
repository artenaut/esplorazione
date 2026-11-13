# Server · Registro dell'esplorazione

Worker Cloudflare «esplorazione» con un Durable Object «Partita» per ogni sessione (fase 3 del piano).
Indirizzo: https://esplorazione.artenaut.workers.dev

Decisioni e architettura: `../docs/roadmap-server.md`.

## Comandi

```sh
npm ci          # installa le dipendenze
npm test        # prove automatiche (Vitest dentro il runtime dei Worker)
npm run dev     # server locale su http://localhost:8787
```

## Prove dell'app con un server locale

Le prove usano il **Pianeta di collaudo** (`test/pianeta-collaudo.json`), inventato: nessun pianeta vero entra nel repository.

1. Dalla cartella principale: `python3 test/semina-collaudo.py --persist-to /tmp/stato`
2. `cd server && npx wrangler dev --port 8787 --persist-to /tmp/stato`
3. Dalla cartella principale: `python3 test/prova-app.py --server http://127.0.0.1:8787`

## Pubblicazione

Non si pubblica a mano: **Cloudflare Workers Builds** è collegato al repository, con cartella radice `server/`.
Ogni push su `main` costruisce e pubblica il Worker.

## Indirizzi

| Percorso | A cosa serve |
|---|---|
| `GET /` | Pagina di prova: «server online». |
| `GET /api/stato` | Stato e versione del server. |
| `GET /api/esplorazioni` | Elenco pubblico dei pianeti, senza stanze. |
| `POST /api/partite` | Crea una partita. |
| `GET /api/partite/:codice/ws` | WebSocket della partita (codice tipo `LWR-482`). Protocollo: `../docs/protocollo-partita.md`. |
| `/admin` | Area admin, dietro Cloudflare Access. |
| `/admin/moduli/…` | `motore.js`, `simulatore.js` e `qrcode.mjs` per il browser dell'area admin, copiati nel Worker a ogni costruzione da `scripts/copia-moduli.mjs` (dietro Access). |
