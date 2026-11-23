# Stereo.tip – Band Hub

Private, members-only web app for **Stereo.tip** (Andrei, Mario, Mihai, David, Andreeas).
It has a dark theme, works well on phones, and all data is shared live through Firebase.

**Sections:** Home summary · Calendar (rehearsals & gigs + availability) · Songs & setlists
(drag & drop, auto total time) · Tasks · Money (equal split, who owes whom, monthly/category
totals) · Reminders · Journal (posts, photos, comments, filter by song).

## Run locally

```bash
npm install
npm run dev
```

Without Firebase config the app runs in **demo mode**: data is saved only in that browser. That's useful for trying it out.

## Connect Firebase (shared data)

1. Create a project at <https://console.firebase.google.com> (the free Spark plan is enough).
2. **Build → Firestore Database → Create database** (production mode, region `eur3` / Europe).
3. **Build → Authentication → Get started → Sign-in method → Anonymous → Enable.**
   There are no passwords: each member just taps their name, and the device remembers it.
4. **Project settings → General → Your apps → Web app (`</>`)**, then copy the config values into
   `.env.local` (see `.env.example`).
5. Deploy the security rules and the site:

```bash
npm i -g firebase-tools
firebase login
firebase use --add            # choose your project
npm run build
firebase deploy               # deploys firestore.rules + hosting
```

The site will be at `https://<project-id>.web.app`. On a phone, "Add to Home screen" makes it
behave like an app.

### Notes
- Photos are resized in the browser and stored in Firestore (no Cloud Storage or paid plan needed).
- Expenses are always split equally between the 5 members. "Mark paid" records a repayment
  and updates the balances.

## Logo & colours
The band logo is `public/logo.png` (white, transparent background); the app icons (`favicon.png`, `apple-touch-icon.png`, `icon-*.png`) are generated from it. It's used in the header, login screen
and as the icon. The theme is monochrome to match the white logo. If you ever use a coloured
logo, the accent colours are taken from it automatically (`src/lib/theme.js`).
