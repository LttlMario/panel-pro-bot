# Panel Pro Bot — audit comercial și plan de implementare

Data auditului: 2026-11-23

## Referințe de siguranță

- Repository: `LttlMario/panel-pro-bot`
- Ramură de lucru: `commercial/discovery-launch`
- Ramură backup: `backup/pre-commercial-2026-11-23`
- Commit de bază păstrat: `432f072fe0e9c14188affc87bd20d1c06ba12967`
- Ramura de backup a fost creată direct din acest commit.
- `main` nu a fost modificată.
- Nu s-a făcut deploy și nu s-au rulat migrații asupra Supabase.

## Ce există deja

1. Botul are integrare Discord Premium Apps: SKU-uri configurate prin `DISCORD_PREMIUM_GUILD_SKU_IDS` / `DISCORD_PREMIUM_GUILD_SKU_ID`, sincronizare entitlement și verificare la nivel de guild.
2. Trial-ul de 30 de zile este creat la prima instalare eligibilă.
3. Există administrare globală pentru acordare/retragere manuală Premium și prelungirea Trial-ului.
4. Baza de date Discovery este separată de schema vechiului panel web.
5. Tabelele Discovery sunt protejate cu RLS și accesul direct pentru `anon` / `authenticated` este revocat; funcțiile backend folosesc `service_role`.
6. Pagina publică de prețuri oferă în prezent Premium lunar, 6 luni, anual și Unlimited, cu Revolut și achiziție Discord. Fluxul Revolut solicită dovada și activare manuală.
7. Există termeni și condiții, dar nu a fost identificată o politică publică de confidențialitate.
8. Nu a fost găsită o integrare Stripe în căutarea repository-ului.

## Ce trebuie construit

### Hosted SaaS
- Păstrarea aplicației Discord oficiale unice Panel Pro Bot.
- Planuri și SKU-uri/entitlements fără suprapunerea sistemelor de plată.
- Stare comercială unificată, cu sursă de adevăr clară, perioade, anulări, reînnoiri și audit.
- Izolare strictă pe guild/organizație și protejarea operațiunilor administrative.

### Dedicated
- Înregistrare de instalări dedicate și licențe separate de entitlement-urile Discord.
- Validare server-side a licenței, expirare, suspendare, rotație și jurnalizare.
- Configurație per client pentru endpoint/backend și branding.
- Procedură documentată de backup, update, rollback și recuperare.
- Nu se reutilizează tokenul botului public pentru aplicații Discord independente. Un bot cu identitate proprie necesită aplicație și credențiale Discord proprii.

### White-label
- Setări per instalare: nume afișat, logo, culori, domeniu și texte.
- Separare între identitatea publică Panel Pro Bot din App Directory și brandul unei instalări dedicate.
- Niciun secret sau token în frontend/repository.

### Discord App Discovery
- Pregătirea profilului, descrierii, imaginilor, linkurilor de suport, termenilor și politicii de confidențialitate.
- Verificarea aplicației și activarea Discovery rămân acțiuni în Discord Developer Portal și depind de aprobarea Discord; codul GitHub nu poate garanta listarea.

## Blocaje care nu trebuie inventate

- Operatorul legal al serviciului, adresa de contact și datele pentru politica de confidențialitate nu sunt stabilite în repository. Nu se publică date legale fictive.
- Nu există chei Stripe, cont de procesare sau webhook secret în configurația furnizată. Integrarea poate fi pregătită cu variabile de mediu, dar plățile reale nu pot fi validate fără cont și secrete.
- Nu există o conexiune administrativă disponibilă în acest flux pentru export/backup al bazei Supabase live. Backup-ul Git protejează codul, nu datele și setările live. Nicio migrare de producție nu se execută până la obținerea unui export verificabil al bazei și a configurației Supabase.

## Ordinea obligatorie

1. Păstrează branch-ul backup neatins.
2. Obține export verificabil al bazei de date și inventarul setărilor/secretelor (fără a copia secrete în Git).
3. Completează auditul de autorizare, webhook-uri, entitlement și izolarea tenant-urilor.
4. Proiectează schema comercială compatibilă cu entitlement-urile existente.
5. Implementează în pași mici, cu migrații additive și verificări de regresie.
6. Rulează testele existente și teste noi pentru billing/licensing/isolation.
7. Deschide PR pentru revizie; nu face merge/deploy fără confirmare.
8. Păstrează procedură de rollback către commitul de bază și restore separat pentru Supabase.

## Jurnalul schimbărilor

La data auditului, acest document este singura modificare planificată pe ramura de lucru. Nu schimbă comportamentul botului, schema bazei de date sau setările de producție.
