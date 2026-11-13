# Registro dell'esplorazione · istruzioni per Claude

Web app di supporto al gioco **Artenaut\* Magic Exploration Companion**: tiene traccia del percorso di 2–4 persone nelle stanze di un pianeta (un'«esplorazione») durante partite di Magic: The Gathering.
Committente e unico amministratore: **Francesco**, per il club **Artenaut\***. Si lavora e si scrive **in italiano**.

## Dove sta cosa

| Cosa | Dove |
|---|---|
| App pubblicata | https://artenaut.github.io/esplorazione/ (GitHub Pages, branch `main`, cartella principale) |
| Repository | `artenaut/esplorazione` (organizzazione GitHub del club) |
| Server (fase 3) | https://esplorazione.artenaut.workers.dev · codice in `server/` · pubblicato da Workers Builds a ogni push su `main` · account Cloudflare del club · Zero Trust team `artenaut` |
| **Piano di lavoro a fasi** | `docs/piano.md` ← **partire sempre da qui** |
| Documento di ripartenza | `docs/ripartenza.md` (stato attuale e prossimi passi) |
| Decisioni dettagliate | `docs/roadmap-app.md`, `docs/roadmap-server.md`, `docs/roadmap-classifica.md` |
| Formato dei pianeti | `docs/formato-esplorazione.md` (formato 2) |
| Protocollo app ↔ server | `docs/protocollo-partita.md` (creazione, WebSocket, ruoli, stato, errori) |
| Informativa privacy | `docs/informativa-privacy.md` |

L'app è **`index.html`** (CSS e interfaccia inline, script come modulo ES) più `vendor/qrcode.mjs` (QR code, licenza MIT), `fonts/` (caratteri ospitati nel sito, niente Google Fonts) e `img/` (immagine delle regole). **Dal 6/11/2026 funziona solo a sessioni:** la partita vive sul server, l'app mostra lo stato e manda le azioni (`docs/protocollo-partita.md`). Nel dispositivo restano solo la sessione (`esplorazione.sessione`: codice, ruolo, codice master o gettone) e il numero di esplorator\* dell'ultima partita. Chi gioca sceglie la propria identità (nickname del club o guest) dopo aver preso il posto; i nickname e la prova del consenso stanno in D1 (tabella `esplorator`). `informativa.html` mostra `docs/informativa-privacy.md`: se cambia il testo, aggiornare anche `INFORMATIVA_VERSIONE` in `server/src/costanti.js`. Nessun testo di stanza nell'app: le esplorazioni stanno solo sul server.
`classifica.html`: classifica pubblica (fase 5), legge `GET /api/classifica`. `simulatore.js`: tabelle del simulatore. L'area admin usa `motore.js`, `simulatore.js` e `vendor/qrcode.mjs` serviti dal Worker stesso (`/admin/moduli/`, copiati a ogni costruzione da `server/scripts/copia-moduli.mjs`), mai da GitHub Pages. **Versione:** un solo numero per app e server in `versione.js`; numero di schema dei dati in `SCHEMA` (`server/src/costanti.js`), regole in `docs/roadmap-server.md` §3, «Rilasci, schema dei dati e ritorno indietro». L'anteprima in claude.ai non si usa più: il server accetta solo l'app su `artenaut.github.io` (e localhost per le prove).
**`motore.js` è condiviso tra app e server** (modulo ES senza DOM né localStorage): `validateModule` (controllo del formato 2, con `idRiservati`), `compile`, `drawOffer` / `pickRooms` (estrazione «meno mostrate»), `nextOfNode`, `simulate` (simulatore nell'area admin). Una modifica al motore cambia il gioco su entrambi i lati.
**Prove:** `cd server && npm test` (Vitest, server e motore) e `python3 test/prova-app.py` (Playwright, app con più telefoni, contro un server locale con il **Pianeta di collaudo** inventato, `test/pianeta-collaudo.json`: vedi `server/README.md`). L'area admin è solo sul server, dietro Cloudflare Access: la vecchia password `dungeon` non esiste più.

## Regole permanenti

1. **Linguaggio inclusivo** in tutto ciò che vedono le persone: «esplorator\*» o forme neutre («chi gioca», «chi amministra»). Forme neutre quando sono naturali, asterisco quando la forma neutra è artificiosa (es. «un\* avversari\*»). I termini di gioco di Magic nei testi delle stanze restano come sono.
2. **Il testo di una stanza si vede solo nel momento in cui si entra.** Mai tra le proposte, mai nel percorso o nella cronologia, nemmeno se la stanza è già stata visitata.
3. **Lunghezza del percorso nascosta:** si mostra solo il passo attuale («Passo 3»), mai il totale.
4. **Le esplorazioni sono dati, non codice.** Nessuno script nei file dei pianeti. Se una regola chiede più stanze di quelle disponibili, il file si rifiuta (niente ripieghi).
5. **Privacy:** nessun dato personale nei commit e nei documenti (niente email personali, niente dati di pagamento). Niente strumenti di analisi delle visite e niente banner cookie. In classifica solo nickname; i guest non lasciano dati.
6. **Commit** con autore `Claude <noreply@anthropic.com>`. Pubblicare su `main` aggiorna il sito in un paio di minuti.
6bis. **Sicurezza:** le pagine hanno una CSP (`<meta http-equiv="Content-Security-Policy">`): una nuova risorsa esterna va aggiunta lì, solo se indispensabile. L'area admin richiede Access **e** l'email nel segreto `ADMIN_EMAILS` del Worker. Revisione e limiti: `docs/roadmap-server.md` §3.
7. **Verificare prima di pubblicare:** `npm test` in `server/` e le prove Playwright dell'app (`test/prova-app.py`, più telefoni, vista telefono) contro un server locale. Il modulo principale del Worker (`server/src/index.js`) può esportare solo il gestore e le classi dei Durable Object: le costanti stanno in `server/src/costanti.js`.
8. **Tenere aggiornati i documenti:** dopo ogni passo, spuntare la voce in `docs/piano.md` e nella roadmap di riferimento, con la data.
9. **Decisioni:** quelle già prese sono nelle roadmap e non si rimettono in discussione. Le scelte nuove che cambiano il gioco o i dati si chiedono a Francesco prima di svilupparle.
10. **Premessa d'uso:** l'app è per uso interno del club e **non si pubblica mai durante le partite**. Alcuni rischi sono accettati solo per questo (`piano.md`, «Considerati e lasciati così»): se la destinazione cambia, vanno ripresi prima di tutto.
11. **Dati e versioni:** una modifica alla struttura dei dati aumenta `SCHEMA` ed è solo additiva; una modifica alle classi dei Durable Object si pubblica da sola. Ogni rilascio ha un numero nuovo in `versione.js`, la sua voce in `CHANGELOG.md` e le note in `docs/rilasci/`.
