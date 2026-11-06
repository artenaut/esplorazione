# Roadmap · App (lato client)

Decisioni prese e idee per le prossime versioni del Registro dell'esplorazione.
Riguarda l'app che gira nel browser, anche senza server.

Legenda: **[deciso]** concordato, da sviluppare · **[da decidere]** idea discussa, manca una scelta · **[scartato]** valutato e messo da parte

---

## 0. Da completare

- [ ] **PRIORITÀ: linguaggio inclusivo in tutto il progetto** (deciso il 6/11/2026). Vale per app, area admin, classifica, informativa, messaggi di errore e nomi dei guest. Si applica a **ogni versione in produzione**: le roadmap possono usare «giocatore», ma tutto ciò che vedono le persone no.
  - Le persone che giocano si chiamano sempre **esplorator\*** (singolare e plurale), con l'asterisco come in Artenaut\*. Gli aggettivi e i participi riferiti a loro usano lo stesso asterisco (es. «Esplorator\* rimoss\*»).
  - Dove si può, meglio ancora una **forma neutra** che non richiede l'asterisco: «chi gioca», «chi amministra», «il tuo turno», «persone», «staff».
  - Da correggere nell'app attuale: «Giocatori», «Aggiungi giocatore», «Rimuovi giocatore», «Nome del giocatore N», «Ognuno si muove», «avventurieri», «Percorso di …» (già neutro), «Nuovi giocatori», «Stessi giocatori», «Tutti i progressi», «amministratore» nell'area admin, e i messaggi di errore che parlano di «giocatori».
  - I nomi dei guest non usano aggettivi di genere: vedi `roadmap-classifica.md`, punto 10.
  - L'informativa è già stata adeguata (6/11/2026).

- [ ] **Inserire le regole del gioco di Lowrenzia** nel pulsante «Regole». Sono le regole del gioco vero e proprio, non le istruzioni dell'app. Oggi il campo `rules` contiene solo «Placeholder - ricordati di inserire istruzioni». Serve il testo da Francesco, oppure un link a un regolamento completo (`rulesUrl`).

- [ ] **Caratteri ospitati nel sito, senza Google Fonts** (deciso il 6/11/2026). Scaricare i file dei due caratteri (IM Fell English SC e Alegreya Sans, in formato `woff2`) e metterli nel repository, caricandoli con `@font-face` al posto del link a Google. Così nessun IP dei visitatori viene inviato a Google, e l'informativa non deve citarlo. Va fatto prima di pubblicare la classifica. I file stanno su GitHub Pages insieme all'app: non servono al server Cloudflare.
- [ ] **Informativa privacy:** il testo è pronto in `informativa-privacy.md` (completato il 6/11/2026). Va collegato all'inserimento del nickname.
- [ ] **Spostare il repository in un'organizzazione GitHub del club** (es. `artenaut`), al posto dell'account personale di Francesco. Va fatto **prima di distribuire link o QR code**.
  1. Francesco crea l'organizzazione da github.com/organizations/plan (piano Free) e ne resta amministratore. Altri membri del club si possono aggiungere con ruoli diversi, senza condividere password.
  2. Repository → Settings → General → Danger Zone → **Transfer ownership** verso l'organizzazione. Codice, cronologia, roadmap e impostazioni seguono il repository, e i link al vecchio repository vengono reindirizzati.
  3. Controllare che GitHub Pages sia ancora attivo (Settings → Pages, branch `main`, cartella principale).
  4. Dare a Claude l'accesso all'organizzazione dalla pagina di installazione dell'app GitHub di Claude.
  5. Aggiornare README, roadmap e link con il nuovo indirizzo.
  - **Attenzione:** l'indirizzo del sito cambia (es. da `meatsculptor.github.io/esplorazione` a `artenaut.github.io/esplorazione`) e GitHub **non reindirizza** il vecchio indirizzo di Pages. Per il browser è un sito nuovo, quindi si perdono partita in corso, esplorazioni caricate a mano e password admin cambiata (torna `dungeon`).
  - [da decidere] Un **dominio del club** (es. `esplorazione.artenaut.it`) collegato a Pages renderebbe l'indirizzo stabile per sempre, anche cambiando repository o hosting.

## 1. Estrazione «meno mostrate» [deciso] · priorità alta

Si può fare già nella versione attuale con un solo dispositivo. I contatori vivono nella partita salvata nel browser.

- **Ordine di priorità** (deciso il 6/11/2026):
  1. **Conteggio nella sessione:** si pescano per prime le stanze mostrate meno volte nella sessione, a tutti i giocatori insieme.
     - Le stanze mai mostrate hanno conteggio 0, quindi escono per prime.
     - Quando sono state mostrate tutte, si passa a quelle mostrate 1 volta, poi 2, e così via.
     - Se nel gruppo con il conteggio più basso ci sono meno stanze di quelle necessarie, si prendono tutte e si completa dal gruppo successivo.
  2. **Spareggio per giocatore:** a parità di conteggio nella sessione, si preferiscono le stanze che **il giocatore che sta muovendo non ha ancora visto**.
  3. **Caso:** se restano ancora pari, si sceglie a caso.
