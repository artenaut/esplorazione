# Ripartenza · Fase 3 (sessioni su più dispositivi)

Documento di passaggio scritto il 6/11/2026 alla fine della sessione che ha completato le fasi 0, 1 e 2.
Da leggere insieme a `CLAUDE.md`, `docs/piano.md` e `docs/roadmap-server.md`.

---

## 1. Stato del progetto

| Fase | Stato |
|---|---|
| 0 · Fondamenta | ✅ Organizzazione GitHub `artenaut`, niente dominio, caratteri nel sito, regole di Lowrenzia con immagine |
| 1 · App su un solo dispositivo | ✅ Estrazione «meno mostrate», formato 2, Lowrenzia convertita, controlli al caricamento, simulatore. **1.6 (prova al tavolo) rimandata** |
| 2 · Preparazione del server | ✅ Cloudflare confermato, account del club, sottodominio `artenaut.workers.dev`, Zero Trust Free (team `artenaut`), decisioni aperte chiuse |
| 3 · Sessioni su più dispositivi | **Da iniziare** |
| 4 · Identità e privacy | Da fare |
| 5 · Classifica | Da fare |

Decisioni della fase 2 da tenere presenti:
- **Solo sessioni:** quando arriva il server, la modalità attuale su un solo dispositivo viene sostituita. Chi gioca da un solo telefono crea una sessione e il master muove per tutti.
- **Il nickname lo crea l'esplorator\*** alla prima partita (fase 4).
- **Niente classifica locale.**

---

## 2. Prime cose da fare nella nuova sessione

1. **Verificare la rete:**
   - `npm view wrangler version` deve funzionare (npm consentito);
   - `esplorazione.artenaut.workers.dev` e `artenaut.github.io` devono essere raggiungibili, se Francesco li ha aggiunti ai domini consentiti.

   Se qualcosa è bloccato, dirlo subito a Francesco con il nome esatto del dominio.
2. **Rileggere** `docs/roadmap-server.md` (sezioni 1–3) e `docs/formato-esplorazione.md`.
3. **Presentare a Francesco la proposta di architettura** (punto 3 qui sotto) in poche righe, e chiedere conferma prima di scrivere codice. È una scelta tecnica, ma decide dove stanno i dati.

---

## 3. Architettura (confermata da Francesco il 6/11/2026, con D1)

### Struttura del repository
```
index.html          app (resta su GitHub Pages)
motore.js           NUOVO: logica condivisa tra app e server (validateModule, compile,
                    drawOffer, pickRooms, nextOfNode), come modulo ES
fonts/  img/  docs/
server/
  wrangler.jsonc    configurazione del Worker «esplorazione»
  src/index.js      Worker: API pubblica, area /admin, instradamento verso le partite
  src/partita.js    Durable Object «Partita» (SQLite), uno per sessione
  test/             prove con Vitest + @cloudflare/vitest-pool-workers
```

### Componenti
- **Durable Object `Partita`,** uno per sessione, con **WebSocket Hibernation API** (obbligatoria: vedi la stima del carico nella roadmap del server). Contiene lo stato della partita, i contatori «meno mostrate», i posti, i gettoni, la cronologia per l'annullamento. Esegue le mosse una alla volta. **Scadenza con gli allarmi del Durable Object:** 6 ore senza attività, 24 ore al massimo.
- **Dati permanenti** (esplorazioni con i testi delle stanze, e nelle fasi successive nickname, partite concluse, stagioni):
  - **proposta:** un database **D1**, comodo per le query della classifica;
  - **alternativa:** un Durable Object «Archivio» con SQLite.

  **Ricontrollare i limiti gratuiti di D1 prima di scegliere.**
- **I testi delle stanze escono da `index.html`** e stanno solo sul server. L'app riceve l'elenco delle esplorazioni senza testi; il testo di una stanza arriva solo con la mossa di ingresso.
- **Area admin servita dal Worker su `/admin`,** protetta da un'applicazione Cloudflare Access **self-hosted limitata al percorso** `esplorazione.artenaut.workers.dev/admin`, che ammette solo l'email di Francesco. Il Worker verifica comunque l'identità (`ctx.access` o l'header `Cf-Access-Jwt-Assertion`). **Non usare** la protezione «di tutto il Worker», che blocca i WebSocket.
- **Pubblicazione:** Cloudflare **Workers Builds** collegato al repository `artenaut/esplorazione`, con cartella radice `server/`. Ogni push su `main` aggiorna il server. Francesco deve collegare il repository dal pannello Cloudflare (Workers & Pages → Create application → Import a repository): guidarlo passo per passo.

### API (bozza)
| Metodo e percorso | A cosa serve |
|---|---|
| `GET /api/esplorazioni` | Elenco pubblico dei pianeti: nome, descrizione, vie, regole, immagine. **Senza i testi delle stanze.** |
| `POST /api/partite` | Crea una partita. Restituisce il codice corto (es. `LWR-482`) e il codice master. |
| `GET /api/partite/:codice/ws` | WebSocket della partita. Messaggi: occupa un posto, mossa, annulla, chiudi o annulla la partita, libera un posto. |
| `/admin/...` | Interfaccia e API dell'area admin (dietro Access). |

---

## 4. Ordine di lavoro suggerito

Riprende la tabella della fase 3 in `docs/piano.md`.

1. **3.1** Scheletro del Worker e del Durable Object, pubblicazione di prova («hello») tramite Workers Builds. Francesco collega il repository.
2. **Estrarre `motore.js`** dall'app senza cambiare il comportamento. Rieseguire le prove della fase 1.
3. **3.2** Esplorazioni sul server: Lowrenzia caricata nel database, `GET /api/esplorazioni`, area `/admin` con Access (guidare Francesco nella creazione dell'applicazione Access).
4. **3.3–3.5** Creazione della partita, codice e QR, posti e gettoni, ruoli (il master fa anche da tabellone; tabellone separato opzionale).
5. **3.6–3.7** Mosse sul server con «meno mostrate», controllo di versione per le mosse contemporanee, annulla solo l'ultima mossa della sessione.
6. **3.8–3.9** Chiudi o annulla partita al posto di Ricomincia, scadenza automatica.
7. **3.10** Controlli di sicurezza: validazione di ogni mossa e ruolo, limite ai tentativi sul codice corto.
8. ✅ **Nuova interfaccia dell'app** basata sulle sessioni (6/11/2026).
9. **3.11** Prova al tavolo con più telefoni (Francesco).

Dopo ogni passo: prove automatiche, voce spuntata in `docs/piano.md` e nella roadmap, poi pubblicazione.

---

## 5. Cose da non dimenticare

- La **prova al tavolo della fase 1 (1.6)** si fa insieme alla 3.11, nella sessione di test dedicata (deciso il 6/11/2026).
- La **regola del linguaggio inclusivo** vale anche per i messaggi d'errore del server mostrati nell'app.
- **Classifica (fase 5):** alla chiusura della partita vanno salvati cicli completati, stanze aperte e stanze per via. Conviene prevedere già la struttura dei dati nella fase 3, anche se il salvataggio si attiva in fase 5.
- **Nessun dato personale** nel repository, nei documenti e nei commit.
