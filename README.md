# 409 Wholesale

Dealer-to-dealer wholesale brokering for 409 Motor Company. One app, three jobs:

1. **Dealer network** — Kevin adds dealers from his phone (`/intake`), with CASL consent captured on the spot. Admin can search, edit, import/export CSV.
2. **Units & bids** — create a unit (VIN decode, photos, history report, announcements), pick who gets it, send by email and/or text. Each dealer gets a private link to a mobile bid page. Bids are blind and can be revised until close.
3. **Dashboard** — live units, units awaiting your decision, dealer leaderboard (response rate, win rate, avg gap when they lose), spread this month, activity feed.

Stack: Next.js 15 · Postgres · Vercel Blob (photos) · Resend (email) · Twilio (SMS). No other services.

---

## Deploy to Vercel (about 20 minutes)

### 1. Push the code
```bash
cd wholesale
git init && git add . && git commit -m "409 Wholesale"
```
Create a repo on GitHub (e.g. `409-wholesale`) and push it.

### 2. Create the Vercel project
Import the repo at vercel.com → New Project. Framework is detected as Next.js. Don't deploy yet — add storage and env vars first.

### 3. Storage (both free tier)
In the project → **Storage** tab:
- **Create Database → Postgres** (Neon). Connect it to the project. This sets `DATABASE_URL`/`POSTGRES_URL` automatically.
- **Create → Blob**. Connect it. This sets `BLOB_READ_WRITE_TOKEN` automatically.

The schema is created automatically on every deploy (`scripts/migrate.mjs` runs before build).

### 4. Environment variables
Project → **Settings → Environment Variables**:

| Variable | Value |
|---|---|
| `ADMIN_PASSWORD` | your password (full access) |
| `STAFF_PASSWORD` | Kevin's password (intake form only) |
| `SESSION_SECRET` | any long random string |
| `APP_URL` | `https://your-project.vercel.app` (or your custom domain — update it if you add one) |
| `RESEND_API_KEY` | from resend.com (see below) |
| `EMAIL_FROM` | `409 Wholesale <wholesale@409motorco.com>` |
| `EMAIL_REPLY_TO` | `govan@409motorco.com` |
| `TWILIO_ACCOUNT_SID` | from twilio.com console |
| `TWILIO_AUTH_TOKEN` | from twilio.com console |
| `TWILIO_FROM` | your Twilio number, e.g. `+15875550123` |
| `ALERT_EMAIL` | *(optional)* where to email you each time a bid lands |
| `ALERT_SMS` | *(optional)* your cell in `+1403…` format for bid alerts |

Until Resend/Twilio keys are set the app runs in **test mode**: everything works, sends are logged, nothing reaches dealers. Good for loading dealers and trying units first.

### 5. Deploy
Click Deploy. Sign in at `/login` with `ADMIN_PASSWORD`. Send Kevin the URL + `STAFF_PASSWORD` — he lands on `/intake` and can't see anything else.

---

## Email: Resend (free up to 3,000/month)
1. Sign up at resend.com → **Domains → Add** `409motorco.com`.
2. Add the DNS records it shows (SPF, DKIM, MX for bounces) at your DNS provider. Takes 5–30 min to verify.
3. **API Keys → Create** → paste into `RESEND_API_KEY`.

Sending from your own domain matters: dealers' spam filters trust `@409motorco.com`, not a shared sender.

## Texting: Twilio (pay-as-you-go, ~1¢ per text)
1. Sign up at twilio.com → buy a **Canadian local number** (403/587/825). Canadian 10DLC registration isn't required for Canadian numbers, but carriers may ask for business verification on the account — complete it when prompted.
2. Console → Account Info → copy SID and Auth Token into the env vars.
3. **Phone Numbers → your number → Messaging → "A message comes in"**: set webhook to `https://YOUR-APP/api/twilio/inbound` (HTTP POST). This records STOP/START replies in your dashboard. Twilio also enforces STOP on its own.
4. Twilio's **Advanced Opt-Out** is on by default — leave it on.

---

## How a unit flows
1. **New unit** → type the VIN → Decode → fill km, colours, announcements, condition, history summary, seller + what they want, margin target, close time (defaults next business day 3pm).
2. **Add photos** (resized on the phone before upload, so 20 photos from an iPhone is fine) and the CARFAX PDF.
3. **Send to dealers** — the list is pre-ranked: wants this make / brand store / has bid on this make before / past wins, and flags price/km mismatches. "Best matches" pre-selects. Pick email, text or both. Dealers only get the channels they consented to.
4. Dealers open their link, see photos/specs/history, enter a number. They can revise until close. You get a heads-up (if `ALERT_*` set).
5. At close the unit moves to **Needs your call** on the dashboard. Award shows the spread math (top bid − margin = offer to seller). Award & mark sold notifies the winner by email/text; losers see "sold" on their link, never the number.
6. Phone-in bids: enter them yourself on the unit page.

Everything 409-private (seller, what they want, margin, internal notes) never appears on dealer pages or in messages.

## CASL (anti-spam) — what's built in
- Consent checkbox per channel on intake, with who/when/how recorded on the dealer page.
- Every email has the business name, address, phone and a one-click unsubscribe link. Every text ends with "Reply STOP to opt out".
- Opt-outs are honoured automatically and shown on the dealer record.
- Bid terms page at `/terms` — binding bids, as-is, 48-hour arbitration window, payment in 2 business days, pickup in 3. Edit `app/terms/page.js` if you want different terms.

## Local development
```bash
npm install
cp .env.local.example .env.local   # edit
npm run migrate && npm run dev
```
Needs a local Postgres. Without Blob, photos save to `public/uploads/`.

## Later (not built yet, by design)
- Hook into the Trade & Acquisitions appraisal agent (VIN → auto-filled unit with CARFAX + comps) and ONE EIGHTY wholesale invoicing on award.
- Auto-close reminder texts ("1 hour left") and a weekly "what sold" email to the network.
- Custom domain (e.g. `wholesale.409motorco.com`).
