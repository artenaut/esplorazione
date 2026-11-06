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

## Pubblicazione

Non si pubblica a mano: **Cloudflare Workers Builds** è collegato al repository, con cartella radice `server/`.
Ogni push su `main` costruisce e pubblica il Worker.

## Indirizzi

| Percorso | A cosa serve |
|---|---|
| `GET /` | Pagina di prova: «server online». |
| `GET /api/stato` | Stato e versione del server. |
| `GET /api/partite/:codice/ws` | WebSocket della partita (codice tipo `LWR-482`). |
