"""Prove automatiche dell'app (index.html + motore.js) con Playwright.

Uso:  python3 test/prova-app.py [cartella]   (predefinita: la cartella del repository)

Serve la cartella con un piccolo server locale e controlla: partita completa,
testi delle stanze visibili solo all'ingresso, passo senza totale, annulla,
ricomincia, estrazione «meno mostrate», controlli del formato, simulatore e
vista telefono. Esce con codice 1 se una prova fallisce.
"""
import functools, http.server, json, os, re, sys, tempfile, threading
from playwright.sync_api import sync_playwright

RADICE = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), ".."))
esiti = []


def prova(nome):
    def deco(f):
        def avvolta(*a):
            try:
                f(*a)
                esiti.append((True, nome, ""))
            except Exception as e:  # noqa: BLE001
                esiti.append((False, nome, f"{type(e).__name__}: {e}"))
        return avvolta
    return deco


class Silenzioso(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def avvia_server():
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Silenzioso, directory=RADICE))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, f"http://127.0.0.1:{srv.server_address[1]}/"


def nuova_pagina(browser, url, errori, **opts):
    ctx = browser.new_context(**opts)
    pg = ctx.new_page()
    pg.on("pageerror", lambda e: errori.append(str(e)))
    pg.on("console", lambda m: m.type == "error" and errori.append(m.text))
    pg.goto(url)
    pg.wait_for_selector("#start")
    return ctx, pg


def inizia(pg, nomi):
    while pg.locator(".name-row").count() < len(nomi):
        pg.click("#add")
    for i, n in enumerate(nomi):
        pg.fill(f"#name-{i}", n)
    pg.click("#start")
    pg.wait_for_selector(".cards")


def entra_prima(pg):
    pg.locator("[data-pick]").first.click()
    pg.click("#enter")


def stato(pg):
    return pg.evaluate("JSON.parse(localStorage.getItem('dungeon.state'))")


