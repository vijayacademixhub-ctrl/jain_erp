# CMS AcademicOS — Frontend (M4)

Vite + React 18 + TypeScript app for the CMS AcademicOS platform. Connects to the
shared Supabase project (`academicos`) and renders the imported institutional data
under Row Level Security.

## Run
```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build to dist/
```

Supabase URL and the **publishable** (anon) key are read from `VITE_SUPABASE_URL` /
`VITE_SUPABASE_ANON_KEY`, with public-safe defaults baked in (RLS protects all data;
the service key is never used in the frontend).

## Portals (role-based landing)
- **Student** `/student` — pick section, weekly timetable, PDF/Excel export
- **Faculty** `/faculty` — own weekly timetable (resolved from the linked faculty row)
- **Committee / IQAC** `/committee` — timetable console with semester/section filters
- **Admin / Super / Master** `/admin` — institutional overview + timetable console

Every view exports **PDF and Excel** (WhatsApp-ready, fixed-grid layout). Roles come from
`user_academic_roles`; routing lands each user on their highest-privilege portal.
