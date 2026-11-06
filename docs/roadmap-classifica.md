# Roadmap · Classifica

Come si calcolano e si mostrano le classifiche dei giocatori del club.
Richiede il lato server: vedi `roadmap-server.md` per sessioni, chiusura delle partite e sicurezza.

Legenda: **[deciso]** concordato · **[da confermare]** proposta, manca un sì · **[da decidere]** manca una scelta

---

## 1. Da dove arrivano i dati [deciso]

- Contano **solo le partite concluse** con «Chiudi partita» dal master. Le partite annullate o scadute per inattività non lasciano traccia.
- I giocatori sono quelli dell'**elenco del club**, identificati solo da un **nickname** (vedi punto 9). I **guest** non entrano in classifica (vedi punto 10).
- L'admin può **modificare o eliminare a mano i singoli dati** salvati, per correggere errori. Non deve confermare le partite.

## 2. Le statistiche di base

| Statistica | Significato |
|---|---|
| **Pianeti completati** | Il numero di pianeti diversi (esplorazioni diverse) in cui il giocatore è entrato almeno una volta in una **stanza finale**. Ogni pianeta conta una sola volta, anche se completato più volte. |
| **Esplorazioni portate a termine** | Il numero di **cicli completati**, in tutte le partite e su tutti i pianeti. Un ciclo è completato quando il giocatore entra in una stanza finale. |
| **Stanze aperte** | Il numero totale di stanze in cui il giocatore è entrato. |

- Le **stanze dell'ingresso** contano come stanze aperte, perché il giocatore ci entra.
- Le stanze aperte in un ciclo rimasto a metà alla chiusura della partita **contano** come stanze aperte, ma non come esplorazione portata a termine.

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
  - Se l'esplorazione cambia (stanze aggiunte o rimosse), i dati restano legati all'id del pianeta e delle stanze.

## 5. Visualizzazione [deciso]

- Si sceglie quale classifica vedere: la **generale** o quella di un **pianeta**.
- Toccando l'intestazione di una colonna si può **riordinare la tabella per ciascun parametro**, statistiche peculiari comprese, in ordine crescente o decrescente.
- **Riordinare non cambia la classifica:** la colonna «Posizione» mostra sempre la posizione ufficiale, calcolata come ai punti 3 e 4.
- Un'opzione «Torna alla classifica» ripristina l'ordine ufficiale.

## 6. Stagioni [deciso il 6/11/2026]

- Le classifiche sono **divise in stagioni.** Ogni partita conclusa conta nella stagione in corso.
- **La stagione si chiude a mano, dall'admin,** quando vuole. Non c'è una durata fissa. Alla chiusura se ne apre subito una nuova, che parte da zero per tutti.
- Ogni stagione ha classifica generale e classifiche dei pianeti, calcolate con le regole dei punti 3 e 4.
- [deciso il 6/11/2026] Le **stagioni concluse restano consultabili** da tutti come archivio: si sceglie la stagione da un elenco, e di default si vede quella in corso.
- [deciso il 6/11/2026] Una stagione ha un nome assegnato dall'admin: proposto come «Stagione 1», «Stagione 2»… e modificabile (es. «Inverno 2026»).

## 7. Chi entra in classifica [deciso il 6/11/2026]

- Un giocatore entra nella classifica di una stagione **appena partecipa a una partita conclusa** con «Chiudi partita».
- Ci entra **anche se ha tutti i punteggi a zero:** per esempio se ha aperto stanze senza completare cicli, o se ha partecipato senza aprire nessuna stanza.
- Chi non ha partite concluse nella stagione non compare.
- Nella classifica di un pianeta compare chi ha partecipato ad almeno una partita conclusa **su quel pianeta.**

## 8. Classifica pubblica [deciso il 6/11/2026]

- La classifica è **consultabile pubblicamente,** senza login, da una pagina dell'app con un indirizzo fisso, da condividere o da mettere in un QR code al club.
- Si vede **in sola lettura**: stagione in corso, archivio delle stagioni, generale e pianeti, riordino per colonna.
- Modifiche ai dati, elenco dei giocatori e chiusura delle stagioni restano nell'area admin, protetta da Cloudflare Access.
- Il server espone solo i **totali per giocatore**, non i dettagli delle partite né i testi delle stanze.
- **Privacy:** in classifica compaiono solo nickname. Vedi il punto 9.

## 9. Nickname e privacy [deciso il 6/11/2026]

Riferimento: GDPR e Codice privacy italiano. Analisi del 6/11/2026, da far verificare a un consulente prima della pubblicazione.

