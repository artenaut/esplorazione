// Motore del Registro dell'esplorazione: logica condivisa tra l'app (index.html) e il server (server/).
// Modulo ES senza dipendenze, senza accesso al DOM né a localStorage.
// Qualsiasi modifica qui cambia il gioco su entrambi i lati: rieseguire le prove dell'app e del server.

/* ---------- formato 2: controllo e preparazione ----------
   Scheletro fisso: ingresso → livelli → finale → ingresso.
   Il file decide vie, stanze, proposte e livello successivo. */
const RE_ID = /^[a-z0-9-]{1,40}$/, RE_KEY = /^[A-Za-z0-9_-]{1,30}$/, RE_COL = /^#[0-9a-fA-F]{6}$/;
const isObj = x => !!x && typeof x==='object' && !Array.isArray(x);
const isStr = x => typeof x==='string' && x.trim()!=='';
const has = (o,k) => Object.prototype.hasOwnProperty.call(o,k);

/* Opzioni: builtin = esplorazione inclusa nell'app; idRiservati = id già usati dalle esplorazioni incluse. */
export function validateModule(m, opts){
  opts = opts || {};
  if(!isObj(m)) return 'Il file non contiene un oggetto JSON.';
  if(m.formato!==2) return 'Il file deve indicare "formato": 2. I file nel formato precedente vanno convertiti.';
  if(typeof m.id!=='string' || !RE_ID.test(m.id)) return 'L’"id" dell’esplorazione deve contenere solo lettere minuscole, numeri e trattini.';
  if(!isStr(m.nome)) return 'L’esplorazione deve avere un "nome".';
  if(m.descrizione!=null && typeof m.descrizione!=='string') return 'La "descrizione" deve essere un testo.';
  if(m.estrazione!=null && !['casuale','meno-mostrate'].includes(m.estrazione)) return 'L’"estrazione" deve essere "casuale" oppure "meno-mostrate".';
  if(m.regole!=null && typeof m.regole!=='string') return 'Le "regole" devono essere un testo.';
  if(m.regoleLink!=null && (typeof m.regoleLink!=='string' || !/^https:\/\/\S+$/.test(m.regoleLink))) return 'Il "regoleLink" deve essere un indirizzo che inizia con https://.';
  if(m.regoleImmagine!=null && (typeof m.regoleImmagine!=='string' || !/^(img\/[a-z0-9._-]+\.(png|webp|jpg)|https:\/\/\S+)$/.test(m.regoleImmagine))) return 'La "regoleImmagine" deve essere un file in img/ o un indirizzo https://.';

  // vie
  if(!Array.isArray(m.vie) || !m.vie.length || m.vie.length>8) return 'Servono da 1 a 8 vie in "vie".';
  const vie = new Set();
  for(const v of m.vie){
    if(!isObj(v) || typeof v.id!=='string' || !RE_ID.test(v.id)) return 'Ogni via deve avere un "id" con sole lettere minuscole, numeri e trattini.';
    if(vie.has(v.id)) return `La via «${v.id}» è ripetuta.`;
    if(!isStr(v.nome)) return `La via «${v.id}» deve avere un "nome".`;
    if(v.breve!=null && !isStr(v.breve)) return `Il "breve" della via «${v.id}» deve essere un testo.`;
    if(typeof v.colore!=='string' || !RE_COL.test(v.colore)) return `Il "colore" della via «${v.id}» deve essere un colore come #c95a40.`;
    vie.add(v.id);
  }

  // livelli
  if(!isObj(m.ingresso)) return 'Manca l’"ingresso".';
  if(!isObj(m.finale)) return 'Manca il "finale".';
  if(m.livelli!=null && !isObj(m.livelli)) return 'I "livelli" devono essere un oggetto con un nome tecnico per ogni livello.';
  const livelli = m.livelli || {};
  for(const k of Object.keys(livelli)){
    if(!RE_KEY.test(k) || k==='ingresso' || k==='finale') return `Il nome tecnico di livello «${k}» non è valido: usa lettere, numeri, trattini e non usare «ingresso» o «finale».`;
  }
  const nodes = { ingresso:m.ingresso, ...livelli, finale:m.finale };
  const label = k => k==='ingresso' ? 'nell’ingresso' : k==='finale' ? 'nel finale' : `nel livello «${k}»`;
  const roomIds = new Set();
  for(const [k,n] of Object.entries(nodes)){
    if(!isObj(n)) return `Il livello «${k}» non è valido.`;
    if(n.nome!=null && !isStr(n.nome)) return `Il "nome" ${label(k)} deve essere un testo.`;
    if(!Array.isArray(n.stanze) || !n.stanze.length) return `Non ci sono stanze ${label(k)}.`;
    for(const r of n.stanze){
      if(!isObj(r) || !isStr(r.id) || !isStr(r.titolo)) return `C’è una stanza senza "id" o "titolo" ${label(k)}.`;
      if(!vie.has(r.via)) return `La stanza «${r.id}» usa la via «${r.via}», che non esiste in "vie".`;
      if(r.testo!=null && typeof r.testo!=='string') return `Il "testo" della stanza «${r.id}» deve essere un testo.`;
      if(roomIds.has(r.id)) return `L’id di stanza «${r.id}» è ripetuto: ogni stanza deve avere un id unico.`;
      roomIds.add(r.id);
    }
    if(k!=='ingresso'){
      if(!isObj(n.proposte)) return `Mancano le "proposte" ${label(k)}.`;
      for(const [da,regola] of Object.entries(n.proposte)){
        if(!vie.has(da)) return `Le "proposte" ${label(k)} citano la via «${da}», che non esiste.`;
        if(!isObj(regola)) return `La regola delle proposte ${label(k)} dopo la via «${da}» non è valida.`;
        let tot=0;
        for(const [via,num] of Object.entries(regola)){
          if(!vie.has(via)) return `Le "proposte" ${label(k)} citano la via «${via}», che non esiste.`;
          if(!Number.isInteger(num) || num<0 || num>20) return `Nelle "proposte" ${label(k)} il numero per la via «${via}» deve essere un intero tra 0 e 20.`;
          const disp = n.stanze.filter(r=>r.via===via).length;
          if(num>disp) return `Le "proposte" ${label(k)} chiedono ${num} stanze della via «${via}», ma ce ne sono solo ${disp}. Aggiungi stanze o riduci il numero.`;
          tot+=num;
        }
        if(!tot) return `Le "proposte" ${label(k)} dopo la via «${da}» non propongono nessuna stanza.`;
      }
    }
    if(k!=='finale'){
      const nx = n.successivo;
      const ok = t => t==='finale' || has(livelli,t);
      if(typeof nx==='string'){ if(!ok(nx)) return `Il "successivo" ${label(k)} punta a «${nx}», che non esiste.`; }
      else if(isObj(nx)){
        for(const [via,t] of Object.entries(nx)){
          if(!vie.has(via)) return `Il "successivo" ${label(k)} cita la via «${via}», che non esiste.`;
          if(typeof t!=='string' || !ok(t)) return `Il "successivo" ${label(k)} per la via «${via}» punta a «${t}», che non esiste.`;
        }
      } else return `Manca il "successivo" ${label(k)}.`;
    }
  }

  // percorsi: ogni strada deve arrivare al finale, senza giri a vuoto
  const nextOf = (k,via) => { const nx=nodes[k].successivo; return typeof nx==='string' ? nx : nx[via]; };
  const reached = new Set(['ingresso']);
  let err = null;
  const walk = (k, via, stack) => {
    if(err) return;
    if(stack.includes(k)){ err = `C’è un percorso che torna al livello «${k}» prima di arrivare al finale.`; return; }
    reached.add(k);
    const regola = nodes[k].proposte[via];
    if(!regola){ err = `${label(k).replace(/^./,c=>c.toUpperCase())} si può arrivare dopo una stanza della via «${via}», ma le "proposte" non dicono cosa mostrare in quel caso.`; return; }
    if(k==='finale') return;
    for(const [w,num] of Object.entries(regola)){
      if(!num) continue;
      const t = nextOf(k,w);
      if(!t){ err = `Il "successivo" ${label(k)} non dice dove si va dopo una stanza della via «${w}».`; return; }
      walk(t, w, stack.concat(k));
    }
  };
  for(const via of new Set(m.ingresso.stanze.map(r=>r.via))){
    const t = nextOf('ingresso', via);
    if(!t){ err = `Il "successivo" nell’ingresso non dice dove si va dopo una stanza della via «${via}».`; break; }
    walk(t, via, ['ingresso']);
    if(err) break;
  }
  if(err) return err;
  for(const k of Object.keys(livelli)) if(!reached.has(k)) return `Il livello «${k}» non si raggiunge da nessun percorso.`;
  if(!reached.has('finale')) return 'Nessun percorso arriva al finale.';

  if(!opts.builtin && (opts.idRiservati||[]).includes(m.id)) return `L’id «${m.id}» è già usato da un’esplorazione inclusa nell’app.`;
  return null;
}

