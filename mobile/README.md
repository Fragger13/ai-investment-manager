# AskPapa Mobile (Android-first)

React Native + Expo app for AskPapa. Talks to the same FastAPI backend as the
web app (`https://api.askpapa.in/api/v1`) — no separate backend.

## Run it on your Android phone (dev)

1. Install **Expo Go** from the Play Store on the phone.
2. On the Mac (phone and Mac on the same WiFi):

   ```bash
   cd mobile
   npx expo start
   ```

3. Scan the QR code shown in the terminal with Expo Go.
4. Log in with your real askpapa.in account. Edits to the code hot-reload on
   the phone instantly.

If phone and Mac are on different networks, use `npx expo start --tunnel`.

To point the app at a local backend instead of production:

```bash
EXPO_PUBLIC_API_URL=http://<mac-ip>:8000/api/v1 npx expo start
```

## What is built so far (Phase 1 shell)

- **Auth**: login against production, session in **expo-secure-store**
  (Android Keystore / iOS Keychain — the token carries the user's data key,
  so it never touches plain storage). The decrypted profile is held in memory
  only, never persisted to disk.
- **Biometric lock**: with a saved session, the app demands fingerprint/face
  on cold start (devices without biometrics fall through).
- **Tabs**: Home, Goals, Plan, Portfolio, Papa — same five destinations and
  lucide icons as the web bottom bar.
- **Home**: greeting, investable-this-month hero card, health score,
  "do this first" actions, goal progress bars, alerts, disclaimer —
  live from `POST /intelligence/dashboard`, with pull-to-refresh.
- **Papa**: working chat against `POST /chat` with metric cards and
  suggestion chips.
- Goals/Plan/Portfolio: honest "coming soon" placeholders that deep-link to
  the web app.

## Design language

`src/constants/theme.ts` mirrors `frontend/app/globals.css` verbatim
(hsl strings). Light-only, matching the current product decision.

## Not yet ported (per roadmap)

- Registration + email verification (login-only for now; register links out
  to the web).
- Document-first onboarding, expense tracker (SMS on-device parsing),
  deep links to demat apps, push notifications.

## Store readiness notes

- `android.package` / iOS bundle id: `in.askpapa.app`.
- New personal Play accounts need a closed test (~12 testers, 14 days)
  before production — start that clock early.
- SMS permissions will need a Play Permissions Declaration when the expense
  tracker lands (budgeting apps are a permitted use case; parsing stays
  on-device).
