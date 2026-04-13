# AutoBroskiGroup - GitHub/Vercel/Supabase starter

Questo pacchetto è pensato per pubblicare la mini app gratis online e usarla da più dispositivi.

## Cosa c'è dentro
- `index.html` -> app principale
- `cloud-sync.js` -> PIN 6 cifre + sync realtime con Supabase
- `config.js` -> configurazione da compilare
- `config.example.js` -> copia di esempio
- `supabase-schema.sql` -> tabella database

## Come funziona
- Il sito va su GitHub e poi su Vercel.
- I dati si salvano localmente e, se configuri Supabase, vengono anche salvati online.
- Ogni modifica prova a salvarsi automaticamente dopo circa 1.2 secondi.
- Se apri la stessa workspace su un altro dispositivo, i dati si aggiornano anche lì.

## Setup rapido
1. Crea un account GitHub.
2. Crea un account Supabase.
3. In Supabase crea un nuovo progetto.
4. Apri SQL Editor e incolla `supabase-schema.sql`.
5. In `config.js` inserisci:
   - `supabaseUrl`
   - `supabaseAnonKey`
   - `workspaceId`
   - `pin`
6. Carica tutti i file su un repository GitHub.
7. Collega il repository a Vercel.
8. Vercel pubblicherà il sito automaticamente.

## Esempio config.js
```js
window.ABG_CONFIG = {
  supabaseUrl: 'https://TUO-PROGETTO.supabase.co',
  supabaseAnonKey: 'TUA-ANON-KEY',
  workspaceId: 'autobroski-main',
  pin: '123456',
  autosaveMs: 1200,
  appName: 'AutoBroskiGroup'
};
```

## Importante sulla sicurezza
Questo sistema con PIN a 6 cifre è pensato per essere semplice e pratico, non per protezione bancaria.
Se vuoi una sicurezza seria, il passo dopo è aggiungere un vero login Supabase Auth.

## Aggiornare il sito senza perdere i dati
- Modifica i file del progetto e fai push su GitHub.
- Vercel ridistribuisce automaticamente il sito.
- I dati restano su Supabase, quindi non dipendono dal singolo dispositivo.

## Nota pratica
Se `supabaseUrl` o `supabaseAnonKey` sono vuoti, l'app continua a funzionare in modalità locale.
