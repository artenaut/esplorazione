# Protocollo della partita (server)

Come l'app parla con il server durante una partita. Riferimento per la nuova interfaccia a sessioni.
Decisioni di gioco: `roadmap-server.md` §2–3. Codice: `server/src/index.js` e `server/src/partita.js`.

Stato: passi **3.3–3.10** e **fase 4** (identità dei posti: nickname del club, nuovo nickname con consenso, guest).

---

## 1. Creare una partita

`POST https://esplorazione.artenaut.workers.dev/api/partite`

```json
{ "esplorazione": "lowrenzia", "posti": 3 }
```

- Da 2 a 4 posti. Ogni posto nasce **«da scegliere»** (nome provvisorio «Posto I», «Posto II»…): chi gioca lo sceglie dopo, dal proprio telefono (§3bis).
- Risposta `201`:

```json
{ "codice": "LWR-482", "codiceMaster": "…24 caratteri casuali…", "link": "https://artenaut.github.io/esplorazione/?partita=LWR-482" }
```

- **Codice corto:** tre lettere dal pianeta (la prima lettera del nome tecnico, poi le consonanti: `lowrenzia` → `LWR`) e tre cifre. Il **QR** si genera nell'app dal `link`.
- **Codice master:** si mostra una volta a chi crea la partita e il dispositivo lo conserva. Con lo stesso codice un altro dispositivo può prendere il ruolo di master.
- La partita contiene una **copia del pianeta**: se l'admin lo modifica, le partite già create non cambiano.
- Errori: `400` dati non validi, `403` origine non consentita, `404` esplorazione inesistente, `503` server in sola lettura (dalla 0.2.0). Il campo `errore` contiene un messaggio pronto da mostrare.

## 2. Collegarsi

### Controllare il codice (consigliato prima del WebSocket)

`GET /api/partite/LWR-482` → `200 { "codice": "LWR-482", "esplorazione": { "id": "lowrenzia", "nome": "Primo pianeta – Lowrenzia" } }` oppure `404 { "errore": "…" }`.

Un WebSocket rifiutato non dice il motivo al browser: con questo controllo l'app può mostrare subito «codice sbagliato».

### Limiti ai tentativi

Per indirizzo IP: **30 tentativi di ingresso al minuto** (controlli del codice e WebSocket insieme) e **10 partite create al minuto**. Oltre il limite il server risponde `429 { "errore": "Troppi tentativi in poco tempo. Aspetta un minuto e riprova." }`, anche sul WebSocket, prima dell'apertura. L'app deve quindi riconnettersi con calma: per esempio dopo 1, 2, 5 e 10 secondi, poi ogni 30.

### Il WebSocket

Limiti: al massimo **30 messaggi ogni 10 secondi** per connessione (oltre: `troppi-messaggi` e chiusura con il codice 4429) e **20 connessioni** contemporanee per partita (oltre: `troppe-connessioni` e chiusura 4429).

WebSocket su `wss://esplorazione.artenaut.workers.dev/api/partite/LWR-482/ws` (il codice si può scrivere anche in minuscolo).

- Ogni messaggio è un oggetto JSON con un campo `tipo`. Fa eccezione il ping: il testo `ping` riceve `pong`, senza risvegliare il server. Conviene mandarlo ogni 30 secondi circa, per tenere viva la connessione.
- Se la partita non esiste, il server manda `{ "tipo": "errore", "codice": "partita-inesistente" }` e chiude con il codice 4404.

### Entrare: il primo messaggio

| Messaggio | Ruolo ottenuto |
|---|---|
| `{ "tipo": "entra", "codiceMaster": "…" }` | **master**: vede tutto e gestisce posti ed esplorator\* |
| `{ "tipo": "entra", "gettone": "…" }` | **esplorator\***: rientro automatico nel proprio posto |
| `{ "tipo": "entra", "ruolo": "tabellone" }` | **tabellone**: sola lettura |
| `{ "tipo": "entra" }` | **ospite**: ha il codice e deve scegliere un posto |

Risposta: `{ "tipo": "benvenuto", "ruolo": "esplorator", "posto": 1, "versione": "0.2.0", "stato": { … } }`.

