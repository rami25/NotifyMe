# AL Actions — Field Employee Mobile App

Ionic + Angular (standalone components) app, wrapped with Capacitor, for the
Air Liquide Tunisie action-tracking system. This is the **employee-facing**
mobile app described in the project overview: each employee signs in with
their `@airliquide.com` Google account and sees only the actions assigned to
them, sorted by deadline and priority, with Finish / Cancel actions wired to
the four-state workflow (`in_progress` → `finished` / `cancelled` /
`postponed`).

## Screens included

| Screen | Route | Purpose |
|---|---|---|
| Splash | native (Capacitor) | Logo on white while the session is restored |
| Login | `/login` | Google Sign-In, restricted to the Workspace domain |
| My Plan | `/plan` | Active actions (`in_progress` + `postponed`), sorted by deadline then priority |
| Action detail | `/action/:id` | Full action info, status timeline, Finish / Cancel |
| History | `/finished` | Archived actions (`finished` + `cancelled`) |
| Profile | `/profile` | Signed-in user, quick stats, sign out, and an "Open admin panel" entry for admins |

### Admin panel (same app, role-gated — per the spec: "a separate Angular route in the same frontend project... rather than a standalone app")

| Screen | Route | Purpose |
|---|---|---|
| Dashboard | `/admin` | Stats across all employees (active/overdue/finished, active users), quick actions |
| All Actions | `/admin/actions` | Every action, searchable + filterable by status, tap through to detail |
| New Action | `/admin/actions/new` | Create + assign directly (the other of the two intake paths, alongside the Sheet sync) |
| Action detail | `/admin/actions/:id` | Full info + timeline for any action; admin can cancel (no Finish — only the owning employee closes their own action, per the spec) |
| Users | `/admin/users` | List all users, toggle active/inactive, change role — deactivation only, never a hard delete |

`adminGuard` (`src/app/guards/admin.guard.ts`) sits alongside `authGuard` on every `/admin/*` route and redirects non-admins back to `/plan` rather than a dead end. `AdminService` mirrors `ActionsService` but talks to the unscoped `/actions` and `/users` endpoints instead of `/actions/mine`.

## Brand

Colors were sampled directly from the uploaded logo and centralized in
`src/theme/variables.scss`:
- Red `#D7001E` — primary brand accent (used for the Postponed/overdue state and destructive actions)
- Blue `#375F9B` — navigation chrome, links, in-progress state
- White `#FFFFFF` — dominant background, kept bright for outdoor field use

The logo is used as the header lockup (`al-header-brand` component) on every
screen, and as the source image for both the app icon and the native splash
screen (`resources/icon.png`, `resources/splash.png`), generated at
`resources/` so `@capacitor/assets` can produce all platform sizes.

## Setup

This scaffold was generated without running `npm install` (no network access
to fetch the full Angular/Ionic/Capacitor toolchain in this environment), so
the first step on your machine is:

```bash
npm install
```

### Generate native icons & splash screens from the source images

```bash
npx @capacitor/assets generate --iconBackgroundColor '#FFFFFF' --splashBackgroundColor '#FFFFFF'
```

This reads `resources/icon.png` and `resources/splash.png` and writes the
full Android/iOS icon and splash resource sets.

### Add native platforms

```bash
npx cap add android
npx cap add ios
```

### Run in the browser (fastest loop while building screens)

```bash
npm start
```

### Build the web bundle and sync into native projects

```bash
npm run build
npx cap sync
npx cap run android   # or: npx cap run ios
```

## Before this connects to the real backend

A few things are stubbed and need real values:

1. **`capacitor.config.ts`** — replace `serverClientId` with the actual
   Google Workspace OAuth client ID (Web application type, from Google Cloud
   Console, restricted to the `airliquide.com` Workspace).
2. **`src/environments/environment.ts` / `environment.prod.ts`** —
   point `apiBaseUrl` at the real FastAPI backend.
3. **Backend endpoints assumed by `ActionsService` / `AuthService`:**
   - `POST /auth/google` — exchanges the Google ID token for a session
     token + the `AppUser` record (validates domain + `active` flag server-side too)
   - `GET /auth/me` — resolves the current session token to a user, for
     session restore on app boot
   - `GET /actions/mine` — role-scoped at the query level, returns only the
     signed-in employee's actions
   - `POST /actions/:id/finish` — moves an action to `finished`, triggers
     the admin email notification
   - `POST /actions/:id/cancel` — moves an action to `cancelled`, triggers
     the admin email notification (body: `{ reason?: string }`)
4. **Push notifications** — `@capacitor/push-notifications` is wired as a
   dependency but registration/token-upload to the backend isn't
   implemented yet; add that once the FCM project is set up.

## Notes on structure

- All components are standalone (no `NgModule`s), Angular 18 + Ionic 8 style.
- `ActionsService` holds actions in a signal and exposes derived `plan()` /
  `finishedOrCancelled()` / `overdueCount()` computed signals — the four-state
  filtering logic lives in one place instead of being repeated per screen.
- `al-header-brand` and `al-bottom-nav` are small shared standalone
  components reused across the four post-login screens so the logo lockup
  and navigation stay consistent.
