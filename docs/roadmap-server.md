# Roadmap · Server e sessioni condivise

Scelta del servizio e sviluppo della parte online: sessioni su più dispositivi, classifica, statistiche.
L'app resta su GitHub Pages; il server gestisce solo lo stato condiviso.

Legenda: **[deciso]** concordato · **[orientamento]** preferenza emersa, da confermare · **[da decidere]** manca una scelta

---

## 1. Scelta del servizio ✅ Cloudflare, confermato il 6/11/2026

- **Solo sessioni:** quando arriva il server, la modalità attuale su un solo dispositivo viene sostituita. Chi gioca da un solo telefono crea una sessione e il master muove per tutti.
- **Indirizzo:** `esplorazione.artenaut.workers.dev` (sottodominio del club `artenaut.workers.dev`, niente dominio).
- **Zero Trust:** team `artenaut`, piano Free. Pannello di accesso: `artenaut.cloudflareaccess.com`.
- **Area admin:** servita dal Worker stesso sul percorso `/admin`, protetta da un'applicazione Access *self-hosted* limitata a quel percorso. Il resto (partite, WebSocket, classifica pubblica) resta fuori da Access. Nota: la protezione «di tutto il Worker» con un clic non va usata, perché bloccherebbe anche i WebSocket delle partite.
- **Pubblicazione del codice:** Cloudflare Workers Builds collegato al repository GitHub `artenaut/esplorazione`, così ogni modifica pubblicata su GitHub aggiorna il server da sola.
- **Limiti del piano gratuito ricontrollati il 6/11/2026:** 100.000 richieste, 13.000 GB-s, 5 milioni di letture e 100.000 scritture al giorno, 5 GB di database SQLite.


| Servizio | Piano gratuito | A pagamento | Pro | Contro |
|---|---|---|---|---|
| **Cloudflare Workers + Durable Objects** | 100.000 richieste al giorno, 5 GB di spazio (SQLite) | da 5 $/mese | Una partita è un "oggetto" sul server. La logica sta lì già nel piano gratuito. Nessuna pausa per inattività. | Più codice da scrivere: la logica di gioco va fatta lato server. |
| Firebase Realtime Database | 100 connessioni simultanee, 1 GB, 10 GB al mese; senza carta di credito | a consumo (Blaze) | Il più semplice per il tempo reale e le riconnessioni. | La logica sul server (Cloud Functions) richiede il piano Blaze con carta. |
| Supabase | 2 progetti, 500 MB Postgres | 25 $/mese | Ottimo per classifiche e statistiche (SQL). | Il progetto gratuito va in pausa dopo 7 giorni di inattività. |
| Server proprio (VPS) | — | pochi €/mese | Massimo controllo. | Aggiornamenti, sicurezza e backup a carico nostro. **Sconsigliato.** |

I limiti dei piani sono quelli rilevati a novembre 2026: vanno ricontrollati al momento della scelta.

- **Account del club:** l'account Cloudflare va intestato al club (Artenaut\*, artenautspaceship@gmail.com), non a una persona, come il repository nell'organizzazione GitHub (vedi `roadmap-app.md`, punto 0).

### Stima del carico su Cloudflare (indicativa)
- Una serata: 4 telefoni più 1 tablet, circa 3 ore, circa 100 mosse. Risultato: **~150 richieste**, contro 100.000 al giorno.
- Ogni connessione WebSocket vale 1 richiesta, più 1 per il Worker. I messaggi in arrivo contano 1 richiesta ogni 20. I messaggi in uscita e i ping sono gratuiti.
- **Obbligatorio usare la WebSocket Hibernation API.** Senza, una partita di 3 ore consuma circa 1.350 GB-s (limite gratuito 13.000 GB-s al giorno). Con l'API, il consumo è praticamente zero.
- Se un limite viene superato, le operazioni falliscono fino alla mezzanotte UTC: niente costi a sorpresa.

## 2. Sessioni su più dispositivi [deciso il 6/11/2026]

