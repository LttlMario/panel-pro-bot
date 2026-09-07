# Server oficial Panel Pro Bot Discovery

1. Rulează migrațiile `20260907000100_support_tickets.sql` și `20260907000200_official_role_sync_cron.sql` în SQL Editor.
2. În Supabase Vault creează secretul `panel_pro_cron_secret` și setează aceeași valoare pentru `CRON_SECRET` în funcția `sync-official-roles`.
3. În `administrare-module.html`, apasă mai întâi **Configurează serverul oficial Discovery**, apoi **Sincronizează rolurile Free / Premium**.

Funcția programată verifică la fiecare 15 minute abonamentul și rolurile serverului `1544703486384537603`, parcurgând toate paginile de membri Discord. Mesajele oficiale nu sunt repostate dacă există deja în canalul respectiv.
