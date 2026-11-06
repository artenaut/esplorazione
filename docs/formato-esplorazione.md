# Formato delle esplorazioni · versione 2

Come si descrive un pianeta, cioè un'esplorazione, perché l'app lo possa giocare.
Confermato e in uso dal 6/11/2026 (punti 1.2–1.4 del piano).

---

## L'idea in breve

L'app fissa solo lo scheletro, uguale per tutti i pianeti:

**ingresso → sviluppo → finale → di nuovo ingresso** (nuovo giro).

Tutto il resto lo decide il file del pianeta:
- **le vie:** quante sono, come si chiamano, di che colore sono;
- **i livelli dello sviluppo:** quante stanze hanno, quante ne propongono di ogni via, e **qual è il livello successivo** in base alla via della stanza scelta. Così i percorsi possono avere lunghezze diverse;
- **le regole del gioco,** l'immagine e la regola di estrazione.

Il file è in formato JSON, con **nomi dei campi in italiano.**
Le stanze si possono continuare a scrivere nel foglio di calcolo: la conversione in JSON la faccio io.

---

## I campi

### Il pianeta

| Campo | Obbligatorio | Significato |
|---|---|---|
| `formato` | sì | Sempre `2`. |
| `id` | sì | Nome tecnico: minuscole, numeri e trattini (es. `lowrenzia`). Non va più cambiato, perché la classifica è legata a questo. |
| `nome` | sì | Il nome che si vede (es. «Primo pianeta – Lowrenzia»). |
| `descrizione` | no | Una riga sotto il nome, nella scelta dell'esplorazione. |
| `estrazione` | no | `"meno-mostrate"` oppure `"casuale"` (predefinito). |
| `regole` | no | Testo delle regole del gioco: righe con `## ` per i titoli, `- ` per gli elenchi, `**grassetto**`, simboli come `{T}`. |
| `regoleLink` | no | Link `https://` a un regolamento completo. |
| `regoleImmagine` | no | Immagine in cima alle regole (es. `img/esploratore.png`). |
| `vie` | sì | L'elenco delle vie (vedi sotto). |
| `ingresso` | sì | Il livello iniziale (vedi sotto). |
| `livelli` | sì | I livelli dello sviluppo, ciascuno con un proprio nome tecnico. |
| `finale` | sì | Il livello finale. |

### Una via

| Campo | Significato |
|---|---|
| `id` | Nome tecnico (es. `forza`). |
| `nome` | Nome completo (es. «Via della Forza»). |
| `breve` | Nome breve per le etichette (es. «Forza»). |
| `colore` | Colore delle etichette, in esadecimale (es. `#c95a40`). |

Le vie diventano anche le colonne delle statistiche del pianeta in classifica.

### Una stanza

| Campo | Significato |
|---|---|
| `id` | Nome tecnico, **unico in tutto il pianeta** (es. `L2-F1`). Non va più cambiato. |
| `titolo` | Quello che si vede prima di entrare. |
| `via` | L'`id` di una delle vie. |
| `testo` | L'effetto, che si vede solo al momento dell'ingresso. Può contenere simboli come `{T}` o `{1}`. |

### L'ingresso

| Campo | Significato |
|---|---|
| `nome` | Es. «Ingresso». |
| `stanze` | Le stanze, **mostrate sempre tutte.** |
| `successivo` | Il livello dove si va dopo l'ingresso: un nome tecnico per tutti (es. `"L2"`), oppure uno per via (es. `{"forza": "F2", "sapienza": "S2"}`). |

### Un livello dello sviluppo

| Campo | Significato |
|---|---|
| `nome` | Facoltativo. Se c'è, compare accanto al numero del passo (es. «Passo 3 · La forgia»). |
| `stanze` | Il pool di stanze del livello. |
| `proposte` | **Quante stanze proporre di ogni via, in base alla via della stanza scelta prima.** Es. dopo una stanza della Forza: `{"forza": 2, "neutrale": 1}`. |
| `successivo` | Il livello dopo questo: un nome tecnico per tutti, uno per via, oppure `"finale"`. |

### Il finale

Come un livello dello sviluppo, ma **senza `successivo`:** dopo il finale si torna sempre all'ingresso.

---

## Esempio 1 · Lowrenzia (accorciato)

Lo stesso Lowrenzia di oggi, riscritto nel nuovo formato. Per brevità c'è una sola stanza per livello: le altre seguono lo stesso schema.