`versione` è la versione del server (dalla 0.2.0): se è diversa da quella dell'app, l'app mostra l'avviso «È uscita una nuova versione dell'app: ricarica la pagina» con il pulsante «Ricarica». Non ricarica mai da sola. La stessa versione è in `GET /api/stato`.

### Scegliere un posto (ospite)

`{ "tipo": "occupa", "posto": 1 }` → `{ "tipo": "posto", "posto": 1, "gettone": "…" }`

- Il **gettone** va salvato nel dispositivo, insieme al codice della partita. Riaprendo l'app si rientra con `entra` + `gettone`.
- Un posto occupato non si può prendere da un altro dispositivo.
- Un posto senza dispositivo resta libero: per quell\* esplorator\* muove il master.

## 3. Azioni del master

| Messaggio | Effetto |
|---|---|
| `{ "tipo": "libera", "posto": 1 }` | Il gettone di quel posto smette di valere. Il dispositivo riceve `{ "tipo": "liberato" }` e torna ospite. |
| `{ "tipo": "aggiungi" }` | Un posto in più, «da scegliere», all'ingresso (massimo 4). |
| `{ "tipo": "togli", "posto": 1 }` | Toglie l'esplorator\* (minimo 2). I posti successivi scalano di uno; il dispositivo tolto riceve `liberato`. |

Il server controlla il ruolo di ogni azione. Chi non ha il ruolo giusto riceve `{ "tipo": "errore", "codice": "ruolo" }`.

## 3bis. Chi gioca in un posto (fase 4)

`{ "tipo": "identita", "posto": 0, "scelta": … }` — la manda il telefono seduto in quel posto, oppure il master (per chi non ha il telefono). Si può cambiare **solo finché quel posto non ha fatto la prima mossa**; prima della scelta il posto non può muovere (`identita-mancante`).

| `scelta` | Effetto |
|---|---|
| `{ "tipo": "nickname", "id": 12 }` | Nickname del club. L'elenco si chiede alla partita con `{ "tipo": "nickname" }` → `{ "tipo": "nickname", "elenco": [{ "id", "nickname" }] }`, solo dal master o da chi ha un posto: non è pubblico. Lo stesso nickname non può stare in due posti della stessa partita. |
| `{ "tipo": "nuovo", "nickname": "Zia Pina", "eta14": true, "consenso": true }` | Crea un nickname del club. Servono **entrambe** le caselle. Il server salva solo nickname, data del consenso, versione dell'informativa e conferma dei 14 anni. Da 3 a 20 caratteri: lettere, numeri, spazi e `. _ - '`; unico senza distinguere maiuscole e minuscole. Al massimo 8 nuovi nickname per partita e 5 ogni 10 minuti per rete. |
| `{ "tipo": "guest" }` | Nome buffo scelto **dal server** («Gallina in incognito»…), diverso dagli altri della partita. Mandarlo di nuovo dà **un altro nome**. Il nome non si può scrivere a mano. |

Il master che crea un nickname per chi non ha il telefono deve passare il telefono alla persona: le due caselle valgono come sua dichiarazione.

## 4. Mosse e annulla

### Muovere

`{ "tipo": "mossa", "posto": 0, "stanza": "L2-F3", "versione": 4 }`

- `stanza` deve essere tra le `proposte` di quel posto.
- `versione` è la `versione` **di quel posto** nello stato da cui parte la mossa.
- L'esplorator\* muove solo per il proprio posto; il master muove per chiunque. In quel caso l'app lo deve dire chiaramente: «Stai muovendo per Giulia».
- Il server estrae le nuove proposte con la regola del pianeta («meno mostrate»: contatori condivisi da tutta la partita, spareggio sulle stanze già viste da chi muove, poi caso).
- Risposta a **tutti** i dispositivi:

```json
{ "tipo": "mossa", "posto": 0,
  "stanza": { "id": "L2-F3", "titolo": "Rompi il sigillo maledetto", "via": "forza", "testo": "Distruggi fino ad un incantesimo bersaglio" },
  "stato": { … } }
