# Remote iOS Testing — Free Sideload + EAS Update + Hosted Supabase

> Goal: Test Younionize on a physical iPhone from anywhere. No active laptop connection needed. No Apple Developer Program ($99). Just open the app and use it.

---

## How It Works

```
┌──────────────────────────────────────────────────────────────┐
│  ONE-TIME SETUP (at your desk, USB cable)                    │
│                                                              │
│  Mac + Xcode ──USB──▶ iPhone                                │
│  • Builds the native shell (dev client) with free Apple ID   │
│  • Installs on your phone                                    │
│  • Repeat every 7 days (free cert expiry) — takes ~2 min     │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  WHEN YOU CHANGE CODE (at your desk, no USB needed)          │
│                                                              │
│  Run: eas update --branch development                        │
│  • Bundles your JS and uploads it to Expo's CDN              │
│  • Takes ~30 seconds                                         │
│  • Then close your laptop — you're done                      │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  TESTING (from anywhere, no laptop needed)                   │
│                                                              │
│  Open Younionize on your iPhone                                 │
│  • App downloads latest JS bundle from Expo CDN              │
│  • All API calls go to hosted Supabase                       │
│  • Works on any network — WiFi, cellular, anywhere           │
└──────────────────────────────────────────────────────────────┘
```

---

## Prerequisites

| Requirement | Cost | Notes |
|---|---|---|
| **Free Apple ID** | $0 | Your normal iCloud Apple ID works |
| **Xcode** | $0 | Mac App Store. ~12 GB download |
| **Expo account** | $0 | https://expo.dev — needed for EAS Update (free tier) |
| **EAS CLI** | $0 | `bun add -g eas-cli` |
| **Hosted Supabase project** | $0 | Free tier — you handle setup |
| **USB cable** | — | For initial install + every 7 days |

---

## Part 1: One-Time Project Setup

### 1.1 Install dependencies

```bash
bunx expo install expo-dev-client expo-updates
```

- `expo-dev-client` — custom dev client (your native shell)
- `expo-updates` — enables over-the-air JS updates from Expo CDN

### 1.2 Update `app.json`

Add both plugins and configure updates:

```json
{
  "expo": {
    "name": "Younionize",
    "slug": "younionize",
    "scheme": "younionize",
    "version": "0.1.0",
    "platforms": ["ios", "android", "web"],
    "ios": {
      "bundleIdentifier": "com.majorwookie.younionize"
    },
    "android": {
      "package": "com.majorwookie.younionize"
    },
    "web": {
      "bundler": "metro",
      "output": "single"
    },
    "plugins": [
      "expo-router",
      "expo-dev-client"
    ],
    "experiments": {
      "typedRoutes": true
    },
    "updates": {
      "url": "https://u.expo.dev/YOUR_EXPO_PROJECT_ID"
    },
    "runtimeVersion": {
      "policy": "appVersion"
    }
  }
}
```

> **Note:** `YOUR_EXPO_PROJECT_ID` gets filled in automatically when you run `eas update:configure` in step 1.5.

The `runtimeVersion` policy ties updates to the app version. This prevents the app from loading a JS bundle meant for a different native build.

### 1.3 Install EAS CLI and log in

```bash
bun add -g eas-cli
eas login
```

### 1.4 Create `eas.json`

```bash
eas build:configure
```

Then add a `"channel"` field to each build profile. Keep everything `eas build:configure` generated — just add the channels:

```diff
  "development": {
    "developmentClient": true,
    "distribution": "internal",
+   "channel": "development"
  },
  "preview": {
    "distribution": "internal",
+   "channel": "preview"
  },
  "production": {
    "autoIncrement": true,
+   "channel": "production"
  }
```

Channels link builds to EAS Update branches — when you run `eas update --branch development`, only builds with `"channel": "development"` receive that update.

The `channel` field links builds to update branches — the `development` build looks for updates on the `development` branch.

### 1.5 Configure EAS Update

```bash
eas update:configure
```

This registers your project with Expo and fills in the `YOUR_EXPO_PROJECT_ID` in `app.json` automatically.

### 1.6 Create `.env.remote`

This env file points to your hosted Supabase. **Do NOT commit this.**

```bash
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_KEY=YOUR_HOSTED_PUBLISHABLE_KEY
```

Add to `.gitignore`:
```
.env.remote
```

---

## Part 2: Build and Install on Your iPhone

### 2.1 Set up Xcode signing (free Apple ID)

1. Open **Xcode → Settings → Accounts** (⌘ + ,)
2. Click **+** → **Apple ID** → sign in
3. This creates a free "Personal Team" certificate

### 2.2 Generate the native project

```bash
npx expo prebuild --platform ios --clean
```

### 2.3 Configure signing in Xcode

1. Open **`ios/Younionize.xcworkspace`** in Xcode (not `.xcodeproj`)
2. Select the **Younionize** target
3. Go to **Signing & Capabilities** tab
4. Check **Automatically manage signing**
5. Set **Team** to your Personal Team (your Apple ID)

### 2.4 Enable Developer Mode on your iPhone

- **Settings → Privacy & Security → Developer Mode → ON**
- Phone will restart

### 2.5 Build and install

1. Connect iPhone via USB
2. In Xcode, select your iPhone from the device dropdown
3. **⌘R** (Run)
4. First build: ~3-5 minutes. Subsequent: ~1-2 minutes

**If "Untrusted Developer" appears:**
- Settings → General → VPN & Device Management → tap your Apple ID → Trust

### 2.6 Verify

The app opens to the expo-dev-client launcher. That's normal — it's waiting for a JS bundle. You'll push one in the next step.

---

## Part 3: Push a JS Update

This is what you'll do whenever you change code and want to test it on your phone.

