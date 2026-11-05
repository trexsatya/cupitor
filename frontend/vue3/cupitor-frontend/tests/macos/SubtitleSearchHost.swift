import AppKit
import WebKit

@MainActor
final class SubtitleSearchHost: NSObject, WKScriptMessageHandler, WKNavigationDelegate {
  private var window: NSWindow!
  private var webView: WKWebView!
  private var timeout: Timer?

  func start(_ url: URL) {
    let configuration = WKWebViewConfiguration()
    configuration.userContentController.add(self, name: "SearchTestResult")
    configuration.userContentController.addUserScript(WKUserScript(source: "window.__cupitorNativeHostEngine='WKWebView';",
      injectionTime: .atDocumentStart, forMainFrameOnly: true))
    webView = WKWebView(frame: NSRect(x: 0, y: 0, width: 1000, height: 700), configuration: configuration)
    webView.navigationDelegate = self
    window = NSWindow(contentRect: webView.frame, styleMask: [.titled], backing: .buffered, defer: false)
    window.contentView = webView
    window.orderFront(nil)
    timeout = Timer.scheduledTimer(withTimeInterval: 240, repeats: false) { [weak self] _ in
      Task { @MainActor in self?.finish(false, "Native WKWebView search test did not finish") }
    }
    webView.load(URLRequest(url: url))
  }

  func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
    guard let result = message.body as? [String: Any] else { finish(false, "Invalid test result"); return }
    let data = try? JSONSerialization.data(withJSONObject: result, options: [.sortedKeys])
    finish(result["passed"] as? Bool == true && result["engine"] as? String == "WKWebView",
      data.flatMap { String(data: $0, encoding: .utf8) } ?? "Invalid JSON result")
  }

  func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
    finish(false, error.localizedDescription)
  }

  private func finish(_ passed: Bool, _ message: String) {
    timeout?.invalidate()
    print(message)
    fflush(stdout)
    exit(passed ? 0 : 1)
  }
}

@main
struct Main {
  @MainActor static func main() {
    guard CommandLine.arguments.count == 2, let url = URL(string: CommandLine.arguments[1]) else { exit(2) }
    let application = NSApplication.shared
    application.setActivationPolicy(.accessory)
    let host = SubtitleSearchHost()
    host.start(url)
    application.run()
    withExtendedLifetime(host) {}
  }
}
