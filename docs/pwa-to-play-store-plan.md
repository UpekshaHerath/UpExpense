# upExpense — PWA to Play Store Plan

A step-by-step plan for turning the upExpense web app into an installable PWA and publishing it on the Google Play Store.

**Current stack:** Next.js 16 + React 19 + Supabase + Tailwind 4, deployed as a web app. No PWA setup yet — no manifest, no service worker.

**Key decision: no separate codebase is needed.** One codebase is enough.

---

## How it works

The Play Store path for a PWA is a **TWA (Trusted Web Activity)**. The Android app is a thin wrapper that opens the hosted PWA fullscreen in Chrome, with no browser UI. A tool like **Bubblewrap** (Google's CLI) or **PWABuilder** generates the Android package from the live URL.

The web app stays hosted on Vercel (or wherever); the Android app just points to it. Updating the website updates the app instantly — no Play Store re-release needed for content/UI changes.

Result: the web codebase plus one tiny generated Android project (a few config files, kept in an `android/` folder or a separate repo — it's generated and rarely touched).

---

## Step 1 — Make the app a real PWA (main code changes)

This is where most of the work is. All changes go in `frontend_upExpense`:

1. **Web app manifest** — Next.js 16 supports `app/manifest.ts`. It needs `name`, `short_name`, `start_url`, `display: "standalone"`, `theme_color`, `background_color`, and icons.
2. **Icons** — 192×192 and 512×512 PNG, plus **maskable** variants (icon with safe padding so Android can crop it to a circle). The existing brand logo (from the SEO/OpenGraph work) can be reused.
3. **Service worker** — required for installability and offline support. For Next.js use **Serwist** (`@serwist/next`, the successor of next-pwa). It precaches assets and provides an offline fallback page.
   > ⚠️ Per `AGENTS.md`, this Next.js 16 version has breaking changes — check Serwist's Next 16 compatibility docs before wiring it in.
4. **HTTPS + stable custom domain** — a hard TWA requirement. A custom domain is better than `*.vercel.app`: the domain identity is baked into the Android app, so changing the domain later means an app re-release.
5. **Mobile polish** — the app runs fullscreen, so: handle safe areas (`viewport-fit=cover`, `env(safe-area-inset-*)`), no horizontal scroll, adequate touch targets.
6. **Offline behavior** — the app is Supabase-backed, so full offline sync is a big undertaking. Minimum viable: an offline fallback page ("no connection"). Later: cache read data locally.
7. **Verify** — the Lighthouse PWA audit must pass installability checks.

---

## Step 2 — Digital Asset Links

Host a file at `https://yourdomain.com/.well-known/assetlinks.json` containing the Android signing key fingerprint. This proves you own both the domain and the app.

**Without it, the TWA shows a browser URL bar at the top — a dealbreaker.**

In Next.js: put it in `public/.well-known/assetlinks.json`.

---

## Step 3 — Generate the Android app

```bash
npm i -g @bubblewrap/cli
bubblewrap init --manifest https://yourdomain.com/manifest.webmanifest
bubblewrap build
```

- Prompts for app name, package id (e.g. `com.upeksha.upexpense`), icons — pulled from the manifest.
- Creates a signing keystore. **Back this key up and remember the passwords — losing it means losing the ability to update the app.** (Play App Signing reduces this risk; enable it.)
- Output: an `.aab` (upload to Play) and an `.apk` (for local testing on a real phone).
- Requires JDK + Android SDK; Bubblewrap can download them automatically.

**Alternative:** [PWABuilder.com](https://www.pwabuilder.com) — paste the URL, download the package, zero local tooling. Equally valid.

---

## Step 4 — Play Console + publish

1. Create a Google Play developer account — **$25 one-time**.
2. Create the app, upload the `.aab`.
3. Store listing: description, screenshots (phone, minimum 2), feature graphic 1024×500, app icon 512×512.
4. **Privacy policy URL** — required, since the app collects emails/auth via Supabase. A simple hosted page is enough (can be a route on the site itself).
5. **Data safety form** — declare what is collected (email, expense data), why, encryption in transit, and the data deletion path.
6. Content rating questionnaire (finance app — straightforward).
7. **Important:** recently created personal developer accounts must run **closed testing first — 12 testers, 14 days continuous — before getting production access.** Plan for this; recruit friends/colleagues. Organization accounts skip it but need a D-U-N-S number.
8. Submit → review usually takes 1–7 days.

---

## Costs

| Item | Cost |
|---|---|
| Google Play developer account | **$25 one-time** |
| Custom domain | ~$10–15/yr |
| Hosting (Vercel hobby tier) | $0 (fine for this) |
| Supabase free tier | $0 until real traffic |
| Bubblewrap / PWABuilder | $0 |
| **Total to launch** | **~$35–40** |

**iOS note:** the App Store is a different story — $99/yr and Apple is hostile to pure PWA wrappers (expect rejection without native features). Skip for now; the PWA installs on iPhone via Safari's "Add to Home Screen" anyway.

---

## What does NOT change

- No React Native / Flutter rewrite.
- No API changes — Supabase works as-is.
- No duplicate UI code.
- Backend/auth untouched.
  - One caveat: OAuth redirect flows inside a TWA sometimes need testing — Google OAuth in custom tabs works, but test the login flow early on a real device.

---

## Suggested order of execution

1. Manifest + icons + Serwist service worker → Lighthouse passes
2. Deploy to a custom domain
3. Bubblewrap → test the `.apk` on a real phone
4. `assetlinks.json` → verify the URL bar is gone
5. Play Console account + store listing + closed testing
6. Production release
