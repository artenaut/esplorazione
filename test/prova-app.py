"""Prove automatiche dell'app a sessioni (index.html) con Playwright e più «telefoni».

Serve un server locale con almeno l'esplorazione «lowrenzia» (vedi server/README.md, «Prove dell'app»):
    cd server && npx wrangler dev --port 8787 --persist-to <cartella>
Poi:
    python3 test/prova-app.py [--server http://127.0.0.1:8787]

L'app viene servita da un piccolo server statico e collegata al server locale con ?server=.
Esce con codice 1 se una prova fallisce.
"""
import argparse, functools, http.server, os, re, sys, threading
from playwright.sync_api import sync_playwright, expect

RADICE = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
esiti = []


def prova(nome):
    def deco(f):
        try:
            f()
            esiti.append((True, nome, ""))
        except Exception as e:  # noqa: BLE001
            esiti.append((False, nome, f"{type(e).__name__}: {str(e)[:400]}"))
        return f
    return deco


class Silenzioso(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--server", default="http://127.0.0.1:8787")
    args = ap.parse_args()

    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Silenzioso, directory=RADICE))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    APP = f"http://127.0.0.1:{srv.server_address[1]}/"
    Q = f"?server={args.server}"

    with sync_playwright() as p:
        browser = p.chromium.launch()
        errori = []

        def telefono(mobile=True):
            opts = dict(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True) if mobile else dict(viewport={"width": 1100, "height": 900})
            ctx = browser.new_context(**opts)
            pg = ctx.new_page()
            pg.on("pageerror", lambda e: errori.append(str(e)))
            pg.on("console", lambda m: m.type == "error" and "WebSocket" not in m.text and "status of 404" not in m.text and errori.append(m.text))
            return ctx, pg

        def nessuno_scorrimento(pg):
            w = pg.evaluate("[document.documentElement.scrollWidth, window.innerWidth]")
            assert w[0] <= w[1], f"scorrimento orizzontale {w}"

        stato = {}

        @prova("Schermata iniziale e codice sbagliato")
        def _():
            ctx, pg = telefono()
            pg.goto(APP + Q)
            expect(pg.get_by_role("button", name="Crea una partita")).to_be_visible()
            pg.fill("#codice", "ABC-123")
            pg.click("#entra-form button[type=submit]")
            expect(pg.locator(".banner.err")).to_contain_text("Non c’è nessuna partita")
            pg.fill("#codice", "12")
            pg.click("#entra-form button[type=submit]")
            expect(pg.locator(".banner.err")).to_contain_text("tre lettere e tre numeri")
            nessuno_scorrimento(pg)
            ctx.close()

        @prova("Il master crea la partita: codice, QR e codice master")
        def _():
            ctx, pg = telefono(mobile=False)
            stato["master"] = (ctx, pg)
            pg.goto(APP + Q)
            pg.click("text=Crea una partita")
            expect(pg.locator("input[name=mod]")).to_have_count(1)
            pg.click("#add")
            for i, n in enumerate(["Alba", "Bruno", "Cleo"]):
                pg.fill(f"#name-{i}", n)
            pg.click("#crea")
            expect(pg.locator(".codice-grande")).to_have_text(re.compile(r"^LWR-\d{3}$"))
            codice = pg.locator(".codice-grande").inner_text()
            stato["codice"] = codice
            assert pg.locator(".qr svg").count() == 1
            pg.click("details.master-code summary")
            assert len(pg.locator("#cm").inner_text()) >= 24
            expect(pg.locator(".tab")).to_have_count(3)
            # il master vede le carte di Alba, attive, con «Stai muovendo per»
            expect(pg.locator(".per-chi")).to_contain_text("Stai muovendo per Alba")

        @prova("Un telefono entra dal link del QR, sceglie il posto e lo ritrova dopo il ricaricamento")
        def _():
            ctx, pg = telefono()
            stato["alba"] = (ctx, pg)
            pg.goto(APP + Q + f"&partita={stato['codice']}")
            expect(pg.locator(".seat")).to_have_count(3)
            nessuno_scorrimento(pg)
            pg.locator(".seat", has_text="Alba").click()
            expect(pg.locator(".tab[aria-selected=true]")).to_contain_text("Alba (tu)")
            assert "partita=" not in pg.url
            pg.reload()
            expect(pg.locator(".tab[aria-selected=true]")).to_contain_text("Alba (tu)")
            # dal master il posto risulta occupato
            m = stato["master"][1]
            m.click("#gestisci")
            expect(m.locator(".seat-row", has_text="Alba")).to_contain_text("Telefono collegato")

        @prova("Mossa: il testo si vede solo all'ingresso, su tutti i telefoni che guardano quella scheda")
        def _():
            pg = stato["alba"][1]
            m = stato["master"][1]
            assert pg.locator(".card .content").count() == 0
            pg.locator("[data-pick]", has_text="Al Diavolo le mappe").click()
            pg.click("#enter")
            expect(pg.locator(".room.reveal .content")).to_contain_text("Goblin Fu-Furioso")
            expect(m.locator(".room.reveal .content")).to_contain_text("Goblin Fu-Furioso")
            expect(pg.locator(".tab[aria-selected=true]")).to_contain_text("Passo 1")
            assert not re.search(r"Passo \d+\s*(di|/|su)\s*\d+", pg.inner_text("body"))
            # cambiando scheda e tornando, il testo non c'è più
            pg.locator("[data-tab='1']").click()
            pg.locator("[data-tab='0']").click()
            assert pg.locator(".room.reveal").count() == 0
            assert "Goblin" not in pg.inner_text("body")
            # nel registro solo il titolo
            m.click("details.log summary")
            expect(m.locator(".log")).to_contain_text("Al Diavolo le mappe")
            assert "Goblin" not in m.locator(".log").inner_text()

        @prova("Chi gioca non muove per altri; il master sì e il registro lo segna")
        def _():
            pg = stato["alba"][1]
            m = stato["master"][1]
            pg.locator("[data-tab='1']").click()
            assert pg.locator("[data-pick]").first.is_disabled()
            expect(pg.locator(".panel", has_text="stanze tra cui scegliere")).to_contain_text("muove il master")
            m.locator("[data-tab='1']").click()
            expect(m.locator(".per-chi")).to_contain_text("Stai muovendo per Bruno")
            m.locator("[data-pick]").first.click()
            m.click("#enter")
            expect(m.locator(".log li").first).to_contain_text("dal master")

        @prova("Annulla: spiegazione a chi non può, annullamento dal master")
        def _():
            pg = stato["alba"][1]
            m = stato["master"][1]
            pg.click("#undo")
            expect(pg.locator("#modal")).to_contain_text("Non puoi annullare")
            pg.click("#m-act button")
            m.click("#undo")
            m.click("#m-act >> text=Annulla mossa")
            expect(m.locator(".tab").nth(1)).to_contain_text("All’ingresso")

        @prova("Tabellone in sola lettura")
        def _():
            ctx, pg = telefono(mobile=False)
            pg.goto(APP + Q)
            pg.fill("#codice", stato["codice"].lower().replace("-", ""))
            pg.click("#entra-form button[type=submit]")
            pg.click("#tabellone")
            expect(pg.locator(".tab")).to_have_count(3)
            assert pg.locator("#enter").count() == 0
            assert pg.locator("[data-pick]").first.is_disabled()
            stato["tab"] = (ctx, pg)

        @prova("Il master libera il posto: il telefono torna alla scelta e lo riprende")
        def _():
            pg = stato["alba"][1]
            m = stato["master"][1]
            m.locator(".seat-row", has_text="Alba").locator("[data-libera]").click()
            m.click("#m-act >> text=Libera il posto")
            expect(pg.locator(".banner")).to_contain_text("liberato il tuo posto")
            expect(pg.locator(".seat", has_text="Alba")).to_be_enabled()
            pg.locator(".seat", has_text="Alba").click()
            expect(pg.locator(".tab[aria-selected=true]")).to_contain_text("Alba (tu)")

        @prova("Aggiungi e togli esplorator*")
        def _():
            m = stato["master"][1]
            m.fill("#nuovo-nome", "Dario")
            m.click("#aggiungi-form button")
            expect(m.locator(".tab")).to_have_count(4)
            m.locator(".seat-row", has_text="Dario").locator("[data-togli]").click()
            m.click("#m-act >> text=Togli")
            expect(m.locator(".tab")).to_have_count(3)

        @prova("Chiudi partita con lo stesso gruppo: nuovo codice, il telefono resta seduto")
        def _():
            pg = stato["alba"][1]
            m = stato["master"][1]
            vecchio = stato["codice"]
            m.click("#chiudi-partita")
            m.click("#m-act >> text=Chiudi partita")
            m.click("#m-act >> text=Stesso gruppo")
            expect(m.locator(".codice-grande")).not_to_have_text(vecchio)
            nuovo = m.locator(".codice-grande").inner_text()
            stato["codice"] = nuovo
            # tutti i telefoni vedono il riepilogo della partita chiusa
            expect(pg.locator("#modal")).to_contain_text("Partita chiusa")
            expect(pg.locator("#modal")).to_contain_text("Alba: 0 cicli completati")
            pg.click("#m-act >> text=Continua")
            m.click("#m-act >> text=Continua")
            expect(pg.locator(".sessione-info")).to_contain_text(nuovo)
            expect(pg.locator(".tab[aria-selected=true]")).to_contain_text("Alba (tu)")
            expect(pg.locator(".tab").first).to_contain_text("All’ingresso")
            # il tabellone resta tabellone anche nella nuova partita
            t = stato["tab"][1]
            t.click("#m-act >> text=Continua")
            expect(t.locator(".sessione-info")).to_contain_text(nuovo)
            expect(t.locator(".sessione-info")).to_contain_text("tabellone")

        @prova("Annulla partita e torna all'inizio: tutti vedono la fine")
        def _():
            pg = stato["alba"][1]
            m = stato["master"][1]
            if m.locator("#chiudi-partita").count() == 0:
                m.click("#gestisci")
            m.click("#annulla-partita")
            m.click("#m-act >> text=Annulla partita")
            m.click("#m-act >> text=Torna all’inizio")
            expect(m.locator("h2", has_text="Partita annullata")).to_be_visible()
            expect(pg.locator("h2", has_text="Partita annullata")).to_be_visible()
            pg.click("#inizio")
            expect(pg.get_by_role("button", name="Crea una partita")).to_be_visible()
            nessuno_scorrimento(pg)

        @prova("Nessun errore nella pagina")
        def _():
            assert not errori, errori[:5]

        browser.close()
    srv.shutdown()

    for ok, nome, dettaglio in esiti:
        print(("  ✓ " if ok else "  ✗ ") + nome + (f"\n      {dettaglio}" if dettaglio else ""))
    falliti = sum(not ok for ok, *_ in esiti)
    print(f"\n{len(esiti) - falliti}/{len(esiti)} prove superate")
    sys.exit(1 if falliti else 0)


if __name__ == "__main__":
    main()
