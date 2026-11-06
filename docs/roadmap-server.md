# Roadmap · Server e sessioni condivise

Scelta del servizio e sviluppo della parte online: sessioni su più dispositivi, classifica, statistiche.
L'app resta su GitHub Pages; il server gestisce solo lo stato condiviso.

Legenda: **[deciso]** concordato · **[orientamento]** preferenza emersa, da confermare · **[da decidere]** manca una scelta

---

## 1. Scelta del servizio [orientamento: Cloudflare]

| Servizio | Piano gratuito | A pagamento | Pro | Contro |
|---|---|---|---|---|
| **Cloudflare Workers + Durable Objects** | 100.000 richieste al giorno, 5 GB di spazio (SQLite) | da 5 $/mese | Una partita è un "oggetto" sul server. La logica sta lì già nel piano gratuito. Nessuna pausa per inattività. | Più codice da scrivere: la logica di gioco va fatta lato server. |
| Firebase Realtime Database | 100 connessioni simultanee, 1 GB, 10 GB al mese; senza carta di credito | a consumo (Blaze) | Il più semplice per il tempo reale e le riconnessioni. | La logica sul server (Cloud Functions) richiede il piano Blaze con carta. |
| Supabase | 2 progetti, 500 MB Postgres | 25 $/mese | Ottimo per classifiche e statistiche (SQL). | Il progetto gratuito va in pausa dopo 7 giorni di inattività. |
| Server proprio (VPS) | — | pochi €/mese | Massimo controllo. | Aggiornamenti, sicurezza e backup a carico nostro. **Sconsigliato.** |

I limiti dei piani sono quelli rilevati a novembre 2026: vanno ricontrollati al momento della scelta.

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
- **Ricomincia** azzera i contatori.

## 3. Classifica del club [da decidere]

- Si appoggia allo stesso stato condiviso delle sessioni.
- **Identità dei giocatori:** un elenco gestito dall'admin, da cui scegliere il nome a inizio partita, più l'opzione «ospite», che non entra in classifica. Niente account con login.
- **Cosa vale punti,** da decidere: esplorazioni completate, profondità, punti per livello con bonus per giro, media per partita, vittoria della partita (chiesta a fine partita).
- Classifiche separate **per esplorazione e per stagione**.
- **Partite ufficiali:** contano solo quelle create o confermate dall'admin.
- **Privacy:** soprannomi o nomi di battesimo e un avviso ai partecipanti.

## 4. Statistiche per l'autore [idea]

- Quante volte viene scelta ogni via, quali stanze vengono mostrate o scelte di più, a che livello si arriva in media.
- Sono la versione reale, con partite vere, del simulatore dell'area admin.
