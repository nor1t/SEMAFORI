# SEMAFORI

Sistem për menaxhimin e incidenteve në trafik, i ndërtuar me React, Supabase, Leaflet dhe Groq.

**Live URL:** https://semafori.vercel.app  
**Statusi:** URL u verifikua më 5 maj 2026  
**Dokumenti i prezantimit:** [docs/demo-plan.md](./docs/demo-plan.md)

## Çfarë bën projekti

SEMAFORI u shërben operatorëve të trafikut dhe qendrave të monitorimit për:

- krijimin e raporteve të incidenteve
- përditësimin dhe fshirjen e tyre
- shfaqjen e statistikave në dashboard
- zgjedhjen e lokacionit në hartë
- përdorimin e një asistenti AI për analizë dhe rekomandime
- ndërrimin e gjuhës dhe theme

## Teknologjitë

- React + Vite
- Tailwind CSS
- Supabase Auth
- Supabase Database
- Leaflet
- Groq API
- Vercel

## Nisja lokale

Krijo `.env.local` me këto vlera:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_GROQ_API_KEY=your_groq_api_key
```

Pastaj:

```bash
npm install
npm run dev
```

## Komandat kryesore

```bash
npm run dev
npm run build
npm run preview
npm run lint
```

## Shënime për databazën

Projekti aktual mbështet:

- skemën standarde `user_data`
- tabelën ekzistuese `raportet`

Për `raportet`, rekomandohet të ekzistojnë këto kolona:

- `Titulli i incidentit`
- `Përshkrimi`
- `Kategoria`
- `Rëndësia`
- `Statusi`

Kolonat `user_id`, `Latitude`, `Longitude`, dhe `created_at` janë të rekomanduara, por kodi tani është më tolerant edhe kur nuk janë të gjitha të pranishme.

## Shënime për AI

Asistenti AI përdor Groq. Nëse `VITE_GROQ_API_KEY` mungon ose është i pavlefshëm, UI tani kalon në fallback lokal në vend se të dështojë me një mesazh gjenerik.

## Deployment

Ky projekt deploy-ohet në Vercel. `vercel.json` tashmë është i konfiguruar për Vite dhe SPA routing.

Për një deploy të ri:

1. bëj `git push` në branch-in kryesor
2. sigurohu që projekti në Vercel është i lidhur me këtë repo
3. kontrollo që environment variables në Vercel janë të sakta
4. Vercel do të nisë deploy automatikisht

## Kontrolli para prezantimit

Para demos kontrollo:

- `npm run build`
- `npm run lint`
- login/signup
- krijimin e një incidenti
- edit/delete
- hartën
- AI Assistant
- `https://semafori.vercel.app`