- Chi organizza crea la partita, sceglie l'esplorazione e ottiene un **codice corto e un QR code**.
- Ogni giocatore entra dal proprio telefono e sceglie il proprio posto.
- Le mosse compaiono subito su tutti i dispositivi.
- **Riconnessione:** chi perde la connessione o manda il telefono in standby rientra con il codice e ritrova tutto com'era.

### Ruoli
- **Master:** il dispositivo di chi crea la sessione. **Di default fa anche da tabellone:** vede il percorso di tutti i giocatori, come l'app attuale. Può:
  - muovere per qualsiasi giocatore;
  - annullare;
  - ricominciare e chiudere la sessione;
  - aggiungere o togliere giocatori;
  - liberare un posto.

  Alla creazione riceve un **codice master**: se il suo dispositivo si spegne, un altro dispositivo può prenderne il ruolo.
- **Giocatore:** un dispositivo legato a un solo posto. Muove solo il proprio personaggio e annulla solo la propria mossa, con le regole sotto.
- **Tabellone separato: opzionale, non previsto di default.** È un dispositivo aggiuntivo in sola lettura, per esempio un tablet al centro del tavolo, che si collega solo se qualcuno lo vuole.

### Posti e dispositivi
- Entrando con il codice, il dispositivo sceglie un posto libero. Il posto resta suo, e il dispositivo se lo ricorda: riaprendo l'app rientra da solo.
- Un posto occupato non può essere preso da un altro dispositivo. Per cambiare telefono, il master **libera** il posto.
- Un giocatore senza telefono è un posto "senza dispositivo": muove il master per lui.
- Quando il master muove per qualcun altro, l'app lo dice chiaramente: «Stai muovendo per Giulia».

### Turni e mosse contemporanee
- Nessun ordine fisso né blocco dei turni. Lo stesso giocatore può muovere più volte di fila, e giocatori diversi possono muovere nello stesso istante. Il Durable Object esegue le mosse una alla volta.
- **Conflitto sullo stesso personaggio** (giocatore e master insieme): ogni mossa porta la versione dello stato da cui parte. Se lo stato è cambiato nel frattempo, la mossa viene rifiutata con il messaggio «Giulia ha già mosso, ecco la situazione aggiornata».

### Annulla mossa
- Si può annullare **solo l'ultima mossa della sessione**, perché annullarne una più vecchia renderebbe incoerenti i contatori della regola «meno mostrate».
- Può annullarla chi l'ha fatta, oppure il master.
- Se nel frattempo ha mosso qualcun altro, il pulsante è disattivato e spiega il motivo.
- L'annullamento ripristina anche i contatori.

### Visibilità: si sceglie la soluzione più economica
Al tavolo i giocatori leggono comunque ad alta voce le stanze proposte, quindi la privacy è indifferente. Il criterio è quello di scrivere meno codice e fare meno chiamate:
- **Stato della partita uguale per tutti:** dopo ogni mossa il server invia lo stesso aggiornamento a tutti i dispositivi collegati, senza filtri per dispositivo né richieste separate. Tutti vedono le proposte, le stanze in cui si entra e la cronologia.
- **Il testo di una stanza non viene mai mostrato prima di entrarci**, nemmeno se nella sessione quella stanza è già stata visitata, da quel giocatore o da altri. Tra le proposte compaiono solo titolo e via: chi l'ha già vista deve ricordarsela. (Deciso il 6/11/2026.)
  - Il server invia il testo solo nell'aggiornamento della mossa con cui un giocatore entra nella stanza. Non costa chiamate in più.
  - Le stanze proposte nello stato della partita non portano mai il testo, neanche se il dispositivo lo ha già ricevuto in precedenza.
  - Nel percorso e nella cronologia, su tutti i dispositivi, resta solo il **titolo** delle stanze già visitate. Lo stato della partita non contiene mai i testi: il testo arriva una sola volta, con la mossa di ingresso, e il dispositivo lo mostra solo in quel momento.
- Le selezioni prima di confermare restano solo sul dispositivo e non vengono inviate al server.

### Logica lato server
- **Estrazioni sul server,** con la regola «meno mostrate» (vedi `roadmap-app.md`, punto 1). I contatori sono nello stato della partita.
- Ogni nuova partita parte con i contatori azzerati.

