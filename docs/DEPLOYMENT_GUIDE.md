# CMS AcademicOS — Deployment Guide

## Staging (live)
- **Frontend:** https://cms-academicos-vijayacademixhub-1404s-projects.vercel.app
- **Vercel project:** `cms-academicos` (team vijayacademixhub-1404) — separate from the
  existing `academicos` project (the academic-office app); that one is untouched.
- **Build:** Vite 8 (framework `vite`), root directory `academicos/`, auto-deploys on push
  to branch `claude/lucid-feynman-dpf2ol`. SPA rewrites via `academicos/vercel.json`.
- **Backend:** Supabase project `academicos` (prxfztbafgbnxnglqaje), free tier.
- **Deployment protection:** Vercel SSO gate disabled for staging (the app is already
  protected by Supabase Auth + RLS — anonymous visitors see nothing).

## Config
The frontend reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, with public-safe
defaults baked in (publishable/anon key only; the service key never touches the frontend).
No Vercel env vars are required for staging to work.

## Verified end-to-end (session 4)
- Login as a seeded master_admin → role resolved → **869** published timetable rows visible
  under RLS. Anonymous access **denied**. Vite build green on Vercel.

## Staging test account
A seeded staging-only master_admin account exists for verification (NOT a real person);
its credentials are shared privately with the project owner, never committed to the repo.
It is linked to the VIJAY faculty row so the faculty view renders too. Remove it before
production. Real accounts (students/faculty, USN + issued passwords) come from the
credentials document via role-seed migration 0009.

## Production (later, on college approval)
Supabase Pro + Vercel Pro; move schema onto an isolated Supabase branch; set a custom
domain; re-enable deployment protection as the institution requires.
