# SEMAFORI Demo Plan

**Kohëzgjatja:** 5-7 minuta  
**Live URL:** https://semafori.vercel.app  
**Statusi i verifikimit:** URL u hap dhe u verifikua më 5 maj 2026

## 1. Çka është projekti dhe kujt i shërben

SEMAFORI është një sistem për menaxhimin e incidenteve në trafik. Ai u shërben operatorëve të trafikut, qendrave të monitorimit dhe ekipeve që duhet të raportojnë, ndjekin dhe përditësojnë incidente në kohë reale.

Vlera kryesore e projektit:

- lejon raportim të shpejtë të incidenteve
- mban një panel të vetëm me statistika dhe listën e rasteve
- ruan raportet në Supabase
- ofron ndihmë shtesë përmes asistentit AI
- ka theme light/dark dhe ndërfaqe dygjuhësore

## 2. Flow kryesor që do ta demonstroj

Ky është flow më i mirë për demo sepse tregon vlerën praktike të aplikacionit nga hyrja deri te përdorimi real:

1. Hyrja në sistem
   Tregoj faqen e hyrjes me branding `SEMAFORI` dhe autentikimin me Supabase.

2. Pamja e dashboard-it
   Tregoj statistikat kryesore, listën e incidenteve dhe hartën.

3. Krijimi i një incidenti të ri
   Plotësoj formularin, zgjedh kategorinë, rëndësinë, statusin dhe një lokacion në hartë, pastaj bëj `Add Incident`.

4. Verifikimi i rezultatit
   Tregoj që incidenti shfaqet në listë dhe reflektohet në statistika.

5. Redaktimi ose fshirja e incidentit
   Tregoj që raporti mund të përditësohet ose hiqet.

6. Asistenti AI
   Hap AI Assistant dhe bëj një pyetje të shkurtër për analizë ose këshillë.

7. Settings
   Tregoj ndërrimin e gjuhës dhe theme për të demonstruar përvojën e përdoruesit.

## 3. Pjesët teknike që do t’i shpjegoj shkurt

Gjatë prezantimit do t’i mbaj shpjegimet teknike të shkurtra dhe të qarta:

- `React + Vite` për frontend-in dhe routing
- `Supabase Auth` për login/signup dhe ruajtjen e sesionit
- `Supabase Database` për ruajtjen e incidenteve
- shtresa e raporteve që mbështet si skemën standarde ashtu edhe tabelën ekzistuese `raportet`
- `Leaflet` për hartën dhe zgjedhjen e lokacionit
- `Groq API` për asistentin AI, me fallback nëse shërbimi live dështon
- `Vercel` për deployment-in live

## 4. Çfarë kam kontrolluar para demos

Para prezantimit do të kontrolloj këto pika:

- aplikacioni ndërtohet pa gabime me `npm run build`
- lint kalon me `npm run lint`
- `https://semafori.vercel.app` hapet
- login dhe signup hapen normalisht
- dashboard-i ngarkohet pa white screen
- krijimi i incidentit funksionon
- edit dhe delete funksionojnë
- harta ngarkohet dhe pranon zgjedhje të lokacionit
- AI Assistant hapet dhe jep përgjigje ose fallback të dobishëm
- ndërrimi i gjuhës dhe theme funksionon
- nuk ka gabime kritike në console

## 5. Plani B nëse live demo dështon

Nëse live demo dështon, do të kaloj menjëherë te një plan rezervë:

1. Nëse bie interneti ose Vercel nuk hapet
   Tregoj build-in lokal me `npm run dev` ose video/screenshot të përgatitur paraprakisht.

2. Nëse dështon databaza ose insert-i
   Tregoj kodin e `Dashboard.jsx` dhe `reportService.js` dhe shpjegoj si ruhet raporti në Supabase.

3. Nëse dështon AI
   Shpjegoj që asistenti përdor Groq dhe tregoj fallback-in lokal që e mban flow-n funksional.

4. Nëse një pjesë e UI nuk ngarkohet si duhet
   Vazhdon demo me pjesët tjera: login, dashboard, settings, dokumentim dhe kod.

## 6. Si do ta prezantoj qartë dhe profesionalisht

Gjatë prezantimit do të fokusohem në këto pika:

- të tregoj qartë problemin që zgjidh projekti
- të demonstroj vetëm flow-n më të fortë dhe më të qëndrueshëm
- të mos humb në detaje teknike të panevojshme
- të theksoj vlerën praktike, jo vetëm teknologjitë
- të jem gati të shpjegoj shkurt arkitekturën dhe vendimet kryesore

## 7. Mbyllja e prezantimit

Në fund do të përmbledh:

- çfarë bën SEMAFORI
- pse është i dobishëm për menaxhimin e trafikut
- si ruhen dhe menaxhohen incidentet
- cilat janë pjesët teknike kryesore
- që projekti është i testuar, i dokumentuar dhe i gatshëm për prezantim
