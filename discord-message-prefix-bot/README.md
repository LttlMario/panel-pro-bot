# Panel Pro direct message bot

Acest proces Gateway ascultă mesajele normale din Discord și le republică în formatul `Nume: mesaj` numai în canalele bifate în administrarea organizației din `panel-pro.ro`, apoi șterge mesajul original. `DISCORD_PREFIX_KEEP_ORIGINAL=1` poate fi folosit temporar pentru a păstra originalul.

Pornire:

```powershell
npm install
$env:DISCORD_BOT_TOKEN="TOKENUL_BOTULUI"
$env:SUPABASE_URL="https://vkvsabbbawyiurnaiugo.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="CHEIA_SERVICE_ROLE"
npm start
```

Botul trebuie să aibă permisiunile `View Channel`, `Read Message History`, `Send Messages` și `Manage Messages`, iar în Discord Developer Portal trebuie activat `Message Content Intent`.
