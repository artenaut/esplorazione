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

## 2. Sessioni su più dispositivi [deciso come obiettivo]

- Chi organizza crea la partita, sceglie l'esplorazione e ottiene un **codice corto e un QR code**.
- Ogni giocatore entra dal proprio telefono e sceglie il proprio nome.
- Un tablet al centro del tavolo può fare da **tabellone** con il percorso di tutti.
- Le mosse compaiono subito su tutti i dispositivi.
- **Riconnessione:** chi perde la connessione o manda il telefono in standby rientra con il codice e ritrova tutto com'era.
- I turni non hanno un ordine fisso e lo stesso giocatore può muovere più volte di fila. Serve però evitare che due mosse si sovrappongano nello stesso istante: il Durable Object le esegue una alla volta.

### Logica lato server
- **Estrazioni sul server,** con la regola «meno mostrate» (vedi `roadmap-app.md`, punto 1). I contatori sono nello stato della partita e vengono aggiornati in modo atomico.
- **Stanze nascoste davvero:** i testi stanno solo sul server e il contenuto di una stanza viene inviato solo quando un giocatore ci entra. Così si risolve anche il problema dei testi leggibili nel codice sorgente.
- Annulla mossa e ricomincia funzionano come nell'app, contatori compresi.

### Da decidere
- **Chi può muovere chi:** solo il proprio personaggio, oppure anche il tabellone per conto di tutti?
- **Chi può annullare:** solo il giocatore interessato, oppure un «master» della partita?
- **Visibilità:** gli altri vedono l'effetto della stanza in cui sei entrato, o solo il titolo? Le stanze che ti vengono proposte sono visibili solo a te?

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
