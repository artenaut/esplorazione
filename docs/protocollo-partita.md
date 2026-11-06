# Protocollo della partita (server)

Come l'app parla con il server durante una partita. Riferimento per la nuova interfaccia a sessioni.
Decisioni di gioco: `roadmap-server.md` §2–3. Codice: `server/src/index.js` e `server/src/partita.js`.

Stato: passi **3.3–3.5** (creazione, posti, ruoli). Le mosse (3.6–3.7), la chiusura (3.8) e la scadenza (3.9) si aggiungono qui quando sono pronte.

---

## 1. Creare una partita

`POST https://esplorazione.artenaut.workers.dev/api/partite`

```json
{ "esplorazione": "lowrenzia", "nomi": ["Alba", "Bruno", "Cleo"] }
```

- Da 2 a 4 nomi, massimo 24 caratteri ciascuno, tutti diversi (senza distinguere maiuscole e minuscole). Gli spazi in più vengono tolti.
- Risposta `201`:

```json
{ "codice": "LWR-482", "codiceMaster": "…24 caratteri casuali…", "link": "https://artenaut.github.io/esplorazione/?partita=LWR-482" }
```

- **Codice corto:** tre lettere dal pianeta (la prima lettera del nome tecnico, poi le consonanti: `lowrenzia` → `LWR`) e tre cifre. Il **QR** si genera nell'app dal `link`.
- **Codice master:** si mostra una volta a chi crea la partita e il dispositivo lo conserva. Con lo stesso codice un altro dispositivo può prendere il ruolo di master.
- La partita contiene una **copia del pianeta**: se l'admin lo modifica, le partite già create non cambiano.
- Errori: `400` dati non validi, `403` origine non consentita, `404` esplorazione inesistente. Il campo `errore` contiene un messaggio pronto da mostrare.

## 2. Collegarsi

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

Risposta: `{ "tipo": "benvenuto", "ruolo": "esplorator", "posto": 1, "stato": { … } }`.

### Scegliere un posto (ospite)

`{ "tipo": "occupa", "posto": 1 }` → `{ "tipo": "posto", "posto": 1, "gettone": "…" }`

- Il **gettone** va salvato nel dispositivo, insieme al codice della partita. Riaprendo l'app si rientra con `entra` + `gettone`.
- Un posto occupato non si può prendere da un altro dispositivo.
- Un posto senza dispositivo resta libero: per quell\* esplorator\* muove il master.

## 3. Azioni del master

| Messaggio | Effetto |
|---|---|
| `{ "tipo": "libera", "posto": 1 }` | Il gettone di quel posto smette di valere. Il dispositivo riceve `{ "tipo": "liberato" }` e torna ospite. |
| `{ "tipo": "aggiungi", "nome": "Dario" }` | Nuov\* esplorator\* all'ingresso (massimo 4). |
| `{ "tipo": "togli", "posto": 1 }` | Toglie l'esplorator\* (minimo 2). I posti successivi scalano di uno; il dispositivo tolto riceve `liberato`. |

Il server controlla il ruolo di ogni azione. Chi non ha il ruolo giusto riceve `{ "tipo": "errore", "codice": "ruolo" }`.

## 4. Lo stato

Dopo ogni modifica il server manda a tutti i dispositivi lo stesso messaggio `{ "tipo": "stato", "stato": … }`. Si può chiedere di nuovo con `{ "tipo": "stato" }`.

```json
{
  "codice": "LWR-482",
  "versione": 7,
  "esplorazione": { "id": "lowrenzia", "nome": "…", "descrizione": "…", "vie": [ { "id": "forza", "nome": "…", "breve": "…", "colore": "#c95a40" } ], "regole": "…", "regoleImmagine": "img/esploratore.png" },
  "posti": [
    {
      "nome": "Alba", "occupato": true, "giro": 1, "passo": 3, "livello": "", "completato": false, "mosse": 2,
      "percorso": [ { "id": "L1-F", "titolo": "Al Diavolo le mappe", "via": "forza" } ],
      "proposte":  [ { "id": "L3-F2", "titolo": "In preda alla furia!", "via": "forza" } ]
    }
  ],
  "registro": []
}
```

- **Mai i testi delle stanze.** Il testo arriverà solo con la mossa di ingresso (passo 3.6).
- **Lunghezza nascosta:** c'è solo il nome del livello della prossima mossa (`livello`, vuoto se il pianeta non lo assegna), mai l'elenco dei livelli.
- `versione` cresce a ogni modifica. Le mosse la useranno per rifiutare quelle partite da uno stato vecchio.

## 5. Errori

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
| `messaggio-non-valido`, `tipo-sconosciuto`, `errore-server` | Errori tecnici. |
