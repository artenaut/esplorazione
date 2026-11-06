# Piano di sviluppo

Visione d'insieme delle tre roadmap (`roadmap-app.md`, `roadmap-server.md`, `roadmap-classifica.md`), ordinata in fasi da affrontare una dopo l'altra.
Ogni fase si chiude con qualcosa di **utilizzabile al tavolo** e prepara la successiva.

Redatto il 6/11/2026. Quando una voce è fatta, si spunta qui e nella roadmap di riferimento.

---

## Regole valide in ogni fase

- **Linguaggio inclusivo** in tutto ciò che vedono le persone: «esplorator\*» o forme neutre (`roadmap-app.md`, punto 0).
- **Il testo di una stanza si vede solo al momento dell'ingresso,** mai tra le proposte né nel percorso.
- **Nessun dato personale nei commit,** nessuno strumento di analisi delle visite, nessun banner cookie.
- **Le esplorazioni sono dati, non codice.**

---

## Fase 0 · Fondamenta ✅ completata il 6/11/2026

Lavori brevi, quasi tutti a carico di Francesco. Vanno fatti **prima di distribuire link o QR code.**

| # | Attività | Chi | Dipende da |
|---|---|---|---|
| 0.1 | ✅ Creare l'organizzazione GitHub del club e trasferire il repository (fatto il 6/11/2026: `artenaut`) | Francesco, poi Claude aggiorna i link | — |
| 0.2 | ✅ Dominio del club: **no** per ora, si resta su `artenaut.github.io/esplorazione` (deciso il 6/11/2026). Si può aggiungere in futuro. | Francesco | 0.1 |
| 0.3 | ✅ Ospitare i caratteri nel sito, senza Google Fonts (fatto il 6/11/2026) | Claude | — |
| 0.4 | ✅ Inserire le **regole del gioco** di Lowrenzia, con l'immagine dell'astronauta (fatto il 6/11/2026) | Francesco fornisce, Claude inserisce | — |

**Risultato:** l'app attuale ha un indirizzo definitivo, regole complete e nessuna dipendenza da Google.

---

## Fase 1 · App completa su un solo dispositivo

Tutto quello che migliora il gioco senza server. È la versione stabile da usare al club mentre si prepara il resto.

| # | Attività | Riferimento |
|---|---|---|
| 1.1 | ✅ **Estrazione «meno mostrate»** (fatta il 6/11/2026): conteggio nella sessione, spareggio per giocatore, poi caso. Contatori ripristinati da Annulla e azzerati da Ricomincia. | `roadmap-app.md` §1 |
| 1.2 | ✅ **Formato dell'esplorazione v2:** vie definite nel file, mappa dei livelli anche non simmetrica, livello successivo in base alla scelta, ripiego se un pool non basta, regola di estrazione come proprietà dell'esplorazione. | `roadmap-app.md` §2 |
| 1.3 | ✅ **Convertire Lowrenzia** al formato v2, senza cambiare come si gioca. | `roadmap-app.md` §2 |
| 1.4 | ✅ **Validazione al caricamento** nell'area admin: ogni percorso arriva al finale, pool sufficienti, id unici. | `roadmap-app.md` §2 |
| 1.5 | ✅ **Simulatore** «Simula 1.000 partite» nell'area admin. | `roadmap-app.md` §3 |
| 1.6 | Prova al tavolo e correzioni. **Rimandata:** si fa appena possibile, in parallelo alla fase 2. | — |

**Risultato:** si possono scrivere e bilanciare nuovi pianeti con logiche diverse, e le stanze ruotano bene.

---

## Fase 2 · Preparazione del server ✅ completata il 6/11/2026

Decisioni e account, poco codice.

| # | Attività | Riferimento |
|---|---|---|
| 2.1 | ✅ **Cloudflare confermato** (6/11/2026). Limiti del piano gratuito ricontrollati: 100.000 richieste, 13.000 GB-s, 100.000 scritture al giorno, 5 GB di database. | `roadmap-server.md` §1 |
| 2.2 | ✅ **Account Cloudflare del club** creato (6/11/2026). Sottodominio: `artenaut.workers.dev`; il server sarà `esplorazione.artenaut.workers.dev`. | — |
| 2.3 | ✅ **Cloudflare Zero Trust** attivato, piano Free, team `artenaut` (6/11/2026). L'applicazione Access sul percorso `/admin` si crea in fase 3. | — |
| 2.4 | ✅ Decisioni chiuse il 6/11/2026: Cloudflare; **solo sessioni** (niente modalità offline); **il nickname lo crea l'esplorator\*** alla prima partita; **niente classifica locale**. | — |

---

## Fase 3 · Sessioni su più dispositivi

Il blocco più grosso. Si sviluppa e si prova a pezzi.