### Chiusura della partita [deciso il 6/11/2026]
Una partita che non arriva in fondo si annulla: **in classifica entrano solo le partite concluse.** Le partite non continuano in una serata successiva, quindi non serve un «sospendi e riprendi».

Due pulsanti, riservati al master, sostituiscono «Ricomincia»:
- **Chiudi partita:** conclude la partita e **salva** i dati per la classifica e le statistiche.
- **Annulla partita:** chiude la partita **senza salvare nulla.** Tutti i dati della partita vengono eliminati.

Entrambi chiedono prima una conferma. Poi chiedono come proseguire:
- **tornare alla schermata iniziale**, per inserire nuovi giocatori;
- oppure **iniziare subito una nuova partita con gli stessi giocatori.**

**Scadenza automatica per inattività:**
- la partita viene eliminata dopo **6 ore senza attività**, e comunque **24 ore dopo la creazione**;
- contano come attività solo le azioni vere: mosse, annullamenti, ingresso di un giocatore. Un dispositivo collegato o in standby non tiene viva la partita;
- alla scadenza si elimina **tutto ciò che non è stato concluso**, senza salvare nulla, come con «Annulla partita». Il codice corto torna libero.

## 3. Sicurezza [deciso il 6/11/2026]

### Area admin protetta da Cloudflare Access
- Con il server, la password controllata nella pagina non protegge più nulla: chiunque potrebbe chiamare il server direttamente. **La protezione deve stare sul server.**
- Si usa **Cloudflare Access (Zero Trust)** davanti alle pagine e a tutte le chiamate dell'area admin. Non va scritto codice di autenticazione. Si entra con email e codice monouso, oppure con un account Google. Il piano gratuito copre fino a 50 utenti.
- **Amministratore unico: Francesco.** La regola di Access ammette solo la sua email.
- Il Worker verifica comunque il token di Access su ogni chiamata admin, così una chiamata che aggira Access viene rifiutata.
- Sono operazioni admin, quindi protette:
  - caricare, modificare, rimuovere **e leggere** le esplorazioni (i testi delle stanze stanno solo sul server);
  - gestire l'elenco dei giocatori del club;
  - **modificare o eliminare a mano i singoli dati salvati** delle partite concluse, cioè le singole partite e i singoli risultati in classifica;
  - chiudere la stagione in corso e aprirne una nuova.
- La schermata con password nella pagina può restare come comodità, ma non è più la protezione.

### Il server non si fida dei dispositivi
- Il server rifiuta una mossa verso una stanza che non è tra quelle proposte a quel giocatore.
- Il server rifiuta una mossa su un personaggio di cui il dispositivo non occupa il posto, salvo che a farla sia il master.
- Annulla, ricomincia e la gestione dei posti vengono controllati sul server in base al ruolo, non sull'interfaccia.

### Codici e gettoni delle sessioni
- **Codice master e gettone del posto** (quello che lega un dispositivo a un giocatore): sono casuali e lunghi, generati dal server e validi solo per quella partita.
- **Codice corto della partita** (es. `LWR-482`): è indovinabile per tentativi, quindi:
  - va limitato il numero di tentativi di ingresso per dispositivo;
  - la partita **scade da sola**: 6 ore senza attività, 24 ore al massimo dalla creazione (vedi «Chiusura della partita»).

  Il danno possibile è piccolo, perché si entra solo in una partita da tavolo, ma il limite costa poco.

  ✅ Fatto il 6/11/2026 (passo 3.10): Durable Object «Limitatore», uno per impronta dell'indirizzo IP, che conta in memoria i tentativi dell'ultimo minuto senza salvare nulla (il limitatore integrato di Cloudflare, provato prima, in produzione non bloccava). 30 tentativi di ingresso al minuto (controllo del codice e WebSocket) e 10 creazioni di partite al minuto. Il limite è largo perché al club i telefoni condividono lo stesso Wi-Fi.

### Finché il server non c'è
- Con l'app attuale e le esplorazioni incorporate, la password nella pagina resta sufficiente come «anti-pasticcio».

