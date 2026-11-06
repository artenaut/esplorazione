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
| 1.6 | Prova al tavolo e correzioni. **Unita alla 3.11** (deciso il 6/11/2026): non c'è tempo per una prova separata, si prova tutto insieme nella sessione di test dedicata. | — |

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
| 3.11 | Prova al tavolo con più telefoni e correzioni, **insieme alla prova della fase 1 (1.6)**, nella sessione di test dedicata. | — |

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
