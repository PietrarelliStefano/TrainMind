# TrainMind

App della suite Mind per programmare e gestire la settimana di allenamento: morfociclo (periodizzazione tattica), sedute ed esercizi disegnati, carichi sRPE, squadre e formazione proposte, PDF da campo, assistente AI. Configurata per la Cosov U19.

È una pagina web unica pubblicata come artifact su claude.ai (i dati stanno nell'account, in un database dell'artifact): https://claude.ai/artifact/QUxNsMZqUz5Z3SwDAgQzvw

## Versione online
TrainMind può girare anche fuori da claude.ai, su Vercel e Supabase, con accesso su invito e dati separati per ogni allenatore: istruzioni in [ONLINE.md](ONLINE.md).

## Struttura
- `app/trainmind.html`: la pagina pubblicata, costruita dai sorgenti.
- `app/src/`: sorgenti.
  - `core.js`: metodo (giorni MD, modelli di seduta, esercizi di base, carichi, monotonia).
  - `board.js`: lavagna (schemi degli esercizi, disegno, editor).
  - `app.js`: interfaccia, AI, squadre, formazione, PDF.
  - `style.css`, `body.html`.
- `web/`, `api/`, `supabase/`: versione online (pagina, assistente sul server, database).
- `brand/`: logo e regole del marchio (`BRAND.md`, manuale visivo in `brand.html`).

## Costruzione
La pagina è l'unione dei sorgenti: `<head>` (titolo, font, jsPDF da cdnjs) + `<style>` con `style.css` + `body.html` + `<script>` con `core.js` e `board.js` + `<script>` con `app.js`.

```bash
cd app && python3 - <<'PY'
head = open('trainmind.html').read().split('<style>')[0]
src = lambda f: open('src/' + f).read()
out = head + '<style>\n' + src('style.css') + '</style>\n\n' + src('body.html') \
    + '\n<script id="core">' + src('core.js') + src('board.js') + '</script>\n<script>' + src('app.js') + '</script>\n'
open('trainmind.html', 'w').write(out)
PY
```
