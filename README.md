# midterm-live

Sito statico per seguire in diretta i risultati delle elezioni di metà mandato USA
del 3 novembre 2026: Senato (35 gare), Camera (435 distretti) e Governatori (36).

Nessuna dipendenza esterna a runtime: HTML, CSS e JavaScript puri, i contorni degli
stati sono pre-calcolati in `states.js`, e c'è un piccolo server Python opzionale.

## Online

Il sito è pubblicato con GitHub Pages su https://bryanoberholzer00-bot.github.io/midterm-live/
(modalità demo: https://bryanoberholzer00-bot.github.io/midterm-live/?demo=1).
Lì il proxy Python non c'è: la pagina legge i feed del NYT direttamente dal browser.

## Avvio in locale

```bash
python proxy.py
```

Poi apri http://127.0.0.1:8787 nel browser. Porta diversa: `python proxy.py 9000`.

La pagina funziona anche da qualsiasi altro server statico (o da GitHub Pages): i feed
del NYT hanno `Access-Control-Allow-Origin: *`, quindi il browser li legge direttamente.
`proxy.py` serve solo come riserva se un giorno il CORS dovesse chiudersi (la pagina in
quel caso passa da sola a `/feed/<ufficio>.json`).

## Cosa mostra

- **Emicicli di Senato e Camera** con i seggi assegnati (colore pieno), quelli dove un
  partito è in vantaggio (colore chiaro), la tacca della maggioranza (51 / 218), seggi
  strappati, situazione pre-voto, voto popolare nazionale per la Camera e una linea
  dell'andamento dei seggi nel corso della serata (salvata nel browser).
- **Mappa geografica** degli stati (proiezione Albers USA, con Alaska e Hawaii negli
  inserti) o, in alternativa, **mappa a tessere**. Per la Camera la mappa geografica
  disegna i **435 distretti con i confini in vigore per il 2026** (comprese le mappe
  ridisegnate a metà decennio); nella vista a tessere ogni quadratino è un distretto.
  Si ingrandisce con Ctrl + rotella, con i pulsanti o con doppio clic su uno stato, e
  da ingrandita si sposta trascinando.
- **Mappa dello spostamento** (pulsante *Spostamento*): per ogni gara con almeno il 10%
  scrutinato una freccia verso sinistra (Dem) o destra (Rep), lunga quanto i punti di
  margine guadagnati rispetto alle presidenziali 2024, più lo spostamento medio pesato
  per i voti.
- **Mappa dei distretti dello stato** nel pannello di dettaglio della Camera, con i
  numeri dei distretti; un clic apre il distretto e la sua mappa per contea, con il
  confine del distretto disegnato sopra.
- **Scenari per la maggioranza** (Senato e Camera): per ogni gara aperta scegli D, R o
  "non deciso" e vedi subito chi arriva a 51/218. Si parte dalla proiezione semplice,
  le gare già assegnate restano fisse e le scelte sono salvate nel browser.
- **Tooltip** passando il mouse su stati, distretti e contee, con candidati,
  percentuali, quota scrutinata e confronto 2024.
- **Proiezione semplice** sotto ogni camera: seggi già assegnati + chi è in vantaggio
  dove si conta + rating NYT dove non ci sono voti. Non è un modello statistico.
- **Cronaca della serata**: confrontando ogni aggiornamento con il precedente, la pagina
  annota assegnazioni, primi voti, cambi in testa e grandi blocchi di schede (almeno 15
  punti di scrutinio in un colpo), con l'ora; per la Camera solo le gare competitive.
  Si filtra per tipo o per camera, un clic apre la gara, e resta salvata nel browser se
  ricarichi la pagina.
- **In bilico**: le 12 gare aperte con lo scarto più piccolo, con la quota dei voti
  restanti che servirebbe a chi insegue.
- **Pannello di dettaglio** per stato, fisso a lato della mappa: foto dei candidati, voti,
  percentuali, quota di voto atteso scrutinata, orario dell'assegnazione, link alla
  pagina NYT, più due analisi calcolate dalla pagina:
  - *voti ancora da contare* (stima dal voto atteso) e quale percentuale dei restanti
    servirebbe a chi insegue per recuperare;
  - *confronto con le presidenziali 2024* nello stesso stato o distretto, con lo
    spostamento in punti verso l'uno o l'altro partito.
- **Risultati per contea** nel pannello di dettaglio: mappa dello stato colorata per
  partito in testa e ampiezza del vantaggio, oppure per spostamento rispetto alle
  presidenziali 2024; tabella delle contee dove mancano più voti; grafico
  dell'andamento dello spoglio (margine al crescere dei voti contati). Per la Camera la
  mappa si apre col pulsante *Per contea* o cliccando un distretto, e zooma sulle contee
  del distretto. Nel Nord-Est i voti arrivano per comune e la pagina li somma per
  contea; l'Alaska riporta per distretto statale, quindi lì c'è solo la tabella.
- **Come si è votato**: per Senato, Governatori e Camera, il margine separato tra voto
  anticipato, per posta e del giorno del voto, con la quota già scrutinata di ciascuno.
  Se un tipo di voto è molto più indietro, la pagina dice verso quale partito tende a
  spostarsi il margine (tendenza, non previsione).
- **Nello stesso stato**: in fondo al pannello di dettaglio, i referendum statali e le
  altre cariche statali al voto (procuratore generale, vicegovernatore, segretario di
  Stato, corti…), con i nomi delle cariche in italiano.
- **Referendum statali** di tutto il paese (circa 150 in 40 stati): si caricano con un
  pulsante, si filtrano per esito o per tema e si aggiornano ogni 2 minuti. La barra
  mostra Sì e No e la soglia richiesta (per esempio il 55% per gli emendamenti in
  Colorado). Un clic apre lo stato.
- **Gare chiave** (incerte o con favorito) con clic che apre lo stato sulla mappa;
  **ricerca** per stato o candidato in tutte e tre le categorie.
- **Ultime assegnazioni**, con toast in pagina e, se attivati, notifiche del browser e
  un suono a ogni nuova chiamata (suono diverso per i seggi strappati).
- **Guida alla serata**: gli orari di chiusura dei seggi in ora locale, con per ciascuno
  gli stati e le gare in bilico da guardare (un clic le apre); nell'intestazione la
  prossima chiusura con il conto alla rovescia, e un avviso quando un gruppo di stati
  chiude con la pagina aperta.
- **Installabile sul telefono** come app (manifest e service worker): i contorni di
  stati, distretti e contee restano in memoria, mentre pagina e risultati arrivano
  sempre dalla rete. Su iPhone: Condividi → Aggiungi alla schermata Home.
- Pulsante *Condividi* nel pannello dello stato (link alla vista corrente); le nuove
  assegnazioni vengono annunciate ai lettori di schermo e, con la scheda in
  background, contate nel titolo della scheda.
- Tema scuro/chiaro/automatico; scheda, stato selezionato e tipo di mappa restano
  nell'URL (`#ufficio=H&stato=TX&vista=tile`), così un link riapre la stessa vista.

Aggiornamento automatico ogni 30 secondi (15 s – 2 min dal menu), con pulsante Pausa.
La mappa geografica si costruisce una volta per ufficio: agli aggiornamenti cambiano
solo i colori, senza ridisegnare il megabyte di contorni dei distretti.
Le richieste sono condizionate (ETag): se il file non è cambiato il server risponde 304
e non si riscarica nulla; in più la pagina confronta l'intestazione Last-Modified e,
se il file è identico, non lo rianalizza (l'intestazione mostra "nessuna novità").
Con la scheda in background e senza notifiche né suono l'aggiornamento si sospende e
riparte appena torni sulla pagina.

Scorciatoie da tastiera: `1` `2` `3` schede, `M` tipo di mappa, `+` `-` `0` zoom,
`Z` zoom sullo stato selezionato, `/` cerca, `R` aggiorna subito, `P` pausa, `Esc`
chiude lo stato selezionato.

## Collaudo con un'elezione vera: modalità archivio

Con `?data=2024-11-05` la pagina carica le elezioni del 5 novembre 2024 dallo stesso
archivio del NYT, con tutti i risultati definitivi: è il modo per vedere la pagina piena
di dati reali e per controllare che legga bene i feed. Sul 2024 i numeri tornano con
quelli ufficiali (Senato 53–47 con 4 seggi strappati dai Rep, Camera 220–215 con 4 e 5
seggi cambiati di mano, Alaska decisa al secondo turno del voto a scelta multipla).
In archivio la mappa della Camera usa le tessere, perché i confini 2026 non valgono per
il 2024.

Il collaudo ha corretto tre cose che con i dati di stanotte sarebbero uscite sbagliate:
il campo "seggio strappato" nei feed è vero/falso e non il partito; la soglia di
maggioranza va letta dal feed (51 per entrambi nel 2024, 50 per i Rep nel 2026);
nei referendum le opzioni non sono sempre Sì/No (For/Against, Repeal/Retain).

## Robustezza

- Se uno dei tre file nazionali non arriva, gli altri vengono mostrati lo stesso e lo
  stato dice quale non è aggiornato (passando sopra si legge il motivo); al giro dopo
  si riprova. Un file viene segnato come "già letto" solo dopo che è stato usato.
- Ogni richiesta ha un limite di 40 secondi: una connessione bloccata non ferma gli
  aggiornamenti.
- Un aggiornamento alla volta: quelli chiesti nel frattempo (tasto R, Riprendi) partono
  subito dopo; una risposta più vecchia di quella già mostrata viene scartata.
- Pagina, script e stili hanno un numero di versione (`?v=9`) e il service worker li
  chiede senza passare dalla cache HTTP, così dopo una pubblicazione non si mescolano
  versioni diverse.
- **Risparmio dati** (si attiva da solo su reti lente o con il risparmio dati del
  telefono): il file della Camera, il più pesante, si aggiorna un giro su quattro quando
  non la stai guardando. Sugli schermi piccoli l'intervallo predefinito è 60 secondi.

Quando si cambia `app.js`, `style.css` o `index.html`, aumentare il numero `?v=` in
`index.html`.

## Modalità demo

http://127.0.0.1:8787/?demo=1 inventa voti e assegnazioni a partire dalle gare vere,
per vedere la pagina "piena" prima che arrivino i risultati. I numeri sono casuali e
cambiano ogni due minuti; l'intestazione lo segnala in modo esplicito.

## Fonte dei dati

File JSON pubblici del New York Times (dati Associated Press):

```
https://static01.nyt.com/elections-assets/pages/data/2026-11-03/results-senate.json
https://static01.nyt.com/elections-assets/pages/data/2026-11-03/results-house.json
https://static01.nyt.com/elections-assets/pages/data/2026-11-03/results-governor.json
```

Per referendum e cariche statali la pagina legge il file dello stato
(`results-<stato>.json`, per esempio `results-missouri.json`), e per sapere quali
stati hanno referendum usa l'indice di ricerca del NYT
(`feeds/<id>/search/2026-11-03.json`).

Per i risultati per contea la pagina legge anche il file della singola gara, ricavato
dal link NYT della gara (per esempio `results-texas-us-senate.json`,
`results-california-us-house-22.json`), che contiene `reporting_units` per contea o
comune e `timeseries` con l'andamento dello spoglio. Lo scarica solo per lo stato
aperto nel pannello di dettaglio.

Campi usati: `races[].top_reporting_unit` (voti, `eevp` = % del voto atteso scrutinato,
`total_expected_vote`, sezioni, `historical_comparison_race_data` per il 2024),
`candidate_metadata` (nomi, partito, uscente, foto), `outcome.won` / `winner_accepted_at`
/ `gained` (vincitore, orario, seggio strappato), `rating` (previsione NYT),
`partyControlData` (bilancio delle camere), `pollClosingTimes`, e la gara con
`coverage: "national"` nel file della Camera per il voto popolare.

È un feed non ufficiale e non documentato: può cambiare struttura o sparire senza
preavviso. Il file della Camera pesa circa 7 MB (280 KB compresso).

## Contorni di stati e contee

`states.js` e la cartella `counties/` (un file per stato) sono generati a partire da
`states-10m.json` e `counties-10m.json` del pacchetto
[us-atlas](https://github.com/topojson/us-atlas) (dominio pubblico, Census Bureau).
Gli script replicano la proiezione `geoAlbersUsa` di d3 in Python puro:

```bash
python tools/genera_stati.py states-10m.json > states.js
python tools/genera_contee.py counties-10m.json counties
```

`districts.js` contiene i confini dei distretti della Camera validi per il voto 2026,
scaricati dal servizio TIGERweb del Census Bureau (layer "120th Congressional
Districts", vintage 1 gennaio 2026), già semplificati e proiettati come gli stati:

```bash
python tools/genera_distretti.py > districts.js
```

Le icone si rigenerano con `python tools/genera_icone.py`. Se cambiano i contorni,
aumentare il numero di versione `CACHE` in `sw.js`, altrimenti chi ha già aperto il sito
continua a usare quelli vecchi.

Il proxy locale accetta anche `/feed/race/<slug>.json` per i file delle singole gare.