```

- **È l'unico messaggio che porta il testo di una stanza.** L'app lo mostra in quel momento e non lo conserva: dopo, nel percorso e nel registro, resta solo il titolo.
- Mosse contemporanee di persone **diverse** vanno tutte a buon fine. Due mosse sullo **stesso** personaggio (per esempio esplorator\* e master insieme): vince la prima, l'altra riceve `{ "tipo": "errore", "codice": "versione-superata", "messaggio": "Giulia ha già mosso: ecco la situazione aggiornata.", "stato": { … } }`.

### Annullare

`{ "tipo": "annulla" }` → a tutti `{ "tipo": "annullata", "posto": 0, "stato": { … } }`

- Si annulla **solo l'ultima mossa della partita**. Ripristina posizione, proposte e contatori «meno mostrate».
- Può farlo chi l'ha fatta (il dispositivo di quel posto) oppure il master. Se la mossa l'ha fatta il master per qualcun\*, solo il master la può annullare.
- `stato.annullabile` dice se c'è una mossa annullabile: `{ "posto": 0, "nome": "Alba", "stanza": "Titolo", "autore": 0 }` (`autore` è `"master"` o il numero del posto). Se è `null`, o se il dispositivo non è l'autore né il master, il pulsante va disattivato spiegando il motivo (per esempio «Dopo di te ha mosso Bruno»).
- Dopo «togli» non si può annullare la mossa precedente.

## 5. Fine della partita

### Chiudi partita / Annulla partita (master)

`{ "tipo": "chiudi", "salva": true, "poi": "fine" }`

| Campo | Valori |
|---|---|
| `salva` | `true` = **Chiudi partita** (i dati vanno alla classifica, dalla fase 5) · `false` = **Annulla partita** (non si salva nulla) |
| `poi` | `"fine"` = tornare alla schermata iniziale · `"stesso-gruppo"` = nuova partita subito, con gli stessi nomi |

La conferma («Sei sicur\* di…?») la chiede l'app prima di mandare il messaggio. Il server poi manda a ogni dispositivo:

```json
{ "tipo": "chiusa", "modo": "chiusa", "poi": "stesso-gruppo",
  "riepilogo": { "esplorazione": "lowrenzia", "posti": [ { "nome": "Alba", "tipo": "nickname", "nickname": 12, "cicli": 1, "stanze": 5, "perVia": { "forza": 3, "neutrale": 2 } } ] },
  "nuova": { "codice": "LWR-731", "link": "…", "posto": 0, "gettone": "…" } }
