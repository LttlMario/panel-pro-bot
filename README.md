# Panel Pro Bot

Proiect separat pentru Panel Pro Bot și serviciile sale Discord-only.

Acest proiect va avea:

- propria bază de date Supabase;
- propriile funcții Edge pentru interacțiunile Discord;
- autentificare Discord separată;
- trial, premium, guild-uri, canale, roluri, Stash, remindere și rapoarte Panel Pro Bot;
- fără dependență de baza de date a panelului web.

Panelul web existent rămâne în proiectul părinte și nu este modificat de această separare.

## Stare migrare

Directorul `supabase/migrations` conține migrarea curată `20260904000000_discovery_clean_schema.sql`. Schema și migrațiile vechi ale panelului sunt păstrate doar în `_legacy-panel-reference` și nu trebuie aplicate în proiectul Supabase Discovery.