```bash
dotenvx run -f .env.remote -- eas update --branch development --message "description of changes"
```

**What happens:**
1. Metro bundles your JS with the hosted Supabase env vars
2. Bundle uploads to Expo's CDN (~30 seconds)
3. Next time you open the app, it downloads the new bundle

That's it. Close your laptop, go anywhere, open the app.

### First time only: tell the dev client which branch to use

When you first open the app after pushing an update, the dev client launcher shows a list of available updates. Tap the one on the `development` branch. After that, it remembers.

---

## Part 4: Ongoing Workflow

### You changed JS/TS code
```bash
dotenvx run -f .env.remote -- eas update --branch development --message "what changed"
```
Then open the app on your phone — it pulls the update.

### You changed Edge Functions
```bash
supabase functions deploy <function-name> --project-ref YOUR_PROJECT_REF
```
No app update needed — the phone already calls hosted Supabase.

### You changed the database schema
```bash
supabase db push --project-ref YOUR_PROJECT_REF
supabase functions deploy --project-ref YOUR_PROJECT_REF
```

### You added a native dependency (new `expo-*` module, etc.)
```bash
bunx expo install <package-name>
npx expo prebuild --platform ios --clean
# Connect phone via USB → Xcode → ⌘R
```
Then push a new JS update with `eas update`.

### App stopped launching (7-day cert expired)
Connect phone via USB → Xcode → **⌘R**. Takes ~1-2 min. No code changes needed.

---

## Part 5: Environment Variable Flow

```
┌───────────────────────────────────────────────────────────┐
│  LOCAL DEV (simulator, unchanged)                         │
│                                                           │
│  bun dev → reads .env → localhost Supabase                │
└───────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────┐
│  REMOTE TESTING (physical device)                         │
│                                                           │
│  eas update → reads .env.remote → hosted Supabase URL     │
│  baked into the JS bundle uploaded to Expo CDN            │
│  phone downloads bundle → connects to hosted Supabase     │
└───────────────────────────────────────────────────────────┘
```

`api-base.ts` and `authClient.ts` read `EXPO_PUBLIC_SUPABASE_URL` — no code changes. You control which value they get by which env file you use.

---

## Part 6: When You Need Xcode+USB vs. Not

| Change Type | USB Rebuild? | What To Do |
|---|---|---|
| JS/TS code | No | `eas update --branch development` |
| Tamagui styles | No | `eas update` |
| New JS-only package | No | `eas update` |
| New native package | **Yes** | `expo prebuild --clean` → Xcode ⌘R |
| Changed `app.json` | **Yes** | `expo prebuild --clean` → Xcode ⌘R |
| Edge Function code | No | `supabase functions deploy` |
| DB migration | No | `supabase db push` |
| App cert expired (7 days) | **Yes** | Xcode ⌘R (~1-2 min) |

---

## Part 7: Troubleshooting

### App opens but shows dev client launcher (no content)
- You haven't pushed an update yet. Run `eas update --branch development`.
- Or: the update branch doesn't match. Make sure the build's `channel` maps to the `development` branch.

### "Untrusted Developer" on iPhone
- Settings → General → VPN & Device Management → tap your Apple ID → Trust

### "Developer Mode" not in Settings
- Requires iOS 16+. Connect to Xcode once and it appears.

### App stops opening after ~7 days
- Normal. Connect USB → Xcode → ⌘R. No code changes needed.

### API calls fail (network error)
- Check `.env.remote` has the correct hosted Supabase URL
- Check Edge Functions are deployed: `supabase functions list --project-ref YOUR_PROJECT_REF`
- Check secrets are set: `supabase secrets list --project-ref YOUR_PROJECT_REF`

### `eas update` fails
- Make sure you're logged in: `eas whoami`
- Make sure `eas update:configure` was run (sets project ID in `app.json`)

### Xcode says "Unable to install" or signing error
- Trust your computer on the phone when prompted
- Check Xcode → Settings → Accounts → your Apple ID is still valid
- Try: disconnect USB, quit Xcode, reconnect, reopen

### Free Apple ID signing limits
- Max **3 active app IDs** on a free account
- If you hit this, revoke old ones in Xcode → Settings → Accounts → Manage Certificates

### Update doesn't show on phone
- Kill and reopen the app — it checks for updates on launch
- Verify the update uploaded: `eas update:list`

---

## Files Modified by This Plan

| File | Change |
|---|---|
| `package.json` | `expo-dev-client` + `expo-updates` added to dependencies |
| `app.json` | Added `expo-dev-client` plugin, `updates` config, `runtimeVersion` |
| `eas.json` | **New file** — build profiles with channels |
| `.env.remote` | **New file** — hosted Supabase env vars (gitignored) |
| `.gitignore` | Add `.env.remote` |
| `ios/` | Regenerated by `expo prebuild` (already gitignored) |

No changes to `api-base.ts`, `authClient.ts`, or `.env`.

---

## Quick Reference

```bash
# === ONE-TIME SETUP ===
bunx expo install expo-dev-client expo-updates
bun add -g eas-cli
eas login
eas build:configure            # creates eas.json
eas update:configure           # registers project, sets update URL
npx expo prebuild --platform ios --clean
# Open ios/Younionize.xcworkspace → set signing → connect phone → ⌘R

# === PUSH CODE CHANGES (from your desk, ~30 sec) ===
dotenvx run -f .env.remote -- eas update --branch development --message "what changed"

# === TEST (from anywhere, no laptop) ===
# Just open the app on your phone

# === RE-SIGN EVERY 7 DAYS (USB + Xcode, ~2 min) ===
# Connect phone → Xcode → ⌘R

# === CHECK UPDATE STATUS ===
eas update:list
```
