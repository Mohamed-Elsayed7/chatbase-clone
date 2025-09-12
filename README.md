# Chatbase-Style Starter (Next.js + Tailwind + Supabase Auth UI)

## Quickstart
```bash
npm install
cp .env.example .env.local
# Fill NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
npm run dev
```
Open http://localhost:3000

## Pages
- `/`  → Supabase Auth UI (login/signup)
- `/dashboard` → Protected page (redirects if not logged in)

## Deploy on Vercel
1) Push this repo to GitHub.
2) Import into Vercel.
3) Add Environment Variables:
   - NEXT_PUBLIC_SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_ANON_KEY
4) Deploy.