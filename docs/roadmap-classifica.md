# Roadmap · Classifica

Come si calcolano e si mostrano le classifiche dei giocatori del club.
Richiede il lato server: vedi `roadmap-server.md` per sessioni, chiusura delle partite e sicurezza.

Legenda: **[deciso]** concordato · **[da confermare]** proposta, manca un sì · **[da decidere]** manca una scelta

---

## 1. Da dove arrivano i dati [deciso]

- Contano **solo le partite concluse** con «Chiudi partita» dal master. Le partite annullate o scadute per inattività non lasciano traccia.
- I giocatori sono quelli dell'**elenco del club** gestito dall'admin. Gli **ospiti** non entrano in classifica.
- L'admin può **modificare o eliminare a mano i singoli dati** salvati, per correggere errori. Non deve confermare le partite.

## 2. Le statistiche di base

| Statistica | Significato |
|---|---|
| **Pianeti completati** | Il numero di pianeti diversi (esplorazioni diverse) in cui il giocatore è entrato almeno una volta in una **stanza finale**. Ogni pianeta conta una sola volta, anche se completato più volte. |
| **Esplorazioni portate a termine** | Il numero di **cicli completati**, in tutte le partite e su tutti i pianeti. Un ciclo è completato quando il giocatore entra in una stanza finale. |
| **Stanze aperte** | Il numero totale di stanze in cui il giocatore è entrato. |

- [da confermare] Le **stanze dell'ingresso** contano come stanze aperte, perché il giocatore ci entra. La proposta è di contarle.
- [da confermare] Le stanze aperte in un ciclo rimasto a metà alla chiusura della partita **contano** comunque come stanze aperte, ma non come esplorazione portata a termine.

## 3. Classifica generale [deciso]

Comprende tutti i pianeti inseriti nell'app.

- **Colonne:** pianeti completati, esplorazioni portate a termine, stanze aperte.
- **Ordine della classifica**, con criteri in cascata per gli spareggi:
  1. pianeti completati, decrescente;
  2. a parità: esplorazioni portate a termine, decrescente;
  3. a parità: stanze aperte, decrescente.
- **Pari merito assoluto:** i giocatori pari su tutti e tre i criteri ricevono **la stessa posizione**. La posizione successiva salta di tanti posti quanti sono i giocatori in più nella parità (classifica "1-2-2-4").
  - Esempio: due giocatori quinti a pari merito. Non c'è un sesto posto, e il giocatore successivo è **settimo**.
  - Esempio: tre giocatori secondi a pari merito. Il successivo è **quinto**.
- A pari merito, i giocatori vengono elencati in ordine alfabetico, solo per la visualizzazione.

## 4. Classifiche dei singoli pianeti [deciso]

Una classifica per ogni pianeta, cioè per ogni esplorazione (es. Lowrenzia).

- **Stessa logica** della generale, ma **senza «pianeti completati»**:
  1. esplorazioni portate a termine su quel pianeta, decrescente;
  2. a parità: stanze aperte su quel pianeta, decrescente;
  3. pari merito assoluto: stessa posizione, con salto delle posizioni come nella generale.
- **Statistiche peculiari del pianeta,** mostrate ma **senza effetto sulla classifica.**
  - Per Lowrenzia: stanze della Forza visitate, stanze della Sapienza visitate, stanze neutrali visitate.
  - Sono definite dall'**esplorazione**, non dall'app. Le vie e le categorie vengono già dal file dell'esplorazione (vedi `roadmap-app.md`, formato v2), quindi le colonne si generano da lì, e un pianeta con altre vie avrà altre colonne.
  - [da confermare] Se l'esplorazione cambia (stanze aggiunte o rimosse), i dati restano legati all'id del pianeta e delle stanze.

## 5. Visualizzazione [deciso]

- Si sceglie quale classifica vedere: la **generale** o quella di un **pianeta**.
- Toccando l'intestazione di una colonna si può **riordinare la tabella per ciascun parametro**, statistiche peculiari comprese, in ordine crescente o decrescente.
- **Riordinare non cambia la classifica:** la colonna «Posizione» mostra sempre la posizione ufficiale, calcolata come ai punti 3 e 4.
- Un'opzione «Torna alla classifica» ripristina l'ordine ufficiale.

## 6. Da decidere

- **Stagioni:** la classifica va divisa in stagioni (es. una per anno o per semestre), da azzerare periodicamente, oppure è unica e cumulativa? Nella roadmap del server l'admin ha già la possibilità di azzerare le stagioni.
- **Giocatori senza partite:** compaiono in classifica con zero, oppure solo dopo la prima partita conclusa? La proposta è la seconda.
- **Dove si vede la classifica:** una pagina pubblica dell'app (consultabile da tutti, anche fuori dal club) oppure solo dall'app al tavolo?
