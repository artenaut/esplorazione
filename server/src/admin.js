// Area /admin: pagina e API per gestire le esplorazioni. Tutto passa da verificaAccess.

import { verificaAccess } from "./accesso.js";
import { elencoAdmin, leggi, salva, rimuovi } from "./esplorazioni.js";

const LIMITE_FILE = 1024 * 1024; // 1 MB: un pianeta è di poche decine di kB
const RE_ID = /^[a-z0-9-]{1,40}$/;

export async function gestisciAdmin(request, env, url) {
  if (!env.ACCESS_TEAM || !env.ACCESS_AUD) {
    return testo("Area admin non ancora configurata: manca l'applicazione Cloudflare Access.", 503);
  }
  const chi = await verificaAccess(request, env);
  if (!chi) return testo("Accesso negato. Entra dall'indirizzo dell'area admin per fare il login con Cloudflare Access.", 403);

  const p = url.pathname.replace(/\/+$/, "") || "/admin";
  if (p === "/admin" && request.method === "GET") return pagina(chi);

  if (!p.startsWith("/admin/api/")) return json({ errore: "Indirizzo non trovato." }, 404);

  // Le modifiche richiedono un'intestazione che un altro sito non può aggiungere senza permesso (CSRF).
  if (request.method !== "GET" && request.headers.get("X-Richiesta") !== "admin") {
    return json({ errore: "Richiesta non valida." }, 400);
  }

  if (p === "/admin/api/esplorazioni") {
    if (request.method === "GET") return json(await elencoAdmin(env.DB));
    if (request.method === "POST") {
      const corpo = await leggiJson(request);
      if (corpo.errore) return json(corpo, 400);
      const esito = await salva(env.DB, corpo.dati);
      return json(esito, esito.errore ? 422 : 200);
    }
  }

  const m = p.match(/^\/admin\/api\/esplorazioni\/([^/]+)$/);
  if (m) {
    const id = decodeURIComponent(m[1]);
    if (!RE_ID.test(id)) return json({ errore: "Id non valido." }, 400);
    if (request.method === "GET") {
      const dati = await leggi(env.DB, id);
      return dati ? json(dati) : json({ errore: "Esplorazione non trovata." }, 404);
    }
    if (request.method === "DELETE") {
      return (await rimuovi(env.DB, id)) ? json({ ok: true }) : json({ errore: "Esplorazione non trovata." }, 404);
    }
  }

  return json({ errore: "Indirizzo o metodo non previsto." }, 404);
}

async function leggiJson(request) {
  const lunghezza = Number(request.headers.get("Content-Length") || 0);
  if (lunghezza > LIMITE_FILE) return { errore: "Il file è troppo grande (massimo 1 MB)." };
  const t = await request.text();
  if (t.length > LIMITE_FILE) return { errore: "Il file è troppo grande (massimo 1 MB)." };
  try {
    return { dati: JSON.parse(t) };
  } catch {
    return { errore: "Il file non è un JSON valido." };
  }
}