```

- `modo`: `"chiusa"`, `"annullata"` oppure `"scaduta"`.
- `riepilogo` c'è solo con «Chiudi partita». Prima di chiudere, il server **salva in classifica** (stagione in corso) i posti con un nickname; guest e posti mai scelti non lasciano traccia. Se il salvataggio non riesce, il master riceve `salvataggio-fallito` e la partita resta aperta. Ogni posto ha `tipo` (`"nickname"`, `"guest"` o `null` se mai scelto) e `nickname` (l'id, solo per i nickname): in classifica entreranno solo i nickname.
- Con lo stesso gruppo i posti mantengono la loro identità (nickname o nome del guest).
- `nuova` c'è solo con `"stesso-gruppo"`. Tutti ricevono `codice` e `link`. Il master riceve anche il nuovo `codiceMaster`, e ogni telefono seduto il nuovo `gettone` per lo stesso posto: si rientra con `entra` senza riscegliere il posto. Chi non era collegat\* in quel momento trova il proprio posto libero.
- Subito dopo il server chiude le connessioni (codice 4000) ed **elimina tutti i dati** della partita. Il codice corto torna libero.

### Scadenza automatica

- La partita viene eliminata **6 ore dopo l'ultima attività**, e comunque **24 ore dopo la creazione**.
- Contano come attività: mosse, annullamenti, occupare un posto, aggiungere o togliere esplorator\*. Collegarsi, chiedere lo stato o restare in standby non contano.
- Allo scadere i dispositivi collegati ricevono `{ "tipo": "chiusa", "modo": "scaduta", "messaggio": "…" }` e la partita sparisce come con «Annulla partita».
- `stato.scade` dice quando scadrà (data e ora in millisecondi), se nessuno fa nulla.

## 6. Lo stato

Dopo ogni modifica il server manda a tutti i dispositivi lo stesso messaggio `{ "tipo": "stato", "stato": … }`. Si può chiedere di nuovo con `{ "tipo": "stato" }`.

```json
{
  "codice": "LWR-482",
  "versione": 7,
  "scade": 1794012345678,
  "esplorazione": { "id": "lowrenzia", "nome": "…", "descrizione": "…", "vie": [ { "id": "forza", "nome": "…", "breve": "…", "colore": "#c95a40" } ], "regole": "…", "regoleImmagine": "img/esploratore.png" },
  "posti": [
    {
      "nome": "Alba", "identita": { "tipo": "nickname", "id": 12 }, "versione": 4, "occupato": true, "giro": 1, "passo": 3, "livello": "", "completato": false, "mosse": 2,
      "percorso": [ { "id": "L1-F", "titolo": "Al Diavolo le mappe", "via": "forza" } ],
      "proposte":  [ { "id": "L3-F2", "titolo": "In preda alla furia!", "via": "forza" } ]
    }
  ],
  "registro": [ { "nome": "Alba", "stanza": "Al Diavolo le mappe", "via": "forza", "passo": 1, "giro": 1, "master": false } ],
  "annullabile": null
}
```

- **Mai i testi delle stanze.** Il testo arriva solo con l'evento `mossa`.
- `registro`: le ultime 60 mosse, la più recente per prima. `master: true` se l'ha fatta il master.
- **Lunghezza nascosta:** c'è solo il nome del livello della prossima mossa (`livello`, vuoto se il pianeta non lo assegna), mai l'elenco dei livelli.
- `versione` (della partita) cresce a ogni modifica; `posti[i].versione` cresce a ogni mossa o annullamento di quel posto ed è quella da mandare con la mossa.

## 6bis. Classifica pubblica

`GET /api/classifica[?stagione=ID]` → `{ stagione, stagioni, generale, pianeti }`, in sola lettura, solo totali per nickname (cache 60 secondi). Regole di calcolo: `roadmap-classifica.md` §3–4.

## 7. Errori

`{ "tipo": "errore", "codice": "…", "messaggio": "…" }`. Il `messaggio` è già in italiano inclusivo e si può mostrare così com'è.

| Codice | Quando |
|---|---|
| `partita-inesistente` | Codice sbagliato, oppure partita chiusa o scaduta. |
| `codice-master-errato` | Codice master sbagliato. |
| `gettone-non-valido` | Il posto è stato liberato o tolto, oppure il gettone è di un'altra partita: scegliere un posto libero. |
| `non-entrato` | È arrivata un'azione prima di `entra`. |
| `ruolo` | Azione non permessa a questo dispositivo. |
| `posto-inesistente`, `posto-occupato`, `posto-libero` | Problemi con il posto indicato. |
| `nome-non-valido`, `troppi`, `troppo-pochi` | Aggiunta o rimozione di esplorator\* non valida. |
| `identita-mancante`, `identita-bloccata` | Posto ancora da scegliere / identità non più modificabile dopo la prima mossa. |
| `nickname-in-uso`, `nickname-inesistente`, `nickname-non-valido`, `consenso-mancante`, `troppi-nickname` | Problemi nella scelta o creazione del nickname: il messaggio dice cosa fare. |
| `troppi-messaggi`, `troppe-connessioni` | Limiti della connessione superati (§2). |
| `salvataggio-fallito` | «Chiudi partita» non è riuscita a salvare i risultati: la partita resta aperta, riprovare. |
| `versione-superata` | Qualcun altro ha già mosso quel personaggio: il messaggio porta lo `stato` aggiornato. |
| `stanza-non-proposta` | La stanza non è tra le proposte (porta lo `stato`). |
| `niente-da-annullare` | Non c'è una mossa annullabile. |
| `sola-lettura` | Il server è stato riportato a una versione precedente: niente nuovi nickname, salvataggi in classifica o nuove partite (dalla 0.2.0). Mosse e «Annulla partita» funzionano. |
| `partita-piu-nuova` | La partita è stata creata da una versione più recente del server: crearne una nuova (dalla 0.2.0). |
| `messaggio-non-valido`, `tipo-sconosciuto`, `errore-server` | Errori tecnici. |
