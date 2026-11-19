//
//  GoLingoCognitoWebViewBridge.swift
//  Add to the REAL GoLingo Xcode project (Target Membership: GoLingo).
//
//  Purpose: Reuse an authenticated Cognito User Pool session in the trusted
//  GoLingo Games gallery without requiring another email or browser login.
//
//  This adapter does NOT support Apple-native-only sessions. An Apple JWT is
//  NOT a Cognito JWT. Federate/link Apple users to Cognito first.
//
//  IMPORTANT: Register the bridge only for a dedicated WKWebView that shows
//  https://xcergolingo.github.io/games/.
//  Do not reuse it to display untrusted websites or game demo origins.
//

import Foundation
import WebKit
import AWSCognitoIdentityProvider

final class GoLingoCognitoWebViewBridge: NSObject, WKScriptMessageHandler {
    private weak var webView: WKWebView?
    private static let handlerName = "goLingoAuth"
    private static let trustedHost = "xcergolingo.github.io"
    private static let trustedPath = "/games/"
    private var active = true

    /// The web view should already have its WKWebViewConfiguration configured.
    /// Keep a STRONG reference to this bridge in your view controller.
    init(webView: WKWebView) {
        self.webView = webView
        super.init()
        webView.configuration.userContentController.add(
            self, name: Self.handlerName
        )
    }

    /// Call before destroying the view or reusing the WebView for a game/site.
    func stop() {
        guard active else { return }
        active = false
        webView?.configuration.userContentController.removeScriptMessageHandler(
            forName: Self.handlerName
        )
    }

    deinit { stop() }

    private func trustedGallery(_ url: URL?) -> Bool {
        guard let url = url else { return false }
        return url.scheme == "https"
            && url.host == Self.trustedHost
            && (url.path == Self.trustedPath || url.path == "/games")
    }

    func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {
        guard active,
              message.name == Self.handlerName,
              message.frameInfo.isMainFrame,
              message.frameInfo.securityOrigin.protocol == "https",
              message.frameInfo.securityOrigin.host == Self.trustedHost,
              let webView = webView,
              trustedGallery(webView.url),
              let request = message.body as? [String: Any],
              request["type"] as? String == "requestCognitoIdToken" else {
            return
        }

        // 'currentUser' points to the last authenticated User Pool user.
        // Only use a valid Cognito session; do NOT send Cognito.idToken blindly,
        // because the existing Apple handler also assigns an Apple JWT to it.
        guard let user = Cognito.pool?.currentUser(), user.isSignedIn else {
            sendFailure("No active Cognito User Pool session")
            return
        }

        user.getSession().continueWith { [weak self] task -> Any? in
            guard let self = self else { return nil }
            if task.error != nil {
                self.sendFailure("Cognito session unavailable")
                return nil
            }
            guard let jwt = task.result?.idToken?.tokenString, !jwt.isEmpty else {
                self.sendFailure("Cognito ID token unavailable")
                return nil
            }
            self.sendToken(jwt)
            return nil
        }
    }

    private func sendToken(_ token: String) {
        // JSON encoding avoids injecting raw token content into JavaScript.
        guard let data = try? JSONSerialization.data(withJSONObject: [token]),
              let json = String(data: data, encoding: .utf8) else { return }
        evaluateTrusted("window.GoLingoCognito?.receiveNativeToken(\(json)[0]);")
    }

    private func sendFailure(_ reason: String) {
        guard let data = try? JSONSerialization.data(withJSONObject: [reason]),
              let json = String(data: data, encoding: .utf8) else { return }
        evaluateTrusted("window.GoLingoCognito?.nativeSessionUnavailable(\(json)[0]);")
    }

    private func evaluateTrusted(_ javaScript: String) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self, self.active,
                  let view = self.webView,
                  self.trustedGallery(view.url) else { return }
            view.evaluateJavaScript(javaScript, completionHandler: nil)
        }
    }
}

/*
INTEGRATE IN YOUR CURRENT GAMES WKWebView VIEW CONTROLLER:

private var golingoAuthBridge: GoLingoCognitoWebViewBridge?

// AFTER creating your dedicated gallery WKWebView, BEFORE calling load():
golingoAuthBridge = GoLingoCognitoWebViewBridge(webView: gamesWebView)
gamesWebView.load(URLRequest(
    url: URL(string: "https://xcergolingo.github.io/games/")!
))

// When leaving/destroying that dedicated gallery WebView:
golingoAuthBridge?.stop()
golingoAuthBridge = nil

Keep this bridge ONLY on the gallery WebView. If the same WebView navigates
to a demo game, stop the bridge before navigation; re-create it when returning
to the trusted gallery.

Optional: on app becoming active, use the gallery page's JS API:
gamesWebView.evaluateJavaScript(
    "window.GoLingoCognito?.requestNativeToken()",
    completionHandler: nil
)
This refreshes the short-lived ID token from the SDK's existing session.
*/
