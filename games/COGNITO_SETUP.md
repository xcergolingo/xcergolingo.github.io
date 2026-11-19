# GoLingo Cognito authentication bridge — deployment checklist

## Already implemented in the GitHub game gallery

- \`games/cognito-auth.js\` provides browser authorization-code **PKCE** sign-in through Cognito Hosted UI or a short-lived Cognito **ID token** supplied by a trusted WKWebView host.
- \`games/cloud.js\` uses the existing Cognito ID token as Supabase's third-party accessToken callback. The separate Supabase email magic-link login was removed from the gallery.
- Per-game lesson history, deduplication, private sync, and explicit Publish / Unpublish remain.
- **Cloud Cognito mode is intentionally disabled** in \`cloud-config.json\` until the AWS and Supabase steps below are complete. Local lesson history still works.

## 1. Cognito Lambda role claim (AWS Console)

Cognito User Pool: \`us-east-1_m1wn7aFbx\` in \`us-east-1\`.

1. Create an AWS Lambda function based on [cognito-pre-token-trigger.mjs](cognito-pre-token-trigger.mjs) (Node.js runtime).
2. In Cognito User Pool > Extensions > Lambda triggers, configure **Pre Token Generation** to call that function.
3. Enable V1_0 ID-token claim customization or V2_0 as applicable. Grant Cognito permission to invoke it.
4. Confirm a **newly issued Cognito ID token** has the \`role: authenticated\` claim.
5. If your Cognito pool already has a pre-token trigger, **merge** the claim into it; do not replace existing functions blindly.

## 2. Supabase database migration (manual, not yet run)

1. Back up \`public.golingo_game_lessons\` in Supabase if any real records exist.
2. In SQL Editor, run [cognito-rls-migration.sql](cognito-rls-migration.sql) once.
3. It removes the \`auth.users\` foreign key, changes \`user_id\` from UUID to text, and replaces the policies. Data remains private unless published.
4. Old Supabase-auth UUID users are **not automatically linked** to Cognito identities. If such accounts contain lessons, preserve/migrate them using verified account linking.

## 3. Browser Cognito login (AWS console)

1. Configure a **public** Cognito app client without a client secret (prefer a separate SPA client).
2. Enable Cognito managed/hosted login, authorization code grant, \`openid email profile\` scopes, and the built-in Cognito user-pool identity provider.
3. Set callback and sign-out URLs to \`https://xcergolingo.github.io/games/\`.
4. Obtain its Hosted UI domain and public OAuth client ID.
5. Set \`cognito.webClientId\` and \`cognito.hostedUiDomain\` in \`cloud-config.json\`. Set \`cognito.enabled\` true **only after** steps 1–3 and security checks.

For browser Sign in with Apple, configure Apple federation in the Cognito User Pool and link identities deliberately. Do not merge accounts by matching email strings alone.

## 4. iPhone WKWebView bridge

- [GoLingoCognitoWebViewBridge.swift](GoLingoCognitoWebViewBridge.swift) is example Swift code to integrate into the app's trusted gallery WKWebView; it is not installed into the iOS app automatically.
- Register its script message handler **only** for \`https://xcergolingo.github.io/games/\`. Remove it before navigating to any other game or website.
- The bridge reads a fresh Cognito ID token from an existing Cognito email/password session. It **never** passes password or refresh token to JavaScript.
- Your **Apple native sign-in is separate**: it receives an Apple ID token, not Cognito. Federate Apple securely into Cognito or add a separately verified exchange before using the bridge for Apple accounts.
- Revoke any general-purpose preference storage of plain passwords; use iOS Keychain where appropriate.

## 5. Tests before enabling

- Two real Cognito accounts: each sees only their private lessons. One cannot change the other's records.
- Anonymous can see only explicitly published lessons; after unpublish those disappear.
- Duplicate lesson replay moves to the top without creating another row.
- Verify a user on web and in-app is the same Cognito \`sub\`.
- Verify JWT expiry, missing role, expired session, and malformed tokens fail closed.
- Local browser history remains device-local; clear shared-device browser data between accounts if privacy matters.

AWS setup, the SQL migration, and Swift app compilation require access to those services and haven't been performed by this GitHub commit. Do **not** mark cloud sharing as production-ready until these checks pass.
