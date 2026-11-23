# Supabase Discovery — backup și rollback înainte de migrații

Acest document este o procedură operațională. Nu conține chei, parole sau URL-uri cu credențiale.

## Limită importantă

Branch-urile GitHub salvează codul și migrațiile din repository. Ele NU salvează automat:
- rândurile și setările din baza de date Supabase;
- valorile secretelor Edge Functions;
- setările Auth/OAuth și redirect URLs;
- configurarea Storage, bucket-urile și politicile;
- cron jobs, webhook configuration sau setările proiectului.

Nu se execută nicio migrare pe proiectul live până când toate copiile de mai jos nu sunt realizate și verificate.

## Identificarea proiectului

Repository-ul indică proiectul Supabase Discovery cu ref-ul `zrjxlbkbctlapgupktxw` și numele `Panel Pro Discovery`. Confirmă în Supabase Dashboard că acesta este proiectul corect înainte de orice operațiune.

## 1. Backup complet al bazei de date

Folosește o conexiune directă PostgreSQL sau connection pooler furnizată de Supabase Dashboard. Nu introduce URL-ul cu parolă în Git, chat, loguri sau capturi de ecran.

Exemplu de backup custom-format:

```bash
umask 077
pg_dump --format=custom --no-owner --no-acl "$SUPABASE_DB_URL" --file "panel-pro-discovery-pre-commercial-2026-11-23.dump"
```

Verifică fișierul și lista obiectelor:

```bash
test -s panel-pro-discovery-pre-commercial-2026-11-23.dump
pg_restore --list panel-pro-discovery-pre-commercial-2026-11-23.dump > panel-pro-discovery-pre-commercial-2026-11-23.contents.txt
```

Păstrează dump-ul într-un spațiu privat, criptat, separat de repository. Ideal, păstrează și o a doua copie într-un alt spațiu securizat.

## 2. Inventarul configurației proiectului

Înainte de modificări, exportă sau documentează în mod securizat:
- lista numelor secretelor Edge Functions și valorile lor, printr-un canal privat securizat; niciodată în Git;
- setările Authentication, Discord OAuth provider, redirect URLs și URL configuration;
- funcțiile Edge deployate și versiunile lor;
- cron jobs și programările asociate;
- bucket-urile Storage, politicile și limitele;
- setările API, extensiile PostgreSQL și versiunea PostgreSQL;
- migration history și orice SQL aplicat manual în afara folderului migrations.

Nu este suficient un fișier `.env.example`; acesta conține doar numele și exemple, nu valorile active.

## 3. Test de restaurare — înainte de producție

Un dump nu este considerat backup verificat până când nu a fost restaurat într-un proiect Supabase separat/de test și verificat:
- tabele, coloane, indecși, constrângeri și funcții;
- numărul de rânduri pentru tabelele comerciale și Discovery;
- setările JSON din `discovery_app_settings` și `discovery_settings`;
- relațiile guild → organization;
- entitlement-urile și datele Trial;
- funcționarea autentificării și a funcțiilor Edge după reconfigurarea secretelor.

Nu restaura peste producție ca test.

## 4. Rollback

Pentru cod:
- branch de referință: `backup/pre-commercial-2026-11-23`
- commit exact: `432f072fe0e9c14188affc87bd20d1c06ba12967`
- branch de lucru: `commercial/discovery-launch`

Pentru baza de date, restaurarea se face numai din dump-ul verificat și numai după oprirea temporară a scrierilor aplicației. Restaurarea poate suprascrie date create după backup; de aceea trebuie planificată și aprobată separat.

## 5. Regula de lansare

Orice migrare comercială trebuie:
1. să fie additive și reversibilă pe cât posibil;
2. să aibă un script de verificare pre/post;
3. să aibă procedură de rollback documentată;
4. să fie testată pe un proiect separat;
5. să fie aplicată pe proiectul live numai după backup verificat și aprobare explicită.

## Status la 2026-11-23

- Backup GitHub: creat și verificat.
- Backup live Supabase: nu a fost executat în această sesiune; nu există acces administrativ la baza de date sau la secrete prin conexiunile disponibile.
- Migrații live: zero.
- Deploy: zero.
