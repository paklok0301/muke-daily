import SwiftUI
import WebKit

struct WebContainer: UIViewRepresentable {
    @Binding var isLoading: Bool
    let onSnapshot: @MainActor (Data) async -> Void
    let onNativeSettings: @MainActor () -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(parent: self)
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        let userContentController = WKUserContentController()
        userContentController.add(context.coordinator, name: "mukeSync")
        userContentController.add(context.coordinator, name: "mukeNativeSettings")
        userContentController.addUserScript(WKUserScript(
            source: "window.__MUKE_NATIVE__ = true;",
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        ))
        configuration.userContentController = userContentController
        configuration.websiteDataStore = .default()
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.isOpaque = false
        webView.backgroundColor = UIColor(red: 0.027, green: 0.031, blue: 0.039, alpha: 1)
        webView.scrollView.backgroundColor = webView.backgroundColor
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.allowsBackForwardNavigationGestures = true
        if #available(iOS 16.4, *) { webView.isInspectable = true }

        let url = URL(string: "https://paklok0301.github.io/muke-daily/?native=1&v=11")!
        webView.load(URLRequest(url: url, cachePolicy: .reloadRevalidatingCacheData, timeoutInterval: 20))
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    static func dismantleUIView(_ webView: WKWebView, coordinator: Coordinator) {
        webView.configuration.userContentController.removeScriptMessageHandler(forName: "mukeSync")
        webView.configuration.userContentController.removeScriptMessageHandler(forName: "mukeNativeSettings")
    }

    final class Coordinator: NSObject, WKNavigationDelegate, WKScriptMessageHandler {
        private let parent: WebContainer

        init(parent: WebContainer) {
            self.parent = parent
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            Task { @MainActor in parent.isLoading = false }
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            Task { @MainActor in parent.isLoading = false }
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            Task { @MainActor in parent.isLoading = false }
        }

        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            switch message.name {
            case "mukeSync":
                guard JSONSerialization.isValidJSONObject(message.body),
                      let data = try? JSONSerialization.data(withJSONObject: message.body) else { return }
                Task { @MainActor in await parent.onSnapshot(data) }
            case "mukeNativeSettings":
                Task { @MainActor in parent.onNativeSettings() }
            default:
                break
            }
        }
    }
}