```json
{
  "formato": 2,
  "id": "lowrenzia",
  "nome": "Primo pianeta – Lowrenzia",
  "descrizione": "Vie della Forza e della Sapienza",
  "estrazione": "meno-mostrate",
  "regoleImmagine": "img/esploratore.png",
  "regole": "## Leader dell'esplorazione\n- Per procedere nell'esplorazione del pianeta bisogna …",

  "vie": [
    { "id": "forza",    "nome": "Via della Forza",    "breve": "Forza",    "colore": "#c95a40" },
    { "id": "sapienza", "nome": "Via della Sapienza", "breve": "Sapienza", "colore": "#5b8fd0" },
    { "id": "neutrale", "nome": "Neutrale",           "breve": "Neutrale", "colore": "#94a07f" }
  ],

  "ingresso": {
    "nome": "Ingresso",
    "stanze": [
      { "id": "L1-F", "titolo": "Al Diavolo le mappe", "via": "forza",    "testo": "Sorveglia 1" },
      { "id": "L1-S", "titolo": "Consulti la mappa",   "via": "sapienza", "testo": "Profetizza 1" }
    ],
    "successivo": "L2"
  },

  "livelli": {
    "L2": {
      "stanze": [
        { "id": "L2-F1", "titolo": "…", "via": "forza", "testo": "…" }
      ],
      "proposte": {
        "forza":    { "forza": 2, "neutrale": 1 },
        "sapienza": { "sapienza": 2, "neutrale": 1 },
        "neutrale": { "forza": 1, "sapienza": 1, "neutrale": 1 }
      },
      "successivo": "L3"
    },
    "L3": { "stanze": [ … ], "proposte": { … }, "successivo": "L4" },
    "L4": { "stanze": [ … ], "proposte": { … }, "successivo": "finale" }
  },

  "finale": {
    "nome": "Finale",
    "stanze": [ … ],
    "proposte": {
      "forza":    { "forza": 1 },
      "sapienza": { "sapienza": 1 },
      "neutrale": { "neutrale": 1 }
    }
  }
}
```

---

## Esempio 2 · un pianeta non simmetrico (inventato)

Due vie, Fuoco e Ghiaccio. **La via del Fuoco è più lunga** (3 livelli prima del finale), **quella del Ghiaccio più breve** (2 livelli). Al livello 2 di Fuoco si può cambiare strada scegliendo una stanza di Ghiaccio.

```json
{
  "formato": 2,
  "id": "pianeta-di-prova",
  "nome": "Pianeta di prova",
  "vie": [
    { "id": "fuoco",    "nome": "Via del Fuoco",    "breve": "Fuoco",    "colore": "#d0643c" },
    { "id": "ghiaccio", "nome": "Via del Ghiaccio", "breve": "Ghiaccio", "colore": "#6fb3d2" }
  ],
  "ingresso": {
    "nome": "Ingresso",
    "stanze": [ { "id": "I-F", "titolo": "Il cratere", "via": "fuoco", "testo": "…" },
                { "id": "I-G", "titolo": "La crepa",   "via": "ghiaccio", "testo": "…" } ],
    "successivo": { "fuoco": "F2", "ghiaccio": "G2" }
  },
  "livelli": {
    "F2": { "nome": "Le colate", "stanze": [ … ],
            "proposte": { "fuoco": { "fuoco": 2, "ghiaccio": 1 } },
            "successivo": { "fuoco": "F3", "ghiaccio": "G3" } },
    "F3": { "nome": "La forgia", "stanze": [ … ],
            "proposte": { "fuoco": { "fuoco": 3 } },
            "successivo": "F4" },
    "F4": { "nome": "Il cuore ardente", "stanze": [ … ],
            "proposte": { "fuoco": { "fuoco": 2 } },
            "successivo": "finale" },
    "G2": { "nome": "Le grotte", "stanze": [ … ],
            "proposte": { "ghiaccio": { "ghiaccio": 3 } },
            "successivo": "G3" },
    "G3": { "nome": "Il lago gelato", "stanze": [ … ],
            "proposte": { "ghiaccio": { "ghiaccio": 2 }, "fuoco": { "ghiaccio": 2 } },
            "successivo": "finale" }
  },
  "finale": { "nome": "La vetta", "stanze": [ … ],
              "proposte": { "fuoco": { "fuoco": 1 }, "ghiaccio": { "ghiaccio": 1 } } }
}
```

Percorsi possibili: Ingresso → F2 → F3 → F4 → Finale, Ingresso → F2 → G3 → Finale, Ingresso → G2 → G3 → Finale.

---

## Controlli al caricamento

L'area admin rifiuta il file, spiegando cosa correggere, se:
- un `id` di stanza è ripetuto, o una stanza usa una via che non esiste;
- un `successivo` punta a un livello che non esiste;
- un percorso non arriva mai al finale, oppure torna su un livello già attraversato prima del finale;
- un livello può essere raggiunto dopo una via per cui non ha una regola in `proposte`;
- una regola chiede più stanze di una via di quante ce ne siano: **il pianeta deve avere le stanze che servono**, altrimenti va corretto il file;
- un livello non si raggiunge da nessun percorso.

Il simulatore (punto 1.5) farà poi i controlli statistici.

---

## Cosa cambia per chi gioca

- **Niente,** per Lowrenzia: si gioca esattamente come oggi.
- **In tutti i pianeti la lunghezza totale del percorso resta nascosta:** la barra mostra solo i passi fatti e il prossimo, e la scheda di chi gioca dice «Passo 3» (o «Esplorazione completata» dopo il finale).
- Le esplorazioni caricate da file nel vecchio formato non funzioneranno più e vanno ricaricate nel nuovo. Lowrenzia la converto io.