/* Versione interna, comoda per il gioco */
/* Versione interna, comoda per l'app */
export function compile(src){
  const paths = {}; src.vie.forEach(v=>paths[v.id]={ label:v.nome, short:v.breve||v.nome, color:v.colore });
  const conv = r => ({ id:r.id, title:r.titolo, path:r.via, content:r.testo||'' });
  const nodes = {};
  const add = (key, n, kind) => nodes[key] = { key, name:n.nome||'', kind, rooms:n.stanze.map(conv), offer:n.proposte||null, next:key==='finale'?'ingresso':n.successivo };
  add('ingresso', src.ingresso, 'all');
  for(const [k,n] of Object.entries(src.livelli||{})) add(k, n, 'random');
  add('finale', src.finale, 'random');
  const roomMap = {}; let roomCount = 0;
  for(const n of Object.values(nodes)) for(const r of n.rooms){ roomMap[r.id] = { room:r, node:n.key }; roomCount++; }
  return { id:src.id, name:src.nome, description:src.descrizione||'', estrazione:src.estrazione||'casuale',
    rules:src.regole||'', rulesUrl:src.regoleLink||'', rulesImage:src.regoleImmagine||'',
    paths, nodes, roomMap, roomCount, levelCount:Object.keys(nodes).length, src };
}

