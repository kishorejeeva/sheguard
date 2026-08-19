# SheGuard — Personal Safety Application

Your Safety. Their Connection. Our Protection.

SheGuard is a full-stack safety app with two roles:

- **Wearer** — connects a Bluetooth device, shares location, and can trigger an SOS.
- **Guardian** — opts in to share location and gets alerted to real emergencies nearby (within 5 KM).

Real browser APIs are used throughout (Web Bluetooth, Geolocation, Notifications, Vibration,
Speech Recognition) — nothing is faked. Where a browser/device doesn't support a capability,
the UI says so clearly instead of pretending it works.

## Project structure

```text
sheguard/
├── frontend/   React + TypeScript + Vite + Tailwind
├── backend/    Node + Express + TypeScript + Prisma + Socket.IO
└── README.md
```

## Requirements

- Node.js 18+
- npm
- A PostgreSQL database (local, or Neon / Supabase / Railway)
- A modern browser (Chrome/Edge on Android or desktop for full Bluetooth support)
- **HTTPS is required in production** for Bluetooth, Geolocation, and Notifications to work —
  browsers block these APIs on plain HTTP outside of `localhost`.

## 1. Local setup

```bash
git clone <your-repo-url>
cd sheguard
npm install --workspaces
```

### Backend environment

```bash
cd backend
cp .env.example .env
```

Fill in `.env`:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Long random string used to sign auth tokens |
| `FRONTEND_URL` | Where the frontend runs (for CORS) — `http://localhost:5173` locally |
| `PORT` | Backend port, default `4000` |
| `ALERT_DELAY_SECONDS` | SOS countdown length before escalation (default `60`) |
| `NEARBY_GUARDIAN_RADIUS_KM` | Radius for community guardian matching (default `5`) |
| `GEOCODING_API_KEY` | Optional — enables address lookup for coordinates |

### Database setup

```bash
npx prisma generate --schema=backend/prisma/schema.prisma
npx prisma migrate dev --schema=backend/prisma/schema.prisma --name init
npm run prisma:seed --workspace=backend   # optional: sample police stations for dev
```

### Frontend environment

```bash
cd frontend
cp .env.example .env
```

```text
VITE_API_URL=http://localhost:4000/api
VITE_SOCKET_URL=http://localhost:4000
```

## 2. Development

In two terminals:

```bash
npm run dev:backend     # http://localhost:4000
npm run dev:frontend    # http://localhost:5173
```

Open `http://localhost:5173`.

> Bluetooth/Geolocation work on `localhost` without HTTPS during development — that's a
> browser exception for local testing only.

## 3. How the safety flow actually works

- **SOS press** → backend creates an `Alert` (status `COUNTDOWN`) and starts a **server-side**
  timer (`ALERT_DELAY_SECONDS`). The frontend countdown is just a display — the backend is
  authoritative, so a wearer can't bypass escalation by editing frontend JS.
- **Stop** → backend transitions the alert to `STOPPED` and cancels the scheduled escalation.
- **No stop within the delay** → backend transitions to `ESCALATED`, then:
  1. Notifies the wearer's up-to-5 emergency contacts (`AlertRecipient` rows are created;
     actual SMS/WhatsApp delivery needs a provider — see "Connecting real delivery" below).
  2. Notifies the nearest configured police station + headquarters (from the `PoliceStation`
     table — configure these yourself, nothing is hardcoded).
  3. Finds guardians who explicitly opted in, have a location on file within the last 30
     minutes, and are within `NEARBY_GUARDIAN_RADIUS_KM` (Haversine distance), and emits a
     real-time Socket.IO event to each.
  4. Alert status becomes `ACTIVE`; guardians see it live on their dashboard map.
- **Server restart safety**: on startup, the backend re-reads any `COUNTDOWN` alerts from the
  database and reschedules their escalation based on stored `createdAt` — an in-progress alert
  is never silently lost.

### Connecting real delivery (SMS/WhatsApp/Police dispatch)