### Dati raccolti
- **Solo un nickname.** Nessun altro dato: niente nome, email, età, telefono.
- Il nickname va trattato comunque come **dato personale pseudonimo**, perché in un club chi lo usa è spesso riconoscibile. Il rischio è basso, ma il GDPR si applica.
- **Titolare del trattamento: l'associazione** (il club), non una persona.
- Vale per l'inserimento del nickname e quindi per chi entra in classifica. I guest non inseriscono dati (punto 10).

### Chi crea il nickname [deciso il 6/11/2026]
- **L'esplorator\* stess\*, alla prima partita:** entrando in una sessione sceglie «Nuovo nickname», spunta le caselle e da quel momento lo ritrova nell'elenco. L'admin interviene solo per rinominare o cancellare.

### Decisioni del 6/11/2026 (fase 4)
- **Chi sceglie:** ognun\* dal proprio telefono, dopo aver preso il posto; per chi non ha il telefono lo fa il master (passando il telefono alla persona per le caselle).
- **Nessuna protezione del nickname** (niente PIN): vigila il tavolo, l'admin corregge. Lo stesso nickname non può comparire due volte nella stessa partita.
- **Prova del consenso:** per ogni nickname si salvano data del consenso, versione dell'informativa e conferma dei 14 anni.
- Regole del nickname: da 3 a 20 caratteri (lettere, numeri, spazi, `. _ - '`), unico senza distinguere maiuscole e minuscole; vietati i nomi riservati e i nomi da guest.

### Al momento dell'inserimento del nickname
- **Disclaimer:** «Il nickname sarà visibile a chiunque nella classifica pubblica: non usare il tuo nome vero.»
- **Casella di consenso** da spuntare: «Acconsento a comparire con questo nickname nella classifica pubblica del club.» Il consenso si può revocare chiedendo la cancellazione.
- **Casella dell'età:** «Ho almeno 14 anni.» In Italia è l'età minima per dare da soli il consenso ai servizi online (art. 2-quinquies del Codice privacy). Chi ha meno di 14 anni gioca come guest.
- **Link all'informativa breve.**

### Informativa breve (art. 13 GDPR)
Poche righe, in linguaggio semplice, comprensibile anche ai ragazzi:
- chi è il titolare (l'associazione) e un contatto;
- dati trattati: nickname e statistiche di gioco;
- scopo: la classifica pubblica del club;
- base giuridica: il consenso;
- conservazione: finché il giocatore non chiede la cancellazione;
- fornitori coinvolti: Cloudflare (server) e GitHub (sito), che trattano anche gli indirizzi IP dei visitatori nei loro log;
- diritti: accesso, rettifica, cancellazione, revoca del consenso, reclamo al Garante privacy;
- l'admin può rinominare o rimuovere nickname che sono nomi veri o offensivi.

### Diritti e moderazione
- L'admin può **rinominare** un nickname (per esempio un nome vero inserito per sbaglio, o un termine offensivo) e **cancellare** un giocatore su richiesta.
- In caso di cancellazione, nelle **stagioni archiviate** il nickname diventa **«Esplorator\* rimoss\*»**: le posizioni degli altri non cambiano. Dalla **stagione in corso** i suoi risultati vengono tolti (fatto così dal 6/11/2026, coerente con la revoca del consenso nell'informativa).

### Altro
- **Niente banner cookie:** l'app salva nel browser solo dati tecnici strettamente necessari (partita e posto del giocatore). Va mantenuto così, quindi niente strumenti di analisi delle visite.
- **Niente Google Fonts** [deciso]: i caratteri vengono ospitati nel sito stesso, così l'IP dei visitatori non arriva a Google. Vedi `roadmap-app.md`, punto 0.
- **Informativa:** `informativa-privacy.md`. Titolare Artenaut\*, contatto artenautspaceship@gmail.com.

## 10. Guest [deciso il 6/11/2026]

- Chiunque può entrare in partita **come guest**, senza nickname e senza dati.
- Il guest ha un **nome buffo generato dall'app**, per esempio «Gallina in incognito» o «Alpaca col monocolo».
  - Il nome viene da un elenco di frasi in italiano **senza aggettivi di genere**: un animale più un complemento invariabile, come «Gallina in incognito», «Alpaca col monocolo», «Lama dal cappello buffo». Si evitano forme come «Alpaca curioso».
  - **Il nome non si può modificare a mano,** perché qualcuno ci scriverebbe il proprio. Un pulsante «Un altro nome» ne estrae uno nuovo.
  - Nella stessa partita non possono esserci due nomi uguali.
- Il guest gioca normalmente, ma **non entra in classifica.** Alla chiusura della partita i suoi dati vengono scartati e non salvati.
- Serve in particolare ai **minori di 14 anni**, che così giocano senza bisogno del consenso dei genitori. Lo può usare anche un adulto che non vuole comparire in classifica.
- Il guest sostituisce l'«ospite» previsto in precedenza.