- Una stanza conta come «mostrata» appena compare tra le proposte, anche se non viene scelta.
- Sono escluse le stanze fisse dell'ingresso e, in generale, i livelli che mostrano tutte le stanze.
- **Annulla mossa** riporta indietro anche i contatori, che vanno salvati insieme allo stato.
- **Ricomincia** azzera i contatori, perché inizia una nuova sessione.
- La regola è rigida, non un'estrazione pesata.
- La regola è una proprietà dell'esplorazione: `estrazione: "meno-mostrate" | "casuale"`. Lowrenzia usa «meno-mostrate».

## 2. Formato dell'esplorazione v2 [deciso]

### Fissato dall'app, uguale per tutte le esplorazioni
- Lo scheletro **ingresso → sviluppo → finale → ritorno all'ingresso** (nuovo giro).
- La gestione di giri, annulla mossa, ricomincia e cronologia.

### Definito da ogni esplorazione
- **Vie o categorie:** nome, colore, quante sono. Oggi Forza, Sapienza e Neutrale sono scritte nell'app; vanno spostate nell'esplorazione.
- **Stanze dell'ingresso,** sempre mostrate tutte.
- **Sviluppo come mappa di livelli,** che può non essere simmetrico. Per ogni livello:
  - il pool di stanze;
  - quante stanze proporre per ogni via, in base alla scelta precedente;
  - il **livello successivo** in base alla stanza scelta. Così percorsi diversi possono avere lunghezze diverse o ricongiungersi.
- **Il finale,** che è sempre l'ultimo nodo e riporta all'ingresso.
- **Regola di estrazione:** vedi il punto 1.
- **Cosa fare se un pool non basta,** per esempio pescare da un'altra via o proporre meno stanze.

### Validazione al caricamento (area admin)
- Ogni percorso possibile deve arrivare al finale, senza vicoli ciechi né cicli prima del finale.
- Nessuna regola deve chiedere più stanze di quante ne abbia il pool, salvo che sia previsto un ripiego.
- Gli id delle stanze devono essere unici.
- Le esplorazioni restano **dati, non codice:** niente script eseguibili dentro i file caricati.

### Criteri di estrazione futuri (idee da usare se serviranno)
- La via scelta all'ingresso, la via più frequentata finora, una stanza specifica già visitata, il numero del giro.

## 3. Simulatore nell'area admin [deciso]

- Un pulsante «Simula 1.000 partite» per un'esplorazione.
- Mostra quante volte compare e viene scelta ogni stanza, a che livello si arriva e se qualche pool resta vuoto.
- Serve a bilanciare un'esplorazione prima di portarla al tavolo.

## 4. Classifica locale, su un solo dispositivo [da decidere]

- Si salva un riepilogo di ogni partita conclusa nel browser.
- Limiti: vale solo su quel dispositivo, si perde cancellando i dati del browser, e il giocatore è riconosciuto dal nome scritto.
- La versione per tutto il club dipende dal server: vedi `roadmap-server.md`.
- Se si fa, valgono le stesse regole delle sessioni condivise: pulsanti «Chiudi partita» (salva) e «Annulla partita» (non salva) al posto di «Ricomincia», ed entrano in classifica solo le partite concluse. Vedi `roadmap-server.md`, «Chiusura della partita».
- Regole di calcolo e visualizzazione decise: vedi `roadmap-classifica.md`. La versione locale userebbe le stesse regole.

## 5. Proposte non ancora decise

- **App installabile (PWA):** icona di Artenaut* nella schermata Home e apertura a tutto schermo. Richiede `manifest.json` e un'icona nel repository.

## 6. Valutati e messi da parte

- **[scartato]** Password admin con protezione vera: va bene quella lato client, che serve solo a non far fare pasticci ai giocatori.
- **[scartato]** Pulsante «Passa al giocatore successivo», tolto: i turni non hanno un ordine fisso e lo stesso giocatore può muovere più volte di fila.

---

## Decisioni già applicate (riferimento)
- Parte giocatori e area admin separate. La password iniziale è `dungeon` e si cambia dall'area admin.
- Terminologia «esplorazione» al posto di «dungeon». Il logo di Artenaut* è in testata.
- Lowrenzia ha 5 livelli: ingresso, 3 intermedi, finale.
- Le esplorazioni definitive sono incorporate nell'app. Il caricamento da file nell'area admin è per prove.
- Interfaccia ottimizzata per il telefono e schermo tenuto acceso durante la partita.
- I commit non devono contenere l'email personale.
- Pulsante «Regole» in alto, nella schermata iniziale e durante la partita. Le regole sono un campo `rules` di ogni esplorazione (testo con `## ` per i titoli, `- ` per gli elenchi, `**grassetto**`), più un `rulesUrl` facoltativo verso un regolamento completo. Per ora Lowrenzia ha solo un testo segnaposto: vedi il punto 0. (6/11/2026)
- Il testo di una stanza si vede **solo al momento dell'ingresso**. Non si vede tra le proposte, nemmeno se la stanza è già stata visitata nella sessione. Nel percorso e nella cronologia, di tutti i giocatori, resta solo il titolo. Le stanze del percorso non sono più cliccabili per rileggerle. Il testo rimane visibile finché si resta sul giocatore che ha appena mosso; cambiando scheda o ricaricando la pagina sparisce. Va mantenuto in ogni versione futura. (Deciso e applicato il 6/11/2026.)
