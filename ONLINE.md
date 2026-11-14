# TrainMind online: messa in rete e inviti

La versione online gira su un sito tuo, senza claude.ai. Ogni allenatore entra con la sua email e vede solo i propri dati.

| Pezzo | Servizio | Dove sta nel repo |
|---|---|---|
| Sito | Vercel | `web/` (pagina, icone, configurazione pubblica) |
| Dati e accesso | Supabase | `supabase/schema.sql` |
| Assistente AI | Vercel + API di Anthropic | `api/ai.js` |

## 1. Supabase (dati e accesso), circa 10 minuti

1. Vai su supabase.com, crea un account e un progetto nuovo. Regione: **Central EU (Frankfurt)**, così i dati restano in Europa.
2. **SQL Editor › New query**: incolla tutto `supabase/schema.sql` e premi **Run**.
3. **Authentication › Sign In / Providers › Email**: lascia attivo l'accesso via email.
4. **Authentication › Sign In / Providers › User Signups**: **disattiva** «Allow new users to sign up». Così entra solo chi inviti tu.
5. **Authentication › URL Configuration**: in **Site URL** metti l'indirizzo del sito (lo avrai al punto 2, es. `https://trainmind.vercel.app`) e aggiungilo anche in **Redirect URLs**.
6. **Project Settings › API**: copia **Project URL** e la chiave **anon public**. Vanno in `web/config.js` (si possono condividere, sono pubbliche) e su Vercel.

## 2. Vercel (sito), circa 5 minuti

1. Vai su vercel.com e accedi con GitHub.
2. **Add New › Project** e importa il repository **TrainMind**. Non serve cambiare le impostazioni di build: le legge da `vercel.json`.
3. **Settings › Environment Variables**, aggiungi:
   - `SUPABASE_URL`: il Project URL di Supabase;
   - `SUPABASE_ANON_KEY`: la chiave anon public;
   - `ANTHROPIC_API_KEY`: la chiave API di Anthropic (punto 3). La incolli solo qui, mai in chat o nel repo;
   - `AI_DAILY_LIMIT` (facoltativo): richieste all'assistente al giorno per allenatore, predefinito 80.
4. **Deployments › Redeploy**. L'indirizzo del sito è in alto nella pagina del progetto.

## 3. Anthropic (assistente), circa 5 minuti

1. Vai su console.anthropic.com, crea un account e attiva la fatturazione (**Billing**).
2. Imposta un tetto di spesa mensile in **Limits**, per stare tranquillo durante la prova.
3. **API Keys › Create Key**: copia la chiave e incollala su Vercel come `ANTHROPIC_API_KEY`.

L'assistente usa Claude Opus 5.5: sforzo alto per la progettazione della settimana, medio per il resto. Se un modello rifiuta una richiesta, l'API passa da sola a un modello di riserva.

## 4. Il tuo accesso e i tuoi dati

1. In Supabase, **Authentication › Users › Invite user** e metti la tua email.
2. Apri il sito, scrivi la tua email e apri il link che ricevi.
3. **Impostazioni › Account › Importa un backup** e scegli `trainmind-backup-cosov.json`: tornano squadra, rosa, partite, settimana ed esercizi.

## 5. Invitare altri allenatori

1. Supabase › **Authentication › Users › Invite user** con la loro email.
2. Mandagli l'indirizzo del sito: entrano con la loro email, senza password.
3. Partono da una squadra vuota e la configurano in **Impostazioni**. Non vedono i tuoi dati e tu non vedi i loro: ogni riga del database è legata all'account che l'ha creata.

Per togliere l'accesso a qualcuno: **Authentication › Users** › il suo utente › **Delete user**. I suoi dati vengono cancellati con l'account.

## Sul telefono

- **iPhone**: apri il sito in Safari › Condividi › **Aggiungi alla schermata Home**.
- **Android**: Chrome › menu › **Installa app**.
- **Mac**: Safari › File › **Aggiungi al Dock**.

## Privacy, da sapere prima di invitare altri

- I dati stanno su Supabase (UE) e sono protetti dalle regole del database.
- Quando usi l'assistente, i dati della squadra necessari alla richiesta (nomi, ruoli, disponibilità) vengono inviati all'API di Anthropic.
- Con giocatori minorenni serve un'informativa per le famiglie. Per la prova si possono usare solo cognomi o iniziali.

## Aggiornare la versione online

I sorgenti sono in `app/src/`, gli stessi dell'artifact su claude.ai. Dopo una modifica:

```bash
python3 scripts/build-web.py
```

Poi si fa commit e push: Vercel pubblica da solo.