def main():
    srv, url = avvia_server()
    with sync_playwright() as p:
        browser = p.chromium.launch()

        @prova("Caricamento senza errori e motore.js come modulo")
        def _():
            err = []
            ctx, pg = nuova_pagina(browser, url, err)
            chiavi = pg.evaluate("import('./motore.js').then(m=>Object.keys(m).sort())")
            assert chiavi == sorted(["compile", "drawOffer", "nextOfNode", "pickRooms", "sample", "shuffle", "simulate", "validateModule"]), chiavi
            assert "Lowrenzia" in pg.inner_text(".mods")
            assert not err, err
            ctx.close()
        _()

        @prova("Partita: testo solo all'ingresso, passo senza totale, giri completati")
        def _():
            err = []
            ctx, pg = nuova_pagina(browser, url, err)
            inizia(pg, ["Alba", "Bruno"])
            # nelle proposte nessun testo
            assert pg.locator(".card .content").count() == 0
            entra_prima(pg)
            assert pg.locator(".room.reveal .content").count() == 1, "il testo non compare all'ingresso"
            # cambiando scheda e tornando il testo non si vede più
            pg.click("[data-tab='1']"); pg.click("[data-tab='0']")
            assert pg.locator(".room.reveal").count() == 0, "il testo resta visibile dopo aver cambiato scheda"
            # 60 mosse alternate: nessun «di N» nel passo, giri che si chiudono
            for k in range(60):
                pg.click(f"[data-tab='{k % 2}']")
                entra_prima(pg)
                testo = pg.inner_text("body")
                assert not re.search(r"Passo \d+\s*(di|/|su)\s*\d+", testo), "compare la lunghezza totale"
            s = stato(pg)
            assert all(q["run"] >= 2 for q in s["players"]), [q["run"] for q in s["players"]]
            assert len(s["log"]) == 61
            # il testo non è mai nel registro
            log = pg.inner_text(".log")
            assert "Sorveglia" not in log and "Profetizza" not in log
            assert not err, err
            ctx.close()
        _()

        @prova("Annulla ripristina posizione e contatori; Ricomincia azzera")
        def _():
            err = []
            ctx, pg = nuova_pagina(browser, url, err)
            inizia(pg, ["Alba", "Bruno", "Cleo"])
            for _k in range(3):
                entra_prima(pg)
            prima = stato(pg)
            entra_prima(pg)
            pg.click("#undo"); pg.click("text=Annulla mossa")
            dopo = stato(pg)
            assert dopo["players"] == prima["players"], "giocatori diversi dopo Annulla"
            assert dopo["shown"] == prima["shown"], "contatori non ripristinati"
            pg.click("#reset"); pg.click("text=Stesso gruppo")
            s = stato(pg)
            assert s["shown"] == {} and s["log"] == [] and [q["name"] for q in s["players"]] == ["Alba", "Bruno", "Cleo"]
            assert not err, err
            ctx.close()
        _()

        @prova("Estrazione «meno mostrate»: le stanze ruotano in modo uniforme")
        def _():
            err = []
            ctx, pg = nuova_pagina(browser, url, err)
            esito = pg.evaluate("""async () => {
              const M = await import('./motore.js');
              // pianeta di prova: un livello con 6 stanze, 2 proposte a ogni passo
              const st = (p,n) => Array.from({length:n},(_,i)=>({id:p+i,titolo:p+i,via:'a',testo:'x'}));
              const src = { formato:2, id:'prova', nome:'Prova', estrazione:'meno-mostrate',
                vie:[{id:'a',nome:'A',colore:'#112233'}],
                ingresso:{nome:'I',stanze:st('I',1),successivo:'L'},
                livelli:{ L:{stanze:st('L',6),proposte:{a:{a:2}},successivo:'finale'} },
                finale:{stanze:st('F',1),proposte:{a:{a:1}}} };
              const errore = M.validateModule(src);
              const m = M.compile(src), shown = {};
              for(let i=0;i<30;i++) M.drawOffer(m,'L','a',shown,{});
              const v = Object.keys(m.nodes.L.rooms.reduce((o,r)=>(o[r.id]=1,o),{})).map(id=>shown[id]||0);
              return { errore, v, next: M.nextOfNode(m,'L','a'), fin: M.nextOfNode(m,'finale','a') };
            }""")
            assert esito["errore"] is None, esito
            assert max(esito["v"]) - min(esito["v"]) == 0, esito["v"]  # 60 estrazioni su 6 stanze: 10 ciascuna
            assert esito["next"] == "finale" and esito["fin"] == "ingresso"
            assert not err, err
            ctx.close()
        _()

        @prova("Controlli del formato e area admin (carica, id riservato, simulatore)")
        def _():
            err = []
            ctx, pg = nuova_pagina(browser, url, err)
            pg.goto(url + "#admin"); pg.reload()
            pg.fill("#pw", "dungeon"); pg.click("button[type=submit]")
            pg.wait_for_selector("#sim-run")
            base = {"formato": 2, "id": "pianeta-prova", "nome": "Pianeta di prova",
                    "vie": [{"id": "a", "nome": "A", "colore": "#112233"}],
                    "ingresso": {"nome": "I", "stanze": [{"id": "I1", "titolo": "I1", "via": "a", "testo": "t"}], "successivo": "L"},
                    "livelli": {"L": {"stanze": [{"id": f"L{i}", "titolo": f"L{i}", "via": "a", "testo": "t"} for i in range(3)],
                                      "proposte": {"a": {"a": 2}}, "successivo": "finale"}},
                    "finale": {"stanze": [{"id": "F1", "titolo": "F1", "via": "a", "testo": "t"}], "proposte": {"a": {"a": 1}}}}
            casi = [
                ("non json {", "non è un JSON valido"),
                (json.dumps({**base, "id": "lowrenzia"}), "già usato"),
                (json.dumps({**base, "livelli": {"L": {**base["livelli"]["L"], "proposte": {"a": {"a": 5}}}}}), "ce ne sono solo 3"),
                (json.dumps({**base, "livelli": {"L": {**base["livelli"]["L"], "successivo": "X"}}}), "che non esiste"),
                (json.dumps(base), None),
            ]
            with tempfile.TemporaryDirectory() as d:
                for i, (contenuto, atteso) in enumerate(casi):
                    f = os.path.join(d, f"p{i}.json")
                    open(f, "w").write(contenuto)
                    pg.set_input_files("#file", f)
                    if atteso:
                        pg.wait_for_selector(".err")
                        assert atteso in pg.inner_text(".err"), (atteso, pg.inner_text(".err"))
                    else:
                        pg.wait_for_selector(".okmsg")
            assert "Pianeta di prova" in pg.inner_text(".mods")
            pg.select_option("#sim-games", "100")
            pg.click("#sim-run")
            pg.wait_for_function("document.getElementById('sim-out').innerText.length > 200")
            # il pianeta caricato resta valido dopo il ricaricamento della pagina
            pg.goto(url); pg.wait_for_selector("#start")
            assert "Pianeta di prova" in pg.inner_text(".mods")
            assert not err, err
            ctx.close()
        _()

        @prova("Vista telefono: nessuno scorrimento orizzontale")
        def _():
            err = []
            ctx, pg = nuova_pagina(browser, url, err, viewport={"width": 360, "height": 740}, device_scale_factor=2, is_mobile=True, has_touch=True)
            inizia(pg, ["Alba", "Bruno", "Cleo", "Dario"])
            for _k in range(6):
                entra_prima(pg)
            larghezza = pg.evaluate("[document.documentElement.scrollWidth, window.innerWidth]")
            assert larghezza[0] <= larghezza[1], larghezza
            assert not err, err
            ctx.close()
        _()

        browser.close()
    srv.shutdown()

    for ok, nome, dettaglio in esiti:
        print(("  ✓ " if ok else "  ✗ ") + nome + (f"\n      {dettaglio}" if dettaglio else ""))
    falliti = sum(not ok for ok, *_ in esiti)
    print(f"\n{len(esiti) - falliti}/{len(esiti)} prove superate")
    sys.exit(1 if falliti else 0)


if __name__ == "__main__":
    main()
