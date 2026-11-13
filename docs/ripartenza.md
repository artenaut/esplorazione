# Ripartenza · dopo il prototipo 0.1.0

Documento di passaggio, aggiornato il 13/11/2026. Sostituisce `ripartenza-fase-3.md`, che resta solo come storico.
Da leggere insieme a `CLAUDE.md` (regole permanenti) e `docs/piano.md` (il piano: partire sempre da lì).

---

## 1. Come iniziare la nuova sessione

1. **Collegare il repository** `artenaut/esplorazione` e leggere `CLAUDE.md`, poi `docs/piano.md`.
2. **Controllare che sito e server rispondano:**
   - `https://artenaut.github.io/esplorazione/` (app);
   - `https://esplorazione.artenaut.workers.dev/api/stato` (oggi risponde `{"ok":true,"versione":"5.1"}`).

   Se qualcosa è bloccato dalla rete della sessione, dirlo subito a Francesco con il nome esatto del dominio.
3. **Non cambiare nulla nel codice** finché non è fatta la sezione «Versioni e rilasci» del piano (§3 qui sotto).
4. **Chiedere a Francesco** se ci sono state serate di gioco o segnalazioni dopo il 7/11/2026.

---

## 2. Stato del progetto

| Parte | Stato |
|---|---|
| Fasi 0–5 del piano | ✅ completate il 6/11/2026: app a sessioni, server, nickname e guest, informativa nell'app, classifica con stagioni |
| Prova al tavolo (1.6 e 3.11) | ✅ 6/11/2026: più tavoli in contemporanea, più telefoni per tavolo, ingresso da QR e da codice, classifica generata. Nessun problema |
| Revisioni di sicurezza | ✅ due, il 6/11/2026: correzioni applicate e rischi accettati in `roadmap-server.md` §3 |
| Versioni e rilasci | **Da fare per primo** (priorità alta) |
| Backup dei dati e azzeramento dei dati personali | Da fare dopo le versioni (priorità alta) |
| Guide per il master e per l'admin | Da fare (fase 6), struttura da definire con Francesco |
| Fase 6 (extra) | Facoltativa |

**Dove gira tutto**
- **App:** GitHub Pages, branch `main`, cartella principale. File: `index.html`, `motore.js`, `simulatore.js`, `classifica.html`, `informativa.html`, `vendor/qrcode.mjs`, `fonts/`, `img/`.
- **Server:** Worker `esplorazione` su Cloudflare (account del club), cartella `server/`. Lo pubblica Workers Builds a ogni push su `main`, compresi i push di soli documenti.
- **Dati:** D1 `esplorazione`, con le tabelle `esplorazioni`, `esplorator`, `stagioni`, `partite` e `risultati`. Le partite in corso stanno nei Durable Object `Partita`; il Durable Object `Limitatore` conta i tentativi in memoria.
- **Area admin:** `https://esplorazione.artenaut.workers.dev/admin`, dietro Cloudflare Access (applicazione «Esplorazione · admin», solo il percorso `/admin`) e il segreto `ADMIN_EMAILS` del Worker. L'unico admin è Francesco.
- **Protocollo app ↔ server:** `docs/protocollo-partita.md`.

**Dati attualmente sul server**
- **Pianeti:** solo Lowrenzia. Il testo di «Al Diavolo le mappe» è stato cambiato **solo sul server** (pedina Goblin Fu-Furioso): la cronologia del repository ha la versione vecchia. Francesco ha una copia del file.
- **Stagione in corso:** «Prove di esplorazione», con i dati della serata di prova (7 nickname). Verrà svuotata con l'azzeramento (B.8).
- **Nessuna partita in corso** lasciata dalle prove.

---

## 3. Prossimi passi, in ordine

### 1. Versioni e rilasci (`piano.md`, punti V.1–V.7)
- **Prima versione 0.1.0** (scelta di Francesco: è un prototipo, non 1.0.0). Numerazione `MAGGIORE.MINORE.CORREZIONE`, un solo numero per app e server.
- **Note di rilascio dettagliate,** per chi gioca e chi organizza, con tutte le funzionalità inserite, più un **`CHANGELOG.md` tecnico** più dettagliato. **Il testo di entrambi va concordato con Francesco prima di scriverlo:** proporre una struttura e aspettare la sua conferma.
- Poi: etichetta `v0.1.0` su GitHub con la pagina Release, versione visibile nell'app e nell'area admin (al posto di «5.1» in `server/src/costanti.js`), controllo di compatibilità tra app e server, ritorno a una versione precedente documentato.