### Revisione dei rilasci (13/11/2026)
Analisi di sicurezza dei cambiamenti «Versioni e rilasci» (`piano.md`, V.1–V.8), prima di qualsiasi modifica. Nessuna falla critica. Decisioni di Francesco:
1. **Ritorno indietro** (approvato): `git revert` su `main` e non Deployments, che il push successivo cancella; numero di schema con sola lettura per il codice più vecchio; migrazioni dei Durable Object pubblicate da sole. Il ritorno indietro riporta il codice, **non i dati**, e riapre le falle corrette dopo quella versione.
2. **Pubblicare fa cadere le partite in corso** (ogni push su `main` riavvia i Durable Object; un rientro di massa dal Wi-Fi del club può superare i 30 ingressi al minuto): **lasciato così**, perché non si pubblica mai durante le partite.
3. **Controllo di compatibilità** (cache di 10 minuti di GitHub Pages, ricariche ripetute): **lasciato così**, per lo stesso motivo. La versione mandata dal telefono resta solo un'informazione, mai un permesso.
4. **Etichette e Release modificabili** (approvato): ruleset su `v*` e su `main`, release immutabili create prima come bozza.
5. **Note, changelog e Release** (approvato): niente dati personali, testi dei pianeti o allegati; i rischi accettati si richiamano senza ripeterli.
6. **Motore caricato da GitHub Pages nell'area admin** (approvato): si serve dal Worker, CSP ristretta a `'self'`. Il guadagno è soprattutto la coerenza delle versioni: chi può pubblicare su `main` controlla già anche il Worker.

Già a posto: nessuna dipendenza a runtime nel Worker, `package-lock.json` nel repository (una versione etichettata si ricostruisce identica), nessun segreto nel repository.

**Premessa d'uso:** uso interno del club, nessuna pubblicazione durante le partite. Se cambia, vanno ripresi i punti 2 e 3 (dettagli in `piano.md`, «Considerati e lasciati così»).

### Rilasci, schema dei dati e ritorno indietro (V.7, V.8a, V.8b · 13/11/2026)

**Versione:** un solo numero per app e server, in `versione.js` (cartella principale). Il server lo dice in `/api/stato` e nel messaggio `benvenuto`; l'app lo mostra in fondo alla pagina iniziale e avvisa con «Ricarica» se è diverso dal suo.

**Schema dei dati (V.8a).** `SCHEMA` in `server/src/costanti.js` è il numero di schema che il codice conosce; D1 conserva il suo nella tabella `meta` (chiave `schema`) e ogni partita nel campo `schema` del proprio stato.
- Una versione che **cambia la struttura dei dati** (D1 o stato delle partite) aumenta `SCHEMA` di 1, fa solo modifiche **additive** (tabelle o colonne nuove, mai cancellare o rinominare) e scrive la migrazione in `preparaSchema` (`server/src/esplorazioni.js`), prima dell'aggiornamento del numero.
- Se il codice trova dati più nuovi di lui (dopo un ritorno indietro) passa in **sola lettura**: regole in `piano.md`, «Sola lettura».
- **Limite:** la protezione c'è solo dalla 0.2.0 in poi. La 0.1.0 non conosce il numero di schema: tornare alla 0.1.0 dopo un cambio di schema non è protetto.

**Migrazioni dei Durable Object (V.8b).** Una modifica alle classi dei Durable Object (`migrations` in `server/wrangler.jsonc`: classi nuove, rinominate o tolte) **si pubblica da sola**, in una versione che contiene solo quella modifica. Dopo una migrazione Cloudflare non permette più il ritorno indietro da Deployments alle versioni precedenti.

**Ritorno a una versione precedente (V.7).** Mai durante una partita.
1. **Procedura normale (sito e server insieme):** su `main`, annullare con `git revert` i commit successivi all'etichetta della versione a cui tornare (per esempio `git revert --no-commit v0.1.0..HEAD`, poi un commit «Ritorno alla 0.1.0») e fare push. GitHub Pages e Workers Builds ripubblicano entrambi. Il push forzato è bloccato dalla ruleset su `main`, ed è giusto così: la cronologia non si riscrive.
2. **Solo in emergenza (server):** Cloudflare → Workers → `esplorazione` → Deployments → scegliere la versione → Rollback. Vale solo per il server e **il primo push su `main` lo cancella**: subito dopo va fatta la procedura 1.
3. **Dopo:** controllare `/api/stato` e la versione in fondo alla pagina iniziale.
4. **Cosa non torna indietro:** i dati (D1 e partite in corso) e i segreti. Tornando indietro si riaprono anche le falle corrette dopo quella versione: controllare `CHANGELOG.md`.
5. La correzione di un problema esce sempre con un **numero nuovo**: le etichette delle release sono immutabili e non si spostano.