/* ---------- estrazione ---------- */
export function shuffle(a){ a=a.slice(); for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
export const sample = (a,n) => shuffle(a).slice(0,n);

/* Estrazione delle stanze proposte.
   "meno-mostrate": prima le stanze mostrate meno volte nella sessione (a chiunque),
   a parità quelle che questa persona non ha ancora visto, poi a caso.
   "casuale": estrazione semplice. Le stanze contano come mostrate appena compaiono tra le proposte. */
/* Estrazione: stessa funzione per la partita e per il simulatore.
   shown = conteggi della sessione, seen = stanze già viste da chi muove (può mancare). */
export function pickRooms(m, pool, n, shown, seen){
  if(m.estrazione!=='meno-mostrate') return sample(pool, n);
  shown = shown || {}; seen = seen || {};
  return pool
    .map(r=>({ r, k1: shown[r.id]||0, k2: seen[r.id]?1:0, k3: Math.random() }))
    .sort((a,b)=> a.k1-b.k1 || a.k2-b.k2 || a.k3-b.k3)
    .slice(0, n).map(x=>x.r);
}
export function drawOffer(m, nodeKey, prevPath, shown, seen){
  const node = m.nodes[nodeKey];
  if(node.kind==='all') return node.rooms.map(r=>r.id);
  const rule = node.offer[prevPath] || {};
  let out=[];
  for(const [p,n] of Object.entries(rule)) out = out.concat(pickRooms(m, node.rooms.filter(r=>r.path===p), n, shown, seen).map(r=>r.id));
  // contano come «mostrate» solo le stanze estratte (non quelle fisse dell'ingresso)
  for(const id of out){ shown[id]=(shown[id]||0)+1; if(seen) seen[id]=1; }
  return shuffle(out);
}
export const nextOfNode = (m, nodeKey, path) => { const nx = m.nodes[nodeKey].next; return typeof nx==='string' ? nx : nx[path]; };

/* ---------- simulatore (area admin) ----------
   Gioca molte partite con scelte casuali, usando le stesse regole di estrazione dell'app. */
export function simulate(m, games, nPlayers, movesEach){
  const room = {}; for(const [id,info] of Object.entries(m.roomMap)) room[id] = { shown:0, chosen:0, node:info.node };
  const viaChosen = {}, routes = {}, lapMoves = [];
  let laps = 0, moves = 0;
  for(let g=0; g<games; g++){
    const shown = {};
    const players = Array.from({length:nPlayers}, ()=>{ const seen={}; return { node:'ingresso', seen, route:['ingresso'], lapStart:0, made:0, offer:drawOffer(m,'ingresso',null,shown,seen) }; });
    // ordine libero: a ogni mossa tocca a una persona a caso che ha ancora mosse
    const left = players.map(()=>movesEach);
    for(let t=0; t<nPlayers*movesEach; t++){
      const cand = left.map((l,i)=>l>0?i:-1).filter(i=>i>=0);
      const i = cand[Math.floor(Math.random()*cand.length)]; left[i]--;
      const p = players[i];
      const id = p.offer[Math.floor(Math.random()*p.offer.length)];
      const r = m.roomMap[id].room;
      room[id].chosen++; viaChosen[r.path] = (viaChosen[r.path]||0)+1; moves++; p.made++;
      const from = p.node, to = nextOfNode(m, from, r.path);
      if(from==='finale'){
        laps++; lapMoves.push(p.made - p.lapStart); p.lapStart = p.made;
        const key = p.route.join('>'); routes[key] = (routes[key]||0)+1; p.route = ['ingresso'];
      } else p.route.push(to);
      p.node = to;
      p.offer = drawOffer(m, to, r.path, shown, p.seen);
      for(const x of p.offer) room[x].shown++;   // per l'ingresso non conta: non compare nelle tabelle
    }
  }
  return { m, games, nPlayers, movesEach, room, viaChosen, routes, laps, moves, lapMoves };
}