| # | Attività | Riferimento |
|---|---|---|
| 3.1 | **Worker + Durable Object** per partita, con WebSocket Hibernation API. | `roadmap-server.md` §1 |
| 3.2 | **Esplorazioni sul server:** i testi delle stanze escono dall'app e stanno solo lì. L'area admin le carica tramite Access. | `roadmap-server.md` §3 |
| 3.3 | **Creazione della partita:** codice corto, QR code, codice master. | `roadmap-server.md` §2 |
| 3.4 | **Posti e dispositivi:** gettone del posto, rientro automatico, liberare un posto, posti senza dispositivo. | `roadmap-server.md` §2 |
| 3.5 | **Ruoli:** master (anche tabellone), esplorator\*, tabellone separato opzionale. | `roadmap-server.md` §2 |
| 3.6 | **Mosse:** estrazioni sul server con «meno mostrate», mosse contemporanee, controllo di versione, testo inviato solo con la mossa di ingresso. | `roadmap-server.md` §2 |
| 3.7 | **Annulla** solo l'ultima mossa della sessione, da chi l'ha fatta o dal master. | `roadmap-server.md` §2 |
| 3.8 | **Chiudi partita / Annulla partita** al posto di Ricomincia, con scelta tra nuovo gruppo e stesso gruppo. | `roadmap-server.md` §2 |
| 3.9 | **Scadenza automatica:** 6 ore senza attività, 24 ore al massimo. | `roadmap-server.md` §2 |
| 3.10 | **Sicurezza:** il server valida ogni mossa e ogni ruolo, limite ai tentativi sul codice corto. | `roadmap-server.md` §3 |
| 3.11 | Prova al tavolo con più telefoni e correzioni. | — |

**Risultato:** ognuno gioca dal proprio telefono, le stanze restano davvero nascoste. In questa fase «Chiudi partita» chiude e basta: i dati per la classifica arrivano nella fase 5.

---

## Fase 4 · Identità e privacy

| # | Attività | Riferimento |
|---|---|---|
| 4.1 | **Guest** con nome buffo senza aggettivi di genere, «Un altro nome», nessun dato salvato. | `roadmap-classifica.md` §10 |
| 4.2 | **Nickname del club** con disclaimer, casella di consenso, casella dei 14 anni e link all'informativa. | `roadmap-classifica.md` §9 |
| 4.3 | **Informativa** pubblicata nell'app e collegata alla schermata del nickname. | `informativa-privacy.md` |
| 4.4 | **Moderazione admin:** rinominare e cancellare nickname. | `roadmap-classifica.md` §9 |
| 4.5 | Far **verificare l'informativa** a un consulente. | `roadmap-classifica.md` §9 |

**Risultato:** si sa chi gioca, con dati minimi e in regola, prima di pubblicare qualsiasi classifica.

---

## Fase 5 · Classifica

| # | Attività | Riferimento |
|---|---|---|
| 5.1 | **Salvataggio alla chiusura:** cicli, stanze aperte e stanze per via, per esplorator\* e pianeta, nella stagione in corso. I guest sono esclusi. | `roadmap-server.md` §4 |
| 5.2 | **Calcolo:** classifica generale e dei pianeti, spareggi in cascata, pari merito con salto delle posizioni. | `roadmap-classifica.md` §3–4 |
| 5.3 | **Stagioni:** chiusura manuale dall'admin, archivio. | `roadmap-classifica.md` §6 |
| 5.4 | **Pagina pubblica** in sola lettura, con cache, riordino per colonna e statistiche peculiari dei pianeti. | `roadmap-classifica.md` §5, §8 |
| 5.5 | **Area admin:** modificare o eliminare singoli dati, «Esplorator\* rimoss\*» negli archivi. | `roadmap-classifica.md` §9 |
| 5.6 | QR code della classifica al club. | — |

**Risultato:** il progetto è completo nella versione attuale.

---

## Fase 6 · Extra (facoltativi)

- **Statistiche per l'autore** dalle partite reali (`roadmap-server.md` §5).
- **App installabile (PWA)** con l'icona di Artenaut\* (`roadmap-app.md` §5).
- **Nuovi pianeti,** scritti nel formato v2 e bilanciati con il simulatore.

---

## Decisioni ancora aperte

Da chiudere entro la fase indicata.

| Decisione | Entro | Riferimento |
|---|---|---|
| Archivio delle stagioni consultabile e stagioni con un nome | Fase 5 | `roadmap-classifica.md` §6 |
| Adeguare al linguaggio inclusivo i testi delle stanze che usano termini di Magic | Quando si scrivono nuovi pianeti | `roadmap-app.md` §0 |
| App installabile (PWA) | Fase 6 | `roadmap-app.md` §5 |
