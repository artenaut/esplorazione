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
| 1.6 | ✅ Prova al tavolo e correzioni: fatta insieme alla 3.11 il 6/11/2026, nessun problema. | — |

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
| 3.1 | ✅ **Worker + Durable Object** per partita, con WebSocket Hibernation API. Fatto il 6/11/2026: codice in `server/`, 8 prove automatiche, pubblicato da Workers Builds e verificato in produzione con due dispositivi. | `roadmap-server.md` §1 |
| 3.1b | ✅ **`motore.js`:** logica di gioco estratta da `index.html` in un modulo condiviso tra app e server, senza cambiare il comportamento (6/11/2026). Prove automatiche dell'app ora nel repository (`test/prova-app.py`). | `roadmap-server.md` §3bis |
| 3.2 | ✅ **Esplorazioni sul server** (6/11/2026): database D1 `esplorazione`, `GET /api/esplorazioni` senza stanze, area `/admin` dietro l'applicazione Access «Esplorazione · admin» con verifica del token nel Worker. Lowrenzia caricata dall'area admin. I testi restano anche in `index.html` finché la nuova interfaccia a sessioni non sostituisce l'app attuale (passo «Nuova interfaccia»). | `roadmap-server.md` §3 |
| 3.3 | ✅ **Creazione della partita** (6/11/2026): `POST /api/partite`, codice corto dal pianeta (es. `LWR-482`), codice master, link per il QR (il QR si disegna nell'app), copia del pianeta nella partita. | `protocollo-partita.md` §1 |
| 3.4 | ✅ **Posti e dispositivi** (6/11/2026): gettone del posto (sul server solo l'impronta), rientro automatico, il master libera i posti, posti senza dispositivo, aggiungere e togliere esplorator\* (2–4). | `protocollo-partita.md` §2–3 |
| 3.5 | ✅ **Ruoli** (6/11/2026): master (anche tabellone, più dispositivi con lo stesso codice master), esplorator\*, tabellone separato in sola lettura, ospite. Ruoli controllati sul server; lo stato condiviso non contiene mai i testi. | `protocollo-partita.md` §2–4 |
| 3.6 | ✅ **Mosse** (6/11/2026): estrazioni sul server con «meno mostrate», mosse contemporanee di persone diverse, controllo di versione **per personaggio** (conflitto solo sullo stesso personaggio, come da roadmap), testo inviato a tutti solo con la mossa di ingresso. | `protocollo-partita.md` §4 |
| 3.7 | ✅ **Annulla** (6/11/2026) solo l'ultima mossa della sessione, da chi l'ha fatta o dal master; ripristina anche i contatori. | `protocollo-partita.md` §4 |
| 3.8 | ✅ **Chiudi partita / Annulla partita** (6/11/2026) al posto di Ricomincia, con scelta tra nuovo gruppo e stesso gruppo (nuova partita creata dal server, telefoni già seduti). Con «Chiudi» il server calcola già il riepilogo per la classifica (cicli, stanze, stanze per via), senza salvarlo fino alla fase 5. Dati della partita eliminati in entrambi i casi. | `protocollo-partita.md` §5 |
| 3.9 | ✅ **Scadenza automatica** (6/11/2026) con gli allarmi del Durable Object: 6 ore senza attività, 24 ore al massimo; contano solo le azioni vere. | `protocollo-partita.md` §5 |
| 3.10 | ✅ **Sicurezza** (6/11/2026): il server valida ogni mossa e ogni ruolo (passi 3.4–3.8); limiti per indirizzo con un Durable Object «Limitatore» (il limitatore integrato di Cloudflare non bloccava in produzione): 30 tentativi di ingresso e 10 creazioni al minuto, conteggi solo in memoria, nulla salvato; verificato in produzione; controllo del codice `GET /api/partite/:codice`; informativa aggiornata (da far verificare con il 4.5). | `roadmap-server.md` §3 |
| 3.10b | ✅ **Nuova interfaccia a sessioni** (6/11/2026), pubblicata subito al posto dell'app su un solo dispositivo (scelta di Francesco): crea partita con codice, QR e codice master; ingresso dal QR o con il codice; scelta del posto e rientro automatico; tabellone; «Stai muovendo per…»; annulla con spiegazione quando non si può; gestione dei posti; chiudi o annulla partita con stesso gruppo; riconnessione automatica. Lowrenzia e la vecchia area admin sono usciti da `index.html`; il **simulatore** è nell'area admin del server. | `protocollo-partita.md` |
| 3.11 | ✅ **Prova al tavolo** (6/11/2026, insieme alla 1.6): più tavoli in contemporanea, ciascuno con più dispositivi; ingresso sia dal QR sia con il codice; classifica generata correttamente. Nessun problema segnalato. | — |

**Risultato:** ognuno gioca dal proprio telefono, le stanze restano davvero nascoste. In questa fase «Chiudi partita» chiude e basta: i dati per la classifica arrivano nella fase 5.

---

## Fase 4 · Identità e privacy

| # | Attività | Riferimento |
|---|---|---|
| 4.1 | ✅ **Guest** (6/11/2026): nome buffo scelto dal server tra 70 frasi «animale + complemento», senza aggettivi di genere; «Un altro nome»; nessun dato salvato, fuori dalla classifica. | `roadmap-classifica.md` §10 |
| 4.2 | ✅ **Nickname del club** (6/11/2026): l'esplorator\* lo sceglie dal proprio telefono dopo aver preso il posto (il master per chi non ha il telefono), dall'elenco o creandolo con disclaimer, casella dei 14 anni, casella di consenso e link all'informativa. Si salvano data del consenso, versione dell'informativa e conferma dei 14 anni. Nessun PIN (decisione del 6/11/2026). | `roadmap-classifica.md` §9 |
| 4.3 | ✅ **Informativa** (6/11/2026) pubblicata nell'app (`informativa.html`, letta da `docs/informativa-privacy.md`), collegata dalla pagina iniziale e dalla creazione del nickname. | `informativa-privacy.md` |
| 4.4 | ✅ **Moderazione admin** (6/11/2026): elenco con la prova del consenso, rinomina e cancellazione dall'area admin. | `roadmap-classifica.md` §9 |
| 4.5 | Far **verificare l'informativa** a un consulente (Francesco). Aggiornata il 6/11/2026 con la prova del consenso e il conteggio temporaneo dei tentativi. | `roadmap-classifica.md` §9 |

**Risultato:** si sa chi gioca, con dati minimi e in regola, prima di pubblicare qualsiasi classifica.

---

## Fase 5 · Classifica

| # | Attività | Riferimento |
|---|---|---|
| 5.1 | ✅ **Salvataggio alla chiusura** (6/11/2026): con «Chiudi partita» la partita va nella stagione in corso, con un risultato per nickname (cicli, stanze, stanze per via). Guest e posti mai scelti esclusi. Se il salvataggio non riesce, la partita resta aperta e il master riprova. | `roadmap-server.md` §4 |
| 5.2 | ✅ **Calcolo** (6/11/2026): generale e pianeti, spareggi in cascata, pari merito «1-2-2-4», ordine alfabetico tra pari; colonne dei pianeti dalle loro vie. | `roadmap-classifica.md` §3–4 |
| 5.3 | ✅ **Stagioni** (6/11/2026): «Stagione 1» si apre da sola; l'admin rinomina e chiude (se ne apre subito una nuova); archivio consultabile da tutti (decisione del 6/11/2026). | `roadmap-classifica.md` §6 |
| 5.4 | ✅ **Pagina pubblica** `classifica.html` (6/11/2026): stagione, generale o pianeta, riordino per colonna con posizione ufficiale fissa e «Torna alla classifica», statistiche delle vie. Cache di 60 secondi. | `roadmap-classifica.md` §5, §8 |
| 5.5 | ✅ **Area admin** (6/11/2026): partite salvate per stagione, correzione ed eliminazione dei singoli risultati e delle partite. Nickname cancellato: sparisce dalla stagione in corso, nelle stagioni archiviate diventa «Esplorator\* rimoss\*». | `roadmap-classifica.md` §9 |
| 5.6 | ✅ **QR code della classifica** (6/11/2026) nell'area admin, scaricabile in SVG per la stampa. Da appendere al club (Francesco). | — |

**Risultato:** il progetto è completo nella versione attuale.

---

## Versioni e rilasci · ⚠️ priorità alta (aggiunto il 7/11/2026)

Da fare **prima di ogni altra modifica** all'app o al server. Fino ad allora non si cambia nulla.

| # | Cosa | Note |
|---|---|---|
| V.1 | **Prima versione: 0.1.0.** È lo stato provato al tavolo il 6/11/2026: un prototipo con diverse sistemazioni ancora da fare (scelta di Francesco: non 1.0.0). | Numerazione `MAGGIORE.MINORE.CORREZIONE`: correzione = sistemazione senza cambiare il funzionamento; minore = nuova funzione; maggiore = cambiamento non compatibile (protocollo app ↔ server, formato dei pianeti). Un solo numero per app e server. |
| V.2 | **Note di rilascio della 0.1.0,** dettagliate e per chi gioca e organizza: tutte le funzionalità inserite (partite a sessioni, QR e codice, posti e rientro, master e tabellone, mosse e annulla, chiudi o annulla partita, stesso gruppo, nickname e guest, informativa, classifica e stagioni, area admin, simulatore). | Testo da concordare con Francesco prima di scriverlo. |
| V.3 | **Changelog tecnico** (`CHANGELOG.md`), più dettagliato: architettura (Worker, Durable Object, D1, Access), protocollo, limiti e sicurezza, prove automatiche, decisioni e rischi accettati. | Da concordare con Francesco. |
| V.4 | **Etichetta `v0.1.0` su GitHub** con la pagina «Release» (note di rilascio). | Punto fermo a cui tornare. |
| V.5 | **Versione visibile** nell'app (pagina iniziale) e nell'area admin; `/api/stato` restituisce la stessa versione. | Oggi il server dice «5.1» (numero delle fasi): va sostituito. |
| V.6 | **Controllo di compatibilità** tra app e server: un telefono con l'app vecchia aperta riceve «È uscita una nuova versione: ricarica la pagina». | Sito e server si pubblicano a minuti di distanza. |
| V.7 | **Ritorno a una versione precedente** documentato, anche nella guida per l'admin. **Corretto il 13/11/2026:** il ritorno vero si fa con `git revert` su `main` fino all'etichetta (mai force push), così sito e server tornano indietro insieme; Cloudflare → Deployments solo in emergenza e subito seguito dal revert, perché il push successivo su `main` lo cancella. Avvertenze: i dati non tornano indietro; si riaprono le falle corrette dopo quella versione; Cloudflare non permette il ritorno indietro oltre una migrazione dei Durable Object. | — |
| V.8 | **Protezioni dei rilasci** (revisione di sicurezza del 13/11/2026, decisioni di Francesco). Da fare **prima dell'etichetta `v0.1.0`**: vedi sotto. | `roadmap-server.md` §3, «Revisione dei rilasci» |

### Decisioni del 13/11/2026 su versioni e rilasci

- **Data della 0.1.0: 13/11/2026.** Il codice è identico a quello provato al tavolo il 6/11/2026 (nessuna modifica al codice dopo il 6/11 alle 20:48), quindi l'etichetta va sull'ultimo commit.
- **Note di rilascio:** elenco delle funzionalità diviso per pubblico (chi gioca, chi conduce la partita, chi amministra), più limiti noti del prototipo e due righe sulla privacy. **Non sono una guida:** le istruzioni stanno nella guida per il master (fase 6). Al club nessuno legge GitHub: il testo, anche in versione corta, va pure nel gruppo del club.
- **`CHANGELOG.md`:** formato «Keep a Changelog» in italiano, diviso per area. Decisioni e rischi accettati **con rimandi** alle roadmap, senza ricopiarli (due fonti divergerebbero).
- **Cosa non scrivere nelle note, nel changelog e nella Release** (il repository è pubblico): niente nickname, email, contenuto di `ADMIN_EMAILS`, testi dei pianeti; nessun file allegato alla Release (né pianeti né backup); nessuna istruzione pronta per sfruttare i rischi accettati (si rimanda a `roadmap-server.md`). La sicurezza non deve comunque dipendere dal tenere nascosta l'architettura.

**V.8 · cosa contiene** (✅ approvato da Francesco il 13/11/2026)

| # | Cosa | Chi |
|---|---|---|
| V.8a | **Numero di schema nei dati** (D1 e stato della partita nei Durable Object): un codice più vecchio dello schema che trova passa in **sola lettura** invece di scrivere dati che non conosce. Modifiche ai dati sempre solo additive. | Claude |
| V.8b | **Migrazioni dei Durable Object pubblicate da sole,** mai insieme ad altre modifiche (bloccano il ritorno indietro da Deployments). | Claude |
| V.8c | **Ruleset sulle etichette `v*`** (vietati spostamento e cancellazione) e **ruleset su `main`** (vietati force push e cancellazione del branch). | Francesco (Claude prepara i passaggi) |
| V.8d | **Release immutabili** attivate nel repository o nell'organizzazione. Attenzione: un'etichetta usata da una release immutabile non si può più riusare, nemmeno dopo averla cancellata. Quindi la release si crea **come bozza**, si ricontrolla e solo dopo si pubblica. | Francesco (Claude prepara i passaggi) |
| V.8e | **Motore e simulatore serviti dal Worker** (la copia inclusa nella sua pubblicazione) invece che da GitHub Pages; CSP dell'area admin ristretta a `'self'`. Il simulatore usa così sempre lo stesso motore del server. | Claude |
| V.8f | **Un solo file della versione** nella cartella principale, letto da app e server (e da `/api/stato`), così i due numeri non si separano. | Claude |

**Considerati e lasciati così (13/11/2026), finché vale la premessa d'uso qui sotto:**
- Ogni push su `main` ripubblica il Worker e fa cadere i WebSocket delle partite in corso, anche per i soli documenti. Niente percorsi da osservare in Workers Builds e nessuna modifica al limitatore.
- Controllo di compatibilità (V.6): non serve separare il numero di versione da un numero di protocollo.

**Premessa d'uso (Francesco, 13/11/2026):** l'app è per **uso interno del club** e **non si pubblica mai durante le partite**. Una partita rimasta aperta dopo la serata (fino a 6 ore senza attività, 24 al massimo) è da considerare **nulla**: se una pubblicazione la interrompe non si perde nulla, quindi prima di pubblicare non serve controllare che non ci siano partite aperte. Finché questa premessa vale, i due punti sopra non sono un problema concreto. **Se la destinazione cambia** (altri club, uso pubblico, partite a qualsiasi ora), vanno ripresi: percorsi da osservare in Workers Builds; limitatore che conta solo gli ingressi falliti; numero di protocollo separato dalla versione, avviso solo con un pulsante (mai ricarica automatica), tenendo conto della cache di 10 minuti di GitHub Pages.

## Backup dei dati · ⚠️ priorità alta (aggiunto il 7/11/2026)

**Ordine: si fa dopo «Versioni e rilasci»** (che ha la precedenza), prima delle nuove funzioni. Obiettivo: evitare perdite involontarie (errori dall'area admin, bug, modifiche al database) e, per quanto possibile, malevole (accesso all'area admin, all'account Cloudflare o al repository). **Attenzione:** i testi dei pianeti ora esistono solo sul server, quindi una perdita del database li cancellerebbe.

Già presente: **Time Travel di D1**, automatico, 7 giorni nel piano gratuito (ripristino che sovrascrive il database). Non protegge se l'account Cloudflare è compromesso.

| # | Cosa | Note |
|---|---|---|
| B.1 | **Copia automatica periodica** del database (per esempio ogni notte) in uno spazio di archiviazione dello stesso account Cloudflare, conservando le ultime 4–5 settimane. | Contro bug ed errori oltre i 7 giorni di Time Travel. |
| B.2 | **Copia fuori da Cloudflare:** pulsante «Scarica backup» nell'area admin, da usare con regolarità e **sempre prima di chiudere una stagione**; il file si conserva per esempio nel Drive del club. | Unica protezione se l'account Cloudflare viene compromesso. |
| B.3 | **File dei pianeti** inclusi nel backup. | — |
| B.4 | **Registro delle azioni dell'admin** (cosa è stato eliminato o modificato, quando). | Per accorgersi di azioni malevole e sapere fino a quando tornare indietro. |
| B.5 | **Prova di ripristino** periodica, descritta nella guida per l'admin. | — |
| B.6 | **Privacy dei backup:** mai nel repository (è pubblico); durata limitata, così che un nickname cancellato su richiesta sparisca anche dai backup entro qualche settimana; poche copie scaricate a mano e ordinate; una frase nell'informativa su esistenza e durata dei backup, da far verificare con il 4.5. | — |
| B.7 | **Sicurezza degli account** come prima difesa contro le perdite malevole: autenticazione a due fattori su GitHub (obbligatoria per l'organizzazione), Cloudflare e Gmail del club; pochi permessi di scrittura sul repository. | Da fare: Francesco. |

| B.8 | **Azzeramento dei dati personali con l'uscita del backup** (deciso da Francesco il 7/11/2026): si cancellano tutti i nickname e le prove del consenso; dalla classifica restano solo dati senza nomi, come statistiche di utilizzo. Con il nuovo inizio tutti accettano di nuovo l'informativa aggiornata (con i backup), creando di nuovo il nickname. | **Deciso il 7/11/2026: si conservano solo totali aggregati per pianeta e per stagione** (partite, stanze per via, esplorazioni portate a termine), nessuna riga per persona: in un club piccolo una riga per persona, anche con il nome coperto, resta riconoscibile e quindi è ancora un dato personale. Avvisare chi gioca prima dell'azzeramento. Le copie di Time Travel con i vecchi dati scadono da sole dopo 7 giorni. |

Dettagli tecnici (dove salvare, frequenza, durata) da decidere con Francesco prima di svilupparli.

---

## Fase 6 · Extra (facoltativi)

- **Statistiche per l'autore** dalle partite reali (`roadmap-server.md` §5).
- **App installabile (PWA)** con l'icona di Artenaut\* (`roadmap-app.md` §5).
- **Nuovi pianeti,** scritti nel formato v2 e bilanciati con il simulatore.
- **Guida per il master della partita** (aggiunta il 7/11/2026): **consultabile in modo facile e veloce dal telefono, anche a partita aperta** (per esempio un pulsante accanto a «Regole» e «Gestisci»), per chi crea e conduce una partita. Struttura da definire con Francesco. Contenuti: creare la partita e far entrare gli altri (QR o codice), scegliere nickname o guest per chi non ha il telefono, muovere per qualcun\*, annullare l'ultima mossa, liberare un posto se qualcun\* cambia telefono, aggiungere o togliere esplorator\*, «Chiudi partita» contro «Annulla partita», stesso gruppo, cosa fare con «Troppi tentativi» (aspettare un minuto, rete mobile invece del Wi-Fi), riprendere il ruolo di master con il codice master.
- **Guida per un futuro nuovo admin** (aggiunta il 7/11/2026): **documento tecnico e dettagliato** (in `docs/`), struttura da definire con Francesco. Contenuti: come ottenere l'accesso (email in Access **e** nel segreto `ADMIN_EMAILS`), cosa si fa nell'area admin (pianeti, simulatore, nickname, stagioni, correzioni, QR), dove si guardano i consumi su Cloudflare, come si ripristina una versione precedente del server (Deployments) e del sito (annullare il commit), cosa fare se il server non risponde, quali account servono (GitHub, Cloudflare, Gmail del club) con l'autenticazione a due fattori. Per ora l'unico admin è Francesco, che porta le serate: la guida serve quando entrerà qualcun altr\*.

---

## Decisioni ancora aperte

Da chiudere entro la fase indicata.

| Decisione | Entro | Riferimento |
|---|---|---|
| Adeguare al linguaggio inclusivo i testi delle stanze che usano termini di Magic | Quando si scrivono nuovi pianeti | `roadmap-app.md` §0 |
| App installabile (PWA) | Fase 6 | `roadmap-app.md` §5 |
