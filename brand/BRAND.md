# TrainMind · marchio

TrainMind programma e gestisce la settimana di allenamento (morfociclo, sedute, carichi, squadre, formazione). Fa parte della suite **Mind** insieme a MatchMind (analisi video della partita).

Payoff: **La settimana, pensata.** (in coppia con «La partita, letta.» di MatchMind)

Manuale visivo completo: `brand.html` (aprilo nel browser).

## Regole della suite Mind
- Icona: riquadro `#161a1f`, griglia 64, raggio 14, linee spesse 3.5.
- Dentro c'è sempre il **campo** (rettangolo `x8 y16 48×32 r2`): è l'elemento comune.
- Ogni app aggiunge il proprio contenuto nel campo e ha **un solo colore d'accento**.
- Nome: `[OGGETTO]MIND` in Barlow Condensed 800 maiuscolo; `MIND` nel colore d'accento.

| App | Accento | Contenuto del campo | Stato |
|---|---|---|---|
| MatchMind | `#E6AD46` ambra | linea di metà campo, cerchio, aree | in uso |
| TrainMind | `#4DB582` verde campo | curva del carico + punto partita | in uso |
| ScoutMind | `#5B97FF` blu | lente | proposta |
| BoardMind | `#E5E8EC` gesso | freccia curva | proposta |
| ClubMind | `#C98BD9` lilla | scudo | proposta |

## Icona TrainMind
- Campo: il terreno di gioco.
- Curva (`13,41 21,29 29,23 37,31 45,37`): il carico del morfociclo. MD+1 recupero, MD-5 tensione, MD-3 durata (picco), MD-2 velocità, MD-1 attivazione.
- Punto (`51,25 r3.6`): la partita.

## Colori
| Nome | Valore | Uso |
|---|---|---|
| Verde campo | `#4DB582` | accento su scuro, icona |
| Verde profondo | `#1D6A46` | accento su chiaro, pulsanti (bianco sopra 6:1) |
| Lavagna | `#161A1F` | fondo dell'icona (comune alla suite) |
| Gesso | `#ECEFE9` | fondo chiaro dell'app |
| Notte | `#0F1612` | fondo scuro dell'app |

Colori MD (solo per riconoscere i giorni): MD+1 `#3C7BA3`, MD-5 `#B2402B`, MD-3 `#1D6A46`, MD-2 `#B58010`, MD-1 `#6A58A6`, MD `#D9581A`. Variabili in `tokens.css`.

## Caratteri
- Titoli: Barlow Condensed 700/800, maiuscolo (comune con MatchMind).
- Testo: Source Sans 3 400/600.
- Dati: JetBrains Mono 400/500.

I file `trainmind-logo-*.svg` usano Barlow Condensed come testo: se il carattere non è installato si vede un sostituto. Per stampa o grafiche, convertire il testo in tracciati.

## Da evitare
Icona ruotata o ricolorata, nome in altro carattere o in corsivo, due accenti nello stesso marchio, colori MD usati come decorazione.

## File
- `trainmind-icon.svg`: icona a colori su riquadro.
- `trainmind-icon-mono.svg`: icona a un colore (`currentColor`), senza riquadro.
- `trainmind-logo-dark.svg` / `trainmind-logo-light.svg`: icona + nome.
- `matchmind-icon.svg`: copia dell'icona di MatchMind, per riferimento.
- `tokens.css`: variabili CSS.