const SICUREZZA = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Frame-Options": "DENY",
};
function json(dati, status = 200) {
  return new Response(JSON.stringify(dati), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...SICUREZZA } });
}
function testo(t, status) {
  return new Response(t + "\n", { status, headers: { "Content-Type": "text/plain; charset=utf-8", ...SICUREZZA } });
}

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function pagina(chi) {
  const html = `<!doctype html>
<html lang="it"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>Area admin · Registro dell’esplorazione</title>
<style>
@font-face{font-family:"IM Fell English SC";src:url("https://artenaut.github.io/esplorazione/fonts/im-fell-english-sc-400.woff") format("woff");font-display:swap}
@font-face{font-family:"Alegreya Sans";src:url("https://artenaut.github.io/esplorazione/fonts/alegreya-sans-400.woff") format("woff");font-weight:400;font-display:swap}
@font-face{font-family:"Alegreya Sans";src:url("https://artenaut.github.io/esplorazione/fonts/alegreya-sans-700.woff") format("woff");font-weight:700;font-display:swap}
:root{--stone:#15181d;--slab:#1f242b;--slab2:#282e37;--line:#39404b;--parch:#ece3cf;--muted:#a69d8b;--torch:#dba24c;--ink:#1a1408;--ok:#94a07f;--err:#f08a73;color-scheme:dark}
*{box-sizing:border-box}
body{margin:0;background:var(--stone);color:var(--parch);font:16px/1.5 "Alegreya Sans","Segoe UI",system-ui,sans-serif;padding:0 16px 40px}
.wrap{max-width:860px;margin:0 auto;display:flex;flex-direction:column;gap:18px}
h1,h2{font-family:"IM Fell English SC",Georgia,serif;font-weight:400;margin:0}
h1{font-size:1.8rem}h2{font-size:1.25rem}
header{padding-top:22px;display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-end;gap:10px}
.eyebrow{font-size:.74rem;text-transform:uppercase;letter-spacing:.14em;color:var(--muted)}
.hint{color:var(--muted);margin:0;font-size:.92rem}
.panel{background:var(--slab);border:1px solid var(--line);border-radius:12px;padding:18px;display:flex;flex-direction:column;gap:12px}
.btn{font:inherit;color:inherit;cursor:pointer;border:1px solid var(--line);background:var(--slab2);border-radius:8px;padding:8px 14px;font-weight:700}
.btn:hover{border-color:var(--muted)}
.btn.primary{background:var(--torch);border-color:var(--torch);color:var(--ink)}
.btn.danger{border-color:#7a3a2e}
.btn:disabled{opacity:.4;cursor:not-allowed}
.list{display:flex;flex-direction:column;gap:8px}
.item{display:flex;flex-wrap:wrap;gap:10px;justify-content:space-between;align-items:center;border:1px solid var(--line);border-radius:10px;padding:12px;background:var(--stone)}
.item strong{font-family:"IM Fell English SC",Georgia,serif;font-weight:400;font-size:1.1rem}
.item small{display:block;color:var(--muted)}
.row{display:flex;gap:8px;flex-wrap:wrap}
.msg{margin:0;font-size:.95rem}.msg.err{color:var(--err)}.msg.ok{color:var(--ok)}
code{font-size:.85em;color:var(--muted)}
button:focus-visible{outline:2px solid var(--torch);outline-offset:2px}
</style></head><body><div class="wrap">
<header><div><span class="eyebrow">Area admin</span><h1>Esplorazioni sul server</h1></div>
<p class="hint">Accesso come ${esc(chi.email) || "chi amministra"} · <a class="hint" href="/cdn-cgi/access/logout">Esci</a></p></header>

<section class="panel">
  <div><h2>Esplorazioni caricate</h2><p class="hint">Sono quelle che si possono scegliere quando si crea una partita. I testi delle stanze restano solo qui sul server.</p></div>
  <div class="list" id="lista"><p class="hint">Caricamento…</p></div>
</section>

<section class="panel">
  <div><h2>Carica o aggiorna un’esplorazione</h2><p class="hint">File JSON nel formato 2. Se esiste già un’esplorazione con lo stesso <code>id</code>, viene sostituita. Il file viene controllato prima di salvarlo: se qualcosa non torna, ti dico cosa correggere.</p></div>
  <div class="row"><button class="btn primary" id="scegli">Scegli file…</button><input type="file" id="file" accept=".json,application/json" hidden></div>
  <p class="msg" id="esito" aria-live="polite"></p>
</section>
</div>
<script>
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const H = { 'X-Richiesta': 'admin' };
const data = s => new Date(s).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' });
function esito(t, ok){ const e=$('#esito'); e.textContent=t; e.className='msg '+(ok?'ok':'err'); }

async function carica(){
  const r = await fetch('/admin/api/esplorazioni', { headers: H });
  const el = $('#lista');
  if(!r.ok){ el.innerHTML = '<p class="msg err">Elenco non disponibile ('+r.status+').</p>'; return; }
  const l = await r.json();
  el.innerHTML = l.length ? l.map(m => \`
    <div class="item"><div><strong>\${esc(m.nome)}</strong>
      <small><code>\${esc(m.id)}</code> · \${m.livelli} livelli · \${m.stanze} stanze · versione \${m.versione} · aggiornata il \${esc(data(m.aggiornata))}</small></div>
      <div class="row"><button class="btn" data-scarica="\${esc(m.id)}">Scarica JSON</button>
      <button class="btn danger" data-rimuovi="\${esc(m.id)}" data-nome="\${esc(m.nome)}">Rimuovi</button></div></div>\`).join('')
    : '<p class="hint">Nessuna esplorazione caricata.</p>';
}

document.addEventListener('click', async e => {
  const s = e.target.closest('[data-scarica]'), d = e.target.closest('[data-rimuovi]');
  if(s){
    const r = await fetch('/admin/api/esplorazioni/'+encodeURIComponent(s.dataset.scarica), { headers: H });
    if(!r.ok) return esito('Download non riuscito ('+r.status+').');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(await r.json(), null, 2)], { type: 'application/json' }));
    a.download = s.dataset.scarica + '.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  if(d){
    if(!confirm('Rimuovere «'+d.dataset.nome+'»? Non si potrà più scegliere quando si crea una partita.')) return;
    const r = await fetch('/admin/api/esplorazioni/'+encodeURIComponent(d.dataset.rimuovi), { method: 'DELETE', headers: H });
    esito(r.ok ? 'Esplorazione «'+d.dataset.nome+'» rimossa.' : 'Rimozione non riuscita ('+r.status+').', r.ok);
    carica();
  }
});

$('#scegli').onclick = () => $('#file').click();
$('#file').onchange = async e => {
  const f = e.target.files[0]; e.target.value = '';
  if(!f) return;
  const r = await fetch('/admin/api/esplorazioni', { method: 'POST', headers: { ...H, 'Content-Type': 'application/json' }, body: await f.text() });
  const j = await r.json().catch(() => ({}));
  if(r.ok) esito('Esplorazione «'+j.esplorazione+'» '+(j.nuova ? 'caricata.' : 'aggiornata (versione '+j.versione+').'), true);
  else esito(j.errore || ('Caricamento non riuscito ('+r.status+').'));
  carica();
};
carica();
</script></body></html>`;
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      ...SICUREZZA,
      "Content-Security-Policy":
        "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; font-src https://artenaut.github.io; connect-src 'self'; img-src 'self' blob:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    },
  });
}
