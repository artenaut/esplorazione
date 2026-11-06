# Registro dell'esplorazione · istruzioni per Claude

Web app di supporto al gioco **Artenaut\* Magic Exploration Companion**: tiene traccia del percorso di 2–4 persone nelle stanze di un pianeta (un'«esplorazione») durante partite di Magic: The Gathering.
Committente e unico amministratore: **Francesco**, per il club **Artenaut\***. Si lavora e si scrive **in italiano**.

## Dove sta cosa

| Cosa | Dove |
|---|---|
| App pubblicata | https://artenaut.github.io/esplorazione/ (GitHub Pages, branch `main`, cartella principale) |
| Repository | `artenaut/esplorazione` (organizzazione GitHub del club) |
| Server (fase 3) | https://esplorazione.artenaut.workers.dev · codice in `server/` · pubblicato da Workers Builds a ogni push su `main` · account Cloudflare del club · Zero Trust team `artenaut` |
| Anteprima in claude.ai | https://claude.ai/artifact/WPk2xdyAkrgY2yM4sbjtg3 (va ripubblicata con lo stesso URL dopo ogni modifica dell'app) |
| **Piano di lavoro a fasi** | `docs/piano.md` ← **partire sempre da qui** |
| Decisioni dettagliate | `docs/roadmap-app.md`, `docs/roadmap-server.md`, `docs/roadmap-classifica.md` |
| Formato dei pianeti | `docs/formato-esplorazione.md` (formato 2) |
| Informativa privacy | `docs/informativa-privacy.md` |

L'app è **`index.html`** (CSS e interfaccia inline, script come modulo ES) più **`motore.js`**, `fonts/` (caratteri ospitati nel sito, niente Google Fonts) e `img/` (immagine delle regole).
**`motore.js` è condiviso tra app e server** (modulo ES senza DOM né localStorage): `validateModule` (controllo del formato 2, con `idRiservati`), `compile`, `drawOffer` / `pickRooms` (estrazione «meno mostrate»), `nextOfNode`, `simulate` (simulatore nell'area admin). Una modifica al motore cambia il gioco su entrambi i lati.
**Prove:** `python3 test/prova-app.py` (Playwright, app) e `cd server && npm test` (Vitest, server e motore). Stato della partita in `localStorage` (`dungeon.state`). Password dell'area admin predefinita: `dungeon`.

## Regole permanenti

1. **Linguaggio inclusivo** in tutto ciò che vedono le persone: «esplorator\*» o forme neutre («chi gioca», «chi amministra»). Forme neutre quando sono naturali, asterisco quando la forma neutra è artificiosa (es. «un\* avversari\*»). I termini di gioco di Magic nei testi delle stanze restano come sono.
2. **Il testo di una stanza si vede solo nel momento in cui si entra.** Mai tra le proposte, mai nel percorso o nella cronologia, nemmeno se la stanza è già stata visitata.
3. **Lunghezza del percorso nascosta:** si mostra solo il passo attuale («Passo 3»), mai il totale.
4. **Le esplorazioni sono dati, non codice.** Nessuno script nei file dei pianeti. Se una regola chiede più stanze di quelle disponibili, il file si rifiuta (niente ripieghi).
5. **Privacy:** nessun dato personale nei commit e nei documenti (niente email personali, niente dati di pagamento). Niente strumenti di analisi delle visite e niente banner cookie. In classifica solo nickname; i guest non lasciano dati.
6. **Commit** con autore `Claude <noreply@anthropic.com>`. Pubblicare su `main` aggiorna il sito in un paio di minuti.
7. **Verificare prima di pubblicare:** prove automatiche con Playwright (preinstallato, `test/prova-app.py`) su partita, estrazione, controlli del formato e vista telefono, più `npm test` in `server/` quando si tocca il server o `motore.js`.
8. **Tenere aggiornati i documenti:** dopo ogni passo, spuntare la voce in `docs/piano.md` e nella roadmap di riferimento, con la data.
9. **Decisioni:** quelle già prese sono nelle roadmap e non si rimettono in discussione. Le scelte nuove che cambiano il gioco o i dati si chiedono a Francesco prima di svilupparle.
