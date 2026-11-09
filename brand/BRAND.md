# TrainMind · marchio

TrainMind programma e gestisce la settimana di allenamento (morfociclo, sedute, carichi, squadre, formazione). Fa parte della suite **Mind** insieme a MatchMind (analisi video della partita).

Payoff: **La settimana, pensata.** (in coppia con «La partita, letta.» di MatchMind)

Manuale visivo completo: `brand.html` (aprilo nel browser).

## Regole della suite Mind
- Icona: riquadro `#161a1f`, griglia 64, raggio 14.
- Dentro c'è una forma presa dal campo da gioco: MatchMind il campo intero, TrainMind il cerchio di centrocampo.
- Ogni app ha il suo colore d'accento. L'ambra della partita (`#E6AD46`) è l'unico colore che passa da un'app all'altra.
- Nome: `[OGGETTO]MIND` in Barlow Condensed 800 maiuscolo; `MIND` nel colore d'accento.

| App | Accento | Icona | Stato |
|---|---|---|---|
| MatchMind | `#E6AD46` ambra | campo con metà campo, cerchio e aree | in uso |
| TrainMind | `#4DB582` verde campo | settimana a 7 spicchi (Ciclo) | in uso |
| ScoutMind | `#5B97FF` blu | lente | proposta |
| BoardMind | `#E5E8EC` gesso | freccia curva | proposta |
| ClubMind | `#C98BD9` lilla | scudo | proposta |

## Icona TrainMind (Ciclo)
- Cerchio di 7 spicchi (raggio 19, spessore 7, spazio 7,2° tra gli spicchi): la settimana, dal **lunedì in alto** in senso orario. È il morfociclo.
- Spicchi verdi `#4DB582`: allenamenti di lunedì (MD-5), mercoledì (MD-3), giovedì (MD-2).
- Spicchio ambra `#E6AD46`: la partita del sabato, nel colore di MatchMind.
- Spicchi spenti `#2C3832`: giorni senza seduta.
- Centro `#E5E8EC` (raggio 4): il pallone e il dischetto di centrocampo.
- Versione a un colore: spicchi spenti al 30%.

## Colori
| Nome | Valore | Uso |
|---|---|---|
| Verde campo | `#4DB582` | accento su scuro, icona |
| Verde profondo | `#1D6A46` | accento su chiaro, pulsanti (bianco sopra 6:1) |
| Lavagna | `#161A1F` | fondo dell'icona (comune alla suite) |
| Ambra | `#E6AD46` | MatchMind, e la partita nell'icona di TrainMind |
| Gesso | `#ECEFE9` | fondo chiaro dell'app |
| Notte | `#0F1612` | fondo scuro dell'app |

Colori MD (solo per riconoscere i giorni): MD+1 `#3C7BA3`, MD-5 `#B2402B`, MD-3 `#1D6A46`, MD-2 `#B58010`, MD-1 `#6A58A6`, MD `#D9581A`. Variabili in `tokens.css`.

## Caratteri
- Titoli: Barlow Condensed 700/800, maiuscolo (comune con MatchMind).
- Testo: Source Sans 3 400/600.
- Dati: JetBrains Mono 400/500.

I file `trainmind-logo-*.svg` usano Barlow Condensed come testo: se il carattere non è installato si vede un sostituto. Per stampa o grafiche, convertire il testo in tracciati.

## Da evitare
Icona ruotata (il lunedì sta sempre in alto) o ricolorata, spicchi con i colori MD, nome in altro carattere o in corsivo, colori MD usati come decorazione.

## File
- `trainmind-icon.svg`: icona a colori su riquadro.
- `trainmind-icon-mono.svg`: icona a un colore (`currentColor`), senza riquadro.
- `trainmind-logo-dark.svg` / `trainmind-logo-light.svg`: icona + nome.
- `matchmind-icon.svg`: copia dell'icona di MatchMind, per riferimento.
- `tokens.css`: variabili CSS.
