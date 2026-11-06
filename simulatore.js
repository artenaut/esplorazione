// Tabelle del simulatore (area admin del server). Usa simulate() di motore.js.
// Modulo pubblicato con l'app su GitHub Pages e importato dalla pagina /admin del server.

const esc = s => String(s??'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function simHtml(R){
  const m = R.m,
    badge = p => `<span class="badge" style="--pc:${esc(m.paths[p]?.color||'#888')}">${esc(m.paths[p]?.short||p)}</span>`, pct = (a,b) => b ? (100*a/b).toFixed(1).replace('.',',')+'%' : '—';
  const nodeName = k => k==='ingresso' ? (m.nodes.ingresso.name||'Ingresso') : k==='finale' ? (m.nodes.finale.name||'Finale') : (m.nodes[k].name ? `${m.nodes[k].name} (${k})` : k);
  const avgLap = R.lapMoves.length ? (R.lapMoves.reduce((a,b)=>a+b,0)/R.lapMoves.length).toFixed(1).replace('.',',') : '—';
  const totalChosen = Object.values(R.viaChosen).reduce((a,b)=>a+b,0);
  const vieRows = Object.keys(m.paths).map(v=>`<tr><td>${badge(v)}</td><td class="num">${R.viaChosen[v]||0}</td><td class="num">${pct(R.viaChosen[v]||0,totalChosen)}</td></tr>`).join('');
  const routeRows = Object.entries(R.routes).sort((a,b)=>b[1]-a[1]).map(([k,n])=>`<tr><td>${k.split('>').map(x=>esc(nodeName(x))).join(' → ')}</td><td class="num">${pct(n,R.laps)}</td></tr>`).join('') || '<tr><td colspan="2" class="hint">Nessun giro completato: prova ad aumentare le mosse a testa.</td></tr>';
  const warn = [];
  const nodeBlocks = Object.values(m.nodes).filter(n=>n.kind!=='all').map(n=>{
    const rows = n.rooms.map(r=>({ r, ...R.room[r.id] }));
    const avg = rows.reduce((a,x)=>a+x.shown,0)/rows.length;
    rows.forEach(x=>{ if(x.shown===0) warn.push(`«${x.r.title}» (${nodeName(n.key)}) non è mai stata proposta.`); else if(avg && x.shown < avg*0.5) warn.push(`«${x.r.title}» (${nodeName(n.key)}) è stata proposta meno della metà della media del livello.`); });
    const body = rows.sort((a,b)=>b.shown-a.shown).map(x=>`<tr class="${x.shown===0?'bad':(avg && x.shown<avg*0.5?'warnrow':'')}"><td>${esc(x.r.title)}</td><td>${badge(x.r.path)}</td><td class="num">${x.shown}</td><td class="num">${x.chosen}</td><td class="num">${pct(x.chosen,x.shown)}</td></tr>`).join('');
    return `<details class="simlv"><summary>${esc(nodeName(n.key))} · ${n.rooms.length} stanze</summary><div class="tablewrap"><table class="simt"><thead><tr><th>Stanza</th><th>Via</th><th class="num">Proposta</th><th class="num">Scelta</th><th class="num">Scelta se proposta</th></tr></thead><tbody>${body}</tbody></table></div></details>`;
  }).join('');
  return `
    <div class="simsum">
      <div><span class="eyebrow">Partite</span><strong>${R.games.toLocaleString('it-IT')}</strong></div>
      <div><span class="eyebrow">Mosse</span><strong>${R.moves.toLocaleString('it-IT')}</strong></div>
      <div><span class="eyebrow">Giri completati</span><strong>${R.laps.toLocaleString('it-IT')}</strong></div>
      <div><span class="eyebrow">Mosse per un giro</span><strong>${avgLap}</strong></div>
    </div>
    ${warn.length ? `<div class="simwarn"><strong>Da controllare</strong><ul>${warn.slice(0,12).map(w=>`<li>${esc(w)}</li>`).join('')}${warn.length>12?`<li>…e altre ${warn.length-12}.</li>`:''}</ul></div>` : `<p class="okmsg">Tutte le stanze sono state proposte in modo equilibrato.</p>`}
    <h3 class="simh">Vie scelte</h3>
    <div class="tablewrap"><table class="simt"><thead><tr><th>Via</th><th class="num">Scelte</th><th class="num">Quota</th></tr></thead><tbody>${vieRows}</tbody></table></div>
    <h3 class="simh">Percorsi dei giri completati</h3>
    <div class="tablewrap"><table class="simt"><thead><tr><th>Percorso</th><th class="num">Quota</th></tr></thead><tbody>${routeRows}</tbody></table></div>
    <h3 class="simh">Stanze per livello</h3>
    ${nodeBlocks}
    <p class="hint">Le scelte del simulatore sono casuali: non sa quali stanze preferirebbero le persone al tavolo. Serve a scoprire stanze che escono poco, percorsi rari e pool sbilanciati.</p>`;
}
