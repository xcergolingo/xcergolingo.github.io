// GoLingoCognitoWebViewBridge.swift
// Example to add to the iOS app; this file on GitHub Pages is NOT compiled
// into the existing app. Do not install on arbitrary web views or game domains.
import Foundation
import WebKit
import AWSCognitoIdentityProvider

final class GoLingoCognitoWebViewBridge: NSObject, WKScriptMessageHandler {
    weak var webView: WKWebView?
    var usernameProvider: () -> String?

    init(webView: WKWebView, usernameProvider: @escaping () -> String?) {
        self.webView = webView
        self.usernameProvider = usernameProvider
        super.init()
        webView.configuration.userContentController.add(self, name: "goLingoAuth")
    }

    deinit {
        webView?.configuration.userContentController.removeScriptMessageHandler(forName: "goLingoAuth")
    }

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "goLingoAuth", message.frameInfo.isMainFrame,
              message.frameInfo.securityOrigin.protocol == "https",
              message.frameInfo.securityOrigin.host == "xcergolingo.github.io",
              let page = webView?.url, page.scheme == "https",
              page.host == "xcergolingo.github.io",
              page.path == "/games/",
              let body = message.body as? [String: Any],
              body["type"] as? String == "requestCognitoIdToken",
              let username = usernameProvider(),
              let pool = Cognito.pool else { return }
        // Email/password: existing Cognito session. Does not work for
        // Apple-only users until their Apple identity is federated to Cognito.
        pool.getUser(username).getSession().continueWith { [weak self] task -> Any? in
            guard task.error == nil, let jwt = task.result?.idToken?.tokenString,
                  let bytes = try? JSONSerialization.data(withJSONObject: [jwt]),
                  let array = String(data: bytes, encoding: .utf8) else { return nil }
            DispatchQueue.main.async {
                guard let view = self?.webView, view.url?.scheme == "https",
                      view.url?.host == "xcergolingo.github.io",
                      view.url?.path == "/games/" else { return }
                view.evaluateJavaScript("window.GoLingoCognito?.receiveNativeToken(" +
                                        array + "[0])", completionHandler: nil)
            }
            return nil
        }
    }
}
// Protect ID tokens: do not put them in URLs or game demos, log them, or persist
// them in website storage. Never pass refresh tokens through this bridge.
// Remove this handler when the page navigates away from the trusted gallery.
