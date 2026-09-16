# Panel Pro Rich Presence

Această aplicație locală afișează în profilul Discord activitatea **Playing Panel Pro Bot**.

Pentru ca Discord să nu înlocuiască activitatea cu jocul detectat automat, în Discord Desktop deschide:
**User Settings → Activity Privacy → Display current activity as a status** și dezactivează opțiunea.

Aplicația reafișează activitatea la fiecare 2,5 secunde și include linkurile configurate în Rich Presence. Trebuie să rămână pornită cât timp vrei să apară activitatea. Discord poate afișa deasupra jocul detectat automat; pentru Panel Pro permanent, dezactivează jocurile respective din **Registered Games** sau oprește partajarea activității jocurilor.

## Pornire

1. Instalează Node.js LTS.
2. Deschide Discord Desktop și autentifică-te.
3. Deschide PowerShell în acest folder.
4. Rulează `npm install`, apoi `npm start`.

Aplicația nu citește tokenuri, parole sau date din servere.

## Prefixare automată a mesajelor Discord

`discord-proof-forwarder.js` poate monitoriza canalele selectate în administrarea organizației și poate trimite o copie a mesajului în formatul `Nume: mesaj`. Mesajul original rămâne în canal.

Pentru sincronizarea automată cu Panel Pro, configurează pe serverul unde rulează botul:

- `DISCORD_BOT_TOKEN` — tokenul botului;
- `SUPABASE_URL` — URL-ul proiectului Supabase;
- `SUPABASE_SERVICE_ROLE_KEY` — cheia secretă a serverului, niciodată în GitHub sau în frontend.

Dacă Supabase nu este configurat, poți folosi temporar `DISCORD_PREFIX_CHANNEL_IDS` cu ID-uri de canale separate prin virgulă. `DISCORD_PREFIX_DELETE_ORIGINAL=1` șterge mesajul original după republicare; implicit este dezactivat.
