"""Costruisce web/index.html (versione online) dai sorgenti in app/src.
Uso: python3 scripts/build-web.py"""
import pathlib
root = pathlib.Path(__file__).resolve().parent.parent
src = lambda f: (root / "app" / "src" / f).read_text()
head = """<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>TrainMind</title>
<meta name="description" content="TrainMind: programmazione della settimana di allenamento con assistente AI.">
<meta name="theme-color" content="#0F1612">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="TrainMind">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700;800&family=Source+Sans+3:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600&display=swap">
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.3/dist/umd/supabase.js"></script>
<script src="config.js"></script>
<script src="cloud.js"></script>
<style>
:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}
body{margin:0}
"""
out = head + src("style.css") + "</style>\n</head>\n<body>\n" + src("body.html") \
    + '\n<script id="core">' + src("core.js") + src("board.js") + "</script>\n<script>" + src("app.js") + "</script>\n</body>\n</html>\n"
(root / "web" / "index.html").write_text(out)
print("web/index.html", len(out), "byte")
