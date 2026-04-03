# MEZU CRM

מערכת ניהול הזמנות פנימית למיזו — מזוזות ומוצרי בית מעוצבים.

## Setup

```bash
# 1. Install
npm install

# 2. Create .env.local from example
cp .env.local.example .env.local
# Fill in Supabase URL + keys

# 3. Run DB schema in Supabase SQL Editor
# Copy-paste: docs/schema.sql

# 4. Migrate data from Base44 (one time)
npm run migrate

# 5. Dev server
npm run dev
```

## Deploy
Push to `main` → Vercel auto-deploys.
Set env vars in Vercel dashboard → Settings → Environment Variables.

## Tech
Next.js 14 · Supabase · Tailwind CSS · TypeScript · Vercel

## See also
- `CLAUDE.md` — AI context and architecture notes
- `docs/schema.sql` — full database schema
