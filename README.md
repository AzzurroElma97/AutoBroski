# AutoBroskiGroup online - guida semplice

## Cosa hai in mano
Hai un sito/app che puoi mettere online gratis e aprire da telefono, PC o tablet.

## A cosa serve ogni pezzo
- `index.html` = la tua app.
- `config.js` = dove scrivi i tuoi dati di accesso.
- `cloud-sync.js` = salva e sincronizza i dati.
- `supabase-schema.sql` = crea la tabella online.
- `vercel.json` = aiuta Vercel a pubblicare il sito.

## Come funziona in modo semplice
1. Metti il codice su GitHub.
2. Colleghi GitHub a Vercel.
3. Metti la tabella su Supabase.
4. Inserisci URL e chiavi in `config.js`.
5. Apri il sito da qualunque dispositivo.
6. Quando cambi un dato, l'app prova a salvarlo online.

## PIN a 6 cifre
All'apertura l'app chiede un PIN semplice di 6 cifre.
Non è un login complesso, è solo un blocco rapido per entrare.

## Dove vanno i dati
- Se Supabase è configurato, i dati stanno online.
- Se non lo configuri, l'app continua in locale.
- Se configuri bene tutto, i dati si aggiornano anche sugli altri dispositivi.

## Prima di iniziare
Ti servono solo:
- account GitHub;
- account Supabase;
- account Vercel.

## La cosa più importante
Non devi modificare tutto ogni volta.
Di solito aggiorni solo l'app su GitHub e i dati restano su Supabase.
