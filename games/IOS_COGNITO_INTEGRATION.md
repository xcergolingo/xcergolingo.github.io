# Add GoLingo Games single sign-on to your existing iPhone app

## What this accomplishes

- Users signed in with **Cognito email/password** open \`https://xcergolingo.github.io/games/\` inside GoLingo and can privately sync and publish lessons without another login.
- The browser website keeps its separate Cognito Hosted UI login for people visiting directly from Safari/Chrome.
- Supabase Row Level Security verifies the Cognito JWT. The game's WebView receives a **short-lived ID token**, never a password, refresh token, or Apple token.
- Native **Sign in with Apple currently uses Apple's own ID token**, NOT Cognito's; Apple users require Cognito federation/account linking first.

## Xcode installation — apply in the GoLingo iOS app

1. Download/copy [GoLingoCognitoWebViewBridge.swift](GoLingoCognitoWebViewBridge.swift) into your actual Xcode GoLingo project and select the GoLingo target.
2. Locate the Swift view controller that constructs the online games \`WKWebView\`. Do not modify \`LoginViewController\` or \`Cognito.openSession()\` for this.
3. Create a **strong** property \`private var golingoAuthBridge: GoLingoCognitoWebViewBridge?\`.
4. After the WKWebView has been created, but **before loading** \`https://xcergolingo.github.io/games/\`, assign:
   \`golingoAuthBridge = GoLingoCognitoWebViewBridge(webView: gamesWebView)\`.
5. On leaving/deallocating the dedicated gallery, call \`golingoAuthBridge?.stop()\` and set it to \`nil\`. Do not leave this handler installed for arbitrary game pages. If you reuse one WebView for gallery and games, stop the bridge before navigation to games; create it again on return.
6. Confirm the app calls \`Cognito.initPool()\` at startup as it already does for its email/password sign-in. The bridge uses \`Cognito.pool?.currentUser()?.getSession()\`; it will not re-prompt for a password when a valid cached Cognito session is available.
7. Test with **a fresh Cognito login** (from your existing app flow), then navigate to the gallery. It should show the account email and a Sync control, not a sign-in prompt.
8. When the app returns from background, optionally invoke \`window.GoLingoCognito?.requestNativeToken()\` in the trusted gallery to refresh the ID token. The web library also requests it when the page becomes visible.

## Important verification

The snippet is an integration component, **not** a modification to an App Store binary. You must compile it into the real GoLingo app before in-app single sign-on works.

Before releasing, test with two different Cognito accounts and confirm a private lesson for A cannot be accessed by B. Publishing is explicit, and shared-device browser history is kept under account-specific keys. Native Apple-only users will show a session unavailable message until Apple federation/linking is designed and deployed.

**Never** send Apple/Cognito JWTs, passwords, or refresh tokens as URL query parameters, to a public issue, or to an untrusted game iframe.