### 2. Backup dei dati (`piano.md`, punti B.1–B.8)
- Copia automatica periodica nello stesso account Cloudflare, più una copia fuori da Cloudflare (pulsante «Scarica backup» nell'area admin, da usare anche prima di chiudere una stagione). File dei pianeti inclusi, registro delle azioni dell'admin, prova di ripristino.
- **Privacy dei backup:** mai nel repository, durata limitata, una frase nell'informativa.
- **B.8, con l'uscita del backup:** si cancellano tutti i nickname e le prove del consenso e si conservano **solo totali aggregati** per pianeta e per stagione (deciso il 7/11/2026). Chi gioca accetta di nuovo l'informativa aggiornata e ricrea il nickname. Avvisare i giocatori prima.
- Dove salvare, ogni quanto e per quanto: **da decidere con Francesco** prima di sviluppare.

### 3. Guide (fase 6)
- **Guida per il master:** si apre in modo rapido dal telefono, anche a partita in corso.
- **Guida per un futuro admin:** documento tecnico e dettagliato in `docs/`.
- Struttura di entrambe **da definire con Francesco**.

---

## 4. Cose che toccano a Francesco

- **4.5:** far verificare l'informativa a un consulente, anche nella versione aggiornata con i backup.
- Stampare il **QR della classifica** dall'area admin.
- **Autenticazione a due fattori** su GitHub (obbligatoria per l'organizzazione), Cloudflare e Gmail del club.
- Conservare una copia del file di ogni pianeta (dall'area admin: «Scarica JSON»).

---

## 5. Come lavorare (emerso dalla review del 7/11/2026)

- **Una fase per sessione,** con una pausa per guardare il risultato.
- **Prima di pubblicare una modifica visibile,** mostrare a Francesco gli screenshot sul telefono.
- **Chiedere subito se c'è una scadenza** (una serata di gioco) e adattare il piano a quella.
- **Non pubblicare durante una serata di gioco:** le connessioni cadono per qualche secondo.
- **Essere onesti e diretti:** dire chiaramente quando un'idea o una scelta ha problemi.

---

## 6. Note tecniche utili

- **Prove:** `cd server && npm test` (Vitest, oggi 70 prove) e `python3 test/prova-app.py` (Playwright, 15 prove, più telefoni) contro un server locale con Lowrenzia. Procedura in `server/README.md`. Il file di Lowrenzia per il seme locale si scarica dall'area admin e **non va nel repository**.
- **Modulo principale del Worker:** `server/src/index.js` può esportare solo il gestore e le classi dei Durable Object; altrimenti il runtime aggiornato si rifiuta di avviarlo. Le costanti stanno in `server/src/costanti.js`, le utilità in `server/src/util.js`.
- **Limiti ai tentativi:** il limitatore integrato di Cloudflare non bloccava in produzione, quindi si usa il Durable Object `Limitatore`.
- **Il segreto `ADMIN_EMAILS`** sta in Settings → **Runtime variables and secrets**, non nella sezione Builds.
- **Ritorno indietro:** Cloudflare → Deployments per il server; annullare i commit per il sito. Tornare indietro con il codice **non** riporta indietro i dati: le modifiche al database vanno fatte solo aggiungendo.
- **D1 Time Travel:** 7 giorni nel piano gratuito; il ripristino sovrascrive il database.
- **Consumi stimati:** una serata con 4 tavoli usa meno del 5% dei limiti gratuiti giornalieri. Limite pratico: 30 ingressi al minuto per indirizzo, e al club il Wi-Fi è un solo indirizzo (lasciato così: si aspetta un minuto o si usa la rete mobile).
- **Commit:** autore `Claude <noreply@anthropic.com>`. Dopo ogni passo, spuntare il piano e la roadmap con la data.
