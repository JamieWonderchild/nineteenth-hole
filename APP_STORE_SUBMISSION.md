# App Store Submission Learnings
> Based on Lamina iOS submission, April 2026

---

## Pre-flight: Test the bundle locally FIRST
**Always run this before triggering an EAS build — it's free and catches bundler errors.**
```bash
cd mobile
npx expo export --platform ios
```
If this passes, the EAS build will pass the bundling step. Do not skip this.

---

## Step 1 — Apple Developer Account
- Purchase at developer.apple.com ($99/yr)
- Takes ~2 days to activate after purchase
- Once active: Team ID is at developer.apple.com/account → Membership Details

---

## Step 2 — Create app in App Store Connect
1. appstoreconnect.apple.com → My Apps → + → New App
2. Bundle ID must match `app.json` exactly (e.g. `vet.lamina.app`)
3. Note the **numeric App ID** from the URL: `/apps/XXXXXXXXXX/`

---

## Step 3 — Update eas.json
```json
"submit": {
  "production": {
    "ios": {
      "appleId": "your@email.com",
      "ascAppId": "1234567890",
      "appleTeamId": "ABCD1234EF"
    }
  }
}
```

---

## Step 4 — Fix common dependency issues

### Lock file out of sync
EAS runs `npm ci` which is strict. If it fails with "Missing X from lock file":
1. Add `.npmrc` to mobile directory:
   ```
   legacy-peer-deps=true
   ```
2. Run `npm install` locally to regenerate lock file
3. Commit both

### Missing peer dependencies
`@clerk/clerk-expo` requires `expo-auth-session` — it's not always in package.json:
```bash
npx expo install expo-auth-session
```
Check for other missing clerk peer deps:
```bash
node -e "
const pkg = require('./package.json');
const clerkDeps = require('./node_modules/@clerk/clerk-expo/package.json').peerDependencies || {};
const missing = Object.keys(clerkDeps).filter(d => !pkg.dependencies[d]);
console.log('Missing:', missing);
"
```

### Monorepo: convex/server not found
If `../convex/_generated/api.js` imports from `convex/server` and Metro can't find it, add to `metro.config.js`:
```js
config.resolver.nodeModulesPaths = [path.resolve(__dirname, "node_modules")];
```

---

## Step 5 — Set EAS environment variables
The `.env` file is gitignored — EAS never sees it. Set vars explicitly:
```bash
npx eas-cli env:create --name EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY --value "..." --environment production --visibility plaintext
npx eas-cli env:create --name EXPO_PUBLIC_CONVEX_URL --value "..." --environment production --visibility plaintext
npx eas-cli env:create --name EXPO_PUBLIC_SITE_URL --value "..." --environment production --visibility plaintext
```
**This is the most common cause of "works on simulator, crashes on device."**

---

## Step 6 — App ID capabilities
For a standard auth + microphone app: **no special capabilities needed.**
- Microphone = Info.plist permission only, not a capability
- Clerk auth = standard HTTPS
- Secure storage = standard Keychain

Optional: **Associated Domains** if you want Universal Links (e.g. tapping a website link opens the app).

---

## Step 7 — Clerk OAuth setup
In Clerk Dashboard → Configure → Redirects:
- Add `yourscheme://oauth-callback` to Allowed Redirect URLs
- Also add the app as an iOS application: Team ID + Bundle ID

The deep link scheme comes from `app.json` → `scheme` field.

---

## Step 8 — Build & submit
```bash
# Build
npx eas-cli build --platform ios --profile production

# Submit to TestFlight
npx eas-cli submit --platform ios --profile production --latest
```
EAS auto-increments build number. First build takes ~20 min; subsequent builds ~15 min.

---

## Step 9 — App Store Connect listing (required before review)

### Screenshots
- Required: **6.5" iPhone** (1242×2688 or 1284×2778)
- Required: **13-inch iPad** (if `supportsTablet: true` in app.json — disable it if you don't need iPad)
- Take screenshots from Simulator: File → Open Simulator → iPhone 16 Pro Max → Cmd+S
- Simulator produces 1320×2868 — resize with:
  ```bash
  mkdir ~/Desktop/appstore-screenshots
  sips -z 2778 1284 screenshot.png --out ~/Desktop/appstore-screenshots/screenshot.png
  ```

### Required fields
- **Category**: set in App Information (left sidebar)
- **Content Rights**: App Information → "does not contain third-party content"
- **Privacy Policy URL**: required — must be a live public URL
- **App Privacy**: fill out data collection questionnaire (App Privacy in left sidebar)
- **Age Rating**: complete the questionnaire (all "No" for most apps)
- **Build**: click Add Build, select the processed build
- **Sign-in credentials**: provide a test account for Apple's reviewer

### Review notes template
```
[App name] is a [description] app. Sign in with the provided credentials to access the app.
The app requires microphone permission to [purpose].
Core features: [list 3-4 features].
```

---

## Step 10 — App icon
- Must be 1024×1024px PNG, no transparency, no rounded corners
- Set in `app.json` → `icon` field
- Replace `assets/images/icon.png`

---

## Ongoing releases
```bash
# Test bundle
npx expo export --platform ios

# Build + submit
npx eas-cli build --platform ios --profile production
npx eas-cli submit --platform ios --profile production --latest
```
Then in App Store Connect: attach new build → Submit for Review.

For JS-only changes, consider **EAS Update** (OTA, no review needed):
```bash
npx eas-cli update --branch production --message "Fix: ..."
```

---

## Common gotchas checklist
- [ ] `.npmrc` with `legacy-peer-deps=true` committed
- [ ] All `EXPO_PUBLIC_*` env vars set in EAS (not just `.env`)
- [ ] `expo-auth-session` in package.json if using Clerk OAuth
- [ ] `nodeModulesPaths` in metro.config.js if using monorepo with shared convex dir
- [ ] Redirect URL registered in Clerk dashboard
- [ ] Privacy Policy page live and publicly accessible
- [ ] iPad screenshots if `supportsTablet: true`
- [ ] Bundle test passes locally before each EAS build
