# Panel Pro direct message bot

Acest proces Gateway ascultă mesajele normale din Discord și trimite o copie cu formatul `Nume: mesaj` numai în canalele bifate în administrarea organizației din `panel-pro.ro`. Mesajul original nu este șters.

Pornire:

```powershell
npm install
$env:DISCORD_BOT_TOKEN="TOKENUL_BOTULUI"
$env:SUPABASE_URL="https://vkvsabbbawyiurnaiugo.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="CHEIA_SERVICE_ROLE"
npm start
```

Botul trebuie să aibă permisiunile `View Channel`, `Read Message History` și `Send Messages`, iar în Discord Developer Portal trebuie activat `Message Content Intent`.