## 3bis. Architettura del server [deciso il 6/11/2026]

- **Durable Object `Partita`,** uno per sessione, con WebSocket Hibernation API e SQLite. Contiene lo stato della partita, i contatori «meno mostrate», i posti, i gettoni e l'ultima mossa annullabile. La scadenza usa gli allarmi del Durable Object.
- **Dati permanenti su D1:** esplorazioni con i testi delle stanze, e nelle fasi successive nickname, partite concluse e stagioni. Limiti gratuiti ricontrollati il 6/11/2026: 5 milioni di righe lette e 100.000 scritte al giorno, 5 GB in tutto, fino a 10 database. Superato un limite giornaliero, le query falliscono fino alle 00:00 UTC.
- **`motore.js`:** la logica di gioco (controllo del formato, estrazioni, livello successivo) sta in un modulo condiviso tra app e server. ✅ Estratto da `index.html` il 6/11/2026 senza cambiare il comportamento (prove Playwright uguali prima e dopo; prove anche nel runtime dei Worker).
- **Codice del server nella cartella `server/`** del repository, pubblicato da Workers Builds a ogni push su `main`. ✅ Collegato e funzionante dal 6/11/2026 (passo 3.1).
- **Testi di Lowrenzia:** sono già pubblici nella cronologia del repository, che deve restare pubblico per GitHub Pages. **Si accetta** (opzione 1): l'app non li contiene più, la cronologia non viene riscritta, e il file del pianeta non entra nel repository ma si carica dall'area admin. I pianeti futuri nascono solo sul server.

### Passo 3.2 completato il 6/11/2026
- **D1** `esplorazione`, creato automaticamente da wrangler alla prima pubblicazione; la tabella `esplorazioni` la crea il Worker alla prima richiesta.
- **Elenco pubblico** `GET /api/esplorazioni`: id, nome, descrizione, vie e regole. Mai stanze, titoli o testi. Cache di 60 secondi.
- **Area `/admin`:** applicazione Access self-hosted «Esplorazione · admin» sul percorso `esplorazione.artenaut.workers.dev/admin`, policy «Solo admin» (solo l'email di Francesco). Il Worker verifica firma, emittente, AUD e scadenza del token; le modifiche richiedono anche l'intestazione `X-Richiesta: admin` (CSRF). Funzioni: elenco, lettura completa, caricamento con `validateModule`, rimozione.
- **Lowrenzia** caricata da Francesco dall'area admin. La versione sul server può differire da quella in `index.html` (deciso il 6/11/2026: le modifiche ai testi si fanno solo sul server; l'app attuale resta com'è finché non viene sostituita dall'interfaccia a sessioni).

### Revisione di sicurezza del 6/11/2026
Nessuna falla critica (verificati: token di Access, CSRF, query parametrizzate, escape HTML, codici casuali salvati come impronta, ruoli e testi lato server, nessun segreto nel repository). Correzioni applicate:
1. **WebSocket:** al massimo 30 messaggi ogni 10 secondi per connessione (oltre, la connessione si chiude) e 20 connessioni per partita, contro chi vuole esaurire la quota gratuita.
2. **IPv6:** i limiti contano per blocco /64, non per singolo indirizzo.
3. **Nuovi nickname:** al massimo 5 ogni 10 minuti per rete (oltre agli 8 per partita). Il Worker passa alla partita solo l'impronta della rete, scartando quella eventualmente mandata dal dispositivo.
4. **Elenco dei nickname non più pubblico:** lo riceve solo chi ha un posto in una partita, o il master.
5. Le chiavi di Access si riscaricano al massimo una volta al minuto.
6. Richieste CORS preliminari solo per `/api/`.
7. **CSP** nelle pagine dell'app: connessioni solo verso il server del club.
8. Nome utente personale tolto da `roadmap-app.md` (6/11/2026). Resta nella cronologia dei commit, che non viene riscritta.
9. **Immagine delle regole solo dalla cartella `img/`** del sito, niente indirizzi esterni.
10. **Secondo controllo dell'area admin:** il Worker ammette solo le email del segreto `ADMIN_EMAILS` (impostato nel pannello Cloudflare, mai nel repository). Senza il segreto, la pagina admin mostra un avviso. ✅ Segreto impostato da Francesco il 6/11/2026 (Settings → Runtime variables and secrets, tipo Secret; non nella sezione Builds).

