# Roadmap · App (lato client)

Decisioni prese e idee per le prossime versioni del Registro dell'esplorazione.
Riguarda l'app che gira nel browser, anche senza server.

Legenda: **[deciso]** concordato, da sviluppare · **[da decidere]** idea discussa, manca una scelta · **[scartato]** valutato e messo da parte

---

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
- Va prima deciso **cosa vale punti:** esplorazioni completate, profondità raggiunta, punti per livello, media per partita, vittoria della partita, classifiche per esplorazione o per stagione.

## 5. Proposte non ancora decise

- **App installabile (PWA):** icona di Artenaut* nella schermata Home e apertura a tutto schermo. Richiede `manifest.json` e un'icona nel repository.

## 6. Valutati e messi da parte

- **[scartato]** Font di Google in locale, per il GDPR: ritenuto non importante per ora.
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
