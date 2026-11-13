# Changelog

Tutte le modifiche rilevanti del Registro dell'esplorazione (app e server). Formato ispirato a [Keep a Changelog](https://keepachangelog.com/it-IT/1.1.0/).

**Numerazione** `MAGGIORE.MINORE.CORREZIONE`, un solo numero per app e server:
- **correzione:** sistemazione che non cambia il funzionamento;
- **minore:** nuova funzione;
- **maggiore:** cambiamento non compatibile (protocollo app ↔ server, formato dei pianeti).

Decisioni e rischi accettati non si ripetono qui: si trovano nelle roadmap in `docs/`.

## [Non rilasciato]

Niente, per ora.

## [0.1.0] – 2026-11-13

Prima versione: è lo stato provato al tavolo il 6/11/2026 (`docs/piano.md`, fasi 0–5). Il codice è invariato da allora.

### Architettura
- App statica su GitHub Pages: `index.html` (interfaccia e CSS inline, script come modulo ES), `classifica.html`, `informativa.html`, `vendor/qrcode.mjs` (licenza MIT), caratteri in `fonts/` (nessuna dipendenza da Google Fonts).
- Server su Cloudflare Workers (`server/`), pubblicato da Workers Builds a ogni push su `main`.
- Un Durable Object `Partita` per sessione (WebSocket Hibernation API, archiviazione SQLite); Durable Object `Limitatore` per i limiti ai tentativi, solo in memoria.
- Database D1 `esplorazione`: tabelle `esplorazioni`, `esplorator`, `stagioni`, `partite`, `risultati`.
- `motore.js` condiviso tra app e server: `validateModule`, `compile`, `drawOffer` / `pickRooms`, `nextOfNode`, `simulate`.
- Dettagli: `docs/roadmap-server.md` §1 e §3bis.

### Motore e formato dei pianeti
- Formato 2 dei pianeti: vie definite nel file, mappa dei livelli anche non simmetrica, livello successivo in base alla scelta, regola di estrazione come proprietà del pianeta (`docs/formato-esplorazione.md`).
- Estrazione «meno mostrate»: contatori condivisi della partita, spareggio sulle stanze già viste da chi muove, poi caso.
- Validazione al caricamento: ogni percorso arriva al finale, pool sufficienti, id unici; un file non valido si rifiuta, senza ripieghi.
- Lowrenzia convertita al formato 2 senza cambiare il gioco.

### Partite e protocollo
- Creazione con `POST /api/partite`: codice corto dal pianeta (es. `LWR-482`), codice master, link per il QR; la partita conserva una copia del pianeta.
- WebSocket per partita con ruoli master, esplorator\*, tabellone e ospite, controllati sul server.
- Posti con gettone (sul server solo l'impronta) e rientro automatico; gestione dei posti da parte del master (liberare, aggiungere, togliere, da 2 a 4).
- Mosse validate sul server, controllo di versione per personaggio; il testo della stanza viaggia solo con l'evento `mossa`, mai nello stato.
- Annulla solo l'ultima mossa della partita, da chi l'ha fatta o dal master; ripristina anche i contatori.
- Chiudi / Annulla partita, con «stesso gruppo» (nuova partita, telefoni già seduti); dati della partita eliminati alla chiusura.
- Scadenza con gli allarmi del Durable Object: 6 ore senza attività, 24 ore al massimo.
- Specifica completa: `docs/protocollo-partita.md`.

### Identità e privacy
- Guest con nome scelto dal server, senza dati salvati e fuori dalla classifica.
- Nickname del club creati da chi gioca, con conferma dei 14 anni e consenso; salvati nickname, data del consenso e versione dell'informativa.
- Elenco dei nickname visibile solo a chi ha un posto in una partita o al master.
- Informativa pubblicata in `informativa.html`, letta da `docs/informativa-privacy.md` (versione `2026-11-06`).
- Nessuno strumento di analisi delle visite; registri del Worker senza i dettagli delle richieste.

### Classifica
- Salvataggio alla chiusura nella stagione in corso, un risultato per nickname; se non riesce, la partita resta aperta.
- Classifica generale e per pianeta con spareggi in cascata e pari merito «1-2-2-4»; colonne dei pianeti generate dalle loro vie.
- Stagioni con nome, chiusura manuale e archivio pubblico.
- `GET /api/classifica` in sola lettura, cache di 60 secondi; pagina pubblica `classifica.html`.
- Regole: `docs/roadmap-classifica.md`.

### Area admin
- `/admin` dietro Cloudflare Access, con verifica del token nel Worker e secondo controllo sul segreto `ADMIN_EMAILS`; modifiche protette contro CSRF.
- Pianeti (caricamento, lettura, «Scarica JSON», rimozione), simulatore, nickname (rinomina, cancellazione), stagioni, correzione ed eliminazione di risultati e partite, QR della classifica in SVG.

### Sicurezza e limiti
- Limiti per indirizzo (IPv6 per blocco /64): 30 tentativi di ingresso e 10 creazioni al minuto; per connessione 30 messaggi ogni 10 secondi; 20 connessioni per partita; nuovi nickname limitati per partita e per rete.
- CSP in tutte le pagine; CORS solo per l'app; nessun segreto nel repository.
- Due revisioni di sicurezza (6/11/2026) e revisione dei rilasci (13/11/2026): correzioni e rischi accettati in `docs/roadmap-server.md` §3.

### Prove
- 70 prove automatiche del server e del motore (Vitest, `cd server && npm test`).
- 15 prove dell'app con più telefoni (Playwright, `test/prova-app.py`) contro un server locale.
- Prova al tavolo del 6/11/2026: più tavoli e più telefoni per tavolo, ingresso da QR e da codice, classifica generata.

### Problemi noti
- Pubblicare su `main` riavvia il server e fa cadere le connessioni delle partite in corso: non si pubblica durante le partite (premessa d'uso in `CLAUDE.md`).