Non cambiato, per scelta: codice della partita a 3 cifre.

**Seconda revisione (6/11/2026): rischi noti, lasciati così per scelta di Francesco.**
- La classifica si può alterare da remoto con partite finte chiuse con «Chiudi partita»: rimedio dall'area admin (partite salvate modificabili ed eliminabili). Possibili protezioni future: durata minima della partita, limite di partite salvate per rete, codice del club.
- `GET /api/classifica` e l'elenco dei nickname leggono D1 a ogni richiesta (possibile consumo delle letture gratuite). Rimedio futuro: cache in memoria di un minuto.
- Manca `X-Content-Type-Options: nosniff` sulle risposte dell'API pubblica.
- Raccomandato a Francesco: autenticazione a due fattori su GitHub (obbligatoria per l'organizzazione), Cloudflare e Gmail del club.
- Al club i telefoni condividono il Wi-Fi, quindi un solo indirizzo: con 4 o più tavoli che iniziano nello stesso minuto si può superare il limite di 30 ingressi al minuto. Lasciato così (7/11/2026): se succede, si aspetta un minuto, si muove dal telefono del master oppure chi gioca usa la rete mobile invece del Wi-Fi.
- Stima dei consumi (7/11/2026): una serata con 4 tavoli usa meno del 5% dei limiti gratuiti giornalieri (al massimo circa il 40% del tempo attivo dei Durable Object, nel caso peggiore).

## 4. Classifica del club [deciso il 6/11/2026]

**Regole di calcolo e visualizzazione: vedi `roadmap-classifica.md`.** Qui restano solo gli aspetti lato server.

- Si appoggia allo stesso stato condiviso delle sessioni.
- **Entrano in classifica solo le partite concluse con «Chiudi partita»** del master. Le partite annullate o scadute non lasciano traccia.
- **Identità dei giocatori:** un elenco di **nickname** del club, da cui scegliere a inizio partita, più l'opzione **guest** con nome buffo generato, che non entra in classifica. Niente account con login. Dettagli in `roadmap-classifica.md`, punti 9 e 10.
- **Admin:** modifica o elimina a mano i singoli dati salvati. Non conferma le partite.
- **Dati da salvare alla chiusura,** per ogni giocatore e per ogni pianeta: cicli completati, stanze aperte e stanze aperte per via o categoria. Da questi si calcolano tutte le classifiche.
- **Privacy:** solo nickname, con consenso, casella dei 14 anni e informativa breve. I dati dei guest non vengono mai salvati oltre la partita. Dettagli in `roadmap-classifica.md`, punto 9.
- **Classifica pubblica:** una lettura in sola lettura dei totali per stagione, fuori da Cloudflare Access. I risultati possono stare in cache per qualche minuto, così le visite non pesano sul limite giornaliero di richieste.
- **Stagioni:** ogni partita conclusa viene salvata con la stagione in corso. La chiusura della stagione è un'operazione admin.

✅ **Fatto il 6/11/2026 (fase 5):** tabelle D1 `stagioni`, `partite`, `risultati`; salvataggio alla chiusura dal Durable Object; `GET /api/classifica` pubblico; stagioni, correzioni e QR nell'area admin.

## 5. Statistiche per l'autore [idea]

- Quante volte viene scelta ogni via, quali stanze vengono mostrate o scelte di più, a che livello si arriva in media.
- Sono la versione reale, con partite vere, del simulatore dell'area admin.