This build creates and tracks `AlertRecipient` records with delivery status, which is the
integration point for a real provider. Plug in Twilio, MSG91, WhatsApp Business API, or your
local emergency dispatch integration inside `backend/src/services/alertService.ts` where
`AlertRecipient` rows are created — set `deliveryStatus` based on the provider's actual response
rather than assuming success.

## 4. Testing

```bash
cd backend
npm test
```

Add test coverage for: signup/login (incl. duplicate phone, invalid password), contacts
(max 5), alert state transitions (create → countdown → stop, create → escalate), and
authorization boundaries (wearer cannot read another wearer's data; guardian cannot read
unrelated private data). The `alertService` functions are already split out from the Express
routes specifically so they're easy to unit test.

## 5. Production deployment

```text
                INTERNET
                    |
                    v
          ┌──────────────────┐
          │ Vercel Frontend  │
          └────────┬─────────┘
                   |  HTTPS
                   v
          ┌──────────────────┐
          │ Render Backend   │
          │ Node + Express   │
          │ Socket.IO        │
          └────────┬─────────┘
                   |  Prisma
                   v
          ┌──────────────────┐
          │ Neon PostgreSQL  │
          └──────────────────┘
```

1. **Create a PostgreSQL database** (Neon, Supabase, or Railway) and copy its connection string.
2. **Deploy the backend to Render/Railway/Fly.io**:
   - Root/build directory: `backend`
   - Build command: `npm install && npm run build && npx prisma generate`
   - Start command: `npm start`
   - Set env vars: `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL` (your Vercel URL),
     `ALERT_DELAY_SECONDS`, `NEARBY_GUARDIAN_RADIUS_KM`, `GEOCODING_API_KEY`, `NODE_ENV=production`.
   - Run migrations against production: `npx prisma migrate deploy` (as a one-off/release command).
3. **Deploy the frontend to Vercel/Netlify**:
   - Root directory: `frontend`
   - Build command: `npm run build`, output: `dist`
   - Env vars: `VITE_API_URL=https://<your-backend>/api`, `VITE_SOCKET_URL=https://<your-backend>`
4. **Confirm CORS**: `FRONTEND_URL` on the backend must exactly match your deployed frontend origin.
5. **Confirm WebSocket support** is enabled on your backend host (Render/Railway support this
   by default for HTTP(S) services — no extra config needed for Socket.IO's default transport).
6. **Test over HTTPS**: Bluetooth, Geolocation, and Notification permissions will only work
   correctly on the deployed HTTPS URL, not on plain HTTP.
7. **Configure real police stations**: insert rows into `PoliceStation` via Prisma Studio or a
   migration — never rely on the dev seed data in production (the seed script refuses to run
   when `NODE_ENV=production`).

### Health check

```text
GET /health → { "status": "ok" }
```

Point your hosting provider's health check at this endpoint.

## 6. Security notes

- Passwords hashed with bcrypt (cost factor 12).
- JWT-based auth; sockets are authenticated with the same token before any room join.
- Helmet, CORS allow-list, and rate limiting (stricter on `/api/auth/*`) are enabled by default.
- All input is validated with Zod on every route.
- Every wearer/guardian-scoped query filters by the authenticated user's ID — a user can never
  fetch another user's contacts, alerts, or location by guessing an ID.
- Guardians only ever receive an alert's coordinates once they are a verified `AlertRecipient`
  for that specific alert (checked server-side on both the REST route and the Socket.IO
  `alert:subscribe` handler) — never broadcast to all connected guardians.

## 7. Known limitations (by design — nothing here is faked)

- Web Bluetooth is not supported on iOS Safari or desktop Firefox; the UI reports "not supported"
  rather than simulating a connection.
- Speech-recognition-based voice detection depends on the browser's `SpeechRecognition` API,
  which has uneven support outside Chrome-based browsers.
- Reverse geocoding (turning coordinates into a readable address) requires a `GEOCODING_API_KEY`;
  without one, the app still works and shows raw coordinates plus a map marker.
- SMS/WhatsApp/police-dispatch delivery is tracked in the database but requires you to wire in
  a real provider (Twilio, MSG91, etc.) — see "Connecting real delivery" above.
