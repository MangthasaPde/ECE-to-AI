// The Gauntlet.app: starts the local game server and opens the game in its own window.
//
// A compiled app (not a shell script) so macOS privacy permissions such as Full Disk Access
// attach to it; the server runs as its child process and inherits that permission.
// Quitting the app stops the server it started. Build with launcher/build.sh.

import Cocoa

let gameURL = URL(string: "http://localhost:8000/")!
let fallbackProject = "/Users/mangthasapde/Downloads/ECE-to-AI"
let chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

final class AppDelegate: NSObject, NSApplicationDelegate {
    var server: Process?
    var project = URL(fileURLWithPath: fallbackProject)
    var log: URL { project.appendingPathComponent("data/server.log") }

    func applicationDidFinishLaunching(_ note: Notification) {
        // The app normally lives inside the project folder; fall back to where it was built.
        let parent = Bundle.main.bundleURL.deletingLastPathComponent()
        if FileManager.default.fileExists(atPath: parent.appendingPathComponent("setup_and_run.sh").path) { project = parent }

        isUp { up in
            if up { self.openGame() } else { self.startServer() }
        }
    }

    // Clicking the Dock icon while the app is running brings the game back.
    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        openGame()
        return false
    }

    func applicationDockMenu(_ sender: NSApplication) -> NSMenu? {
        let menu = NSMenu()
        menu.addItem(withTitle: "Open Game", action: #selector(openGameAction), keyEquivalent: "")
        return menu
    }

    @objc func openGameAction() { openGame() }

    func applicationWillTerminate(_ note: Notification) {
        quitting = true  // the server exiting now is expected, not a crash to report
        guard let server, server.isRunning else { return }
        server.terminate()
        server.waitUntilExit()
    }

    // MARK: - server

    func startServer() {
        try? FileManager.default.createDirectory(at: log.deletingLastPathComponent(), withIntermediateDirectories: true)
        FileManager.default.createFile(atPath: log.path, contents: nil)
        let p = Process()
        p.executableURL = URL(fileURLWithPath: "/bin/bash")
        p.arguments = ["setup_and_run.sh"]
        p.currentDirectoryURL = project
        // Apps opened from the Dock get a bare PATH, which finds macOS's old built-in python3.
        // Use the project's own virtualenv Python, and Homebrew's for a first-time setup.
        var env = ProcessInfo.processInfo.environment
        env["PATH"] = "/opt/homebrew/bin:/usr/local/bin:" + (env["PATH"] ?? "/usr/bin:/bin:/usr/sbin:/sbin")
        let venvPython = project.appendingPathComponent(".venv/bin/python").path
        if FileManager.default.isExecutableFile(atPath: venvPython) { env["GAUNTLET_PYTHON"] = venvPython }
        p.environment = env
        if let out = try? FileHandle(forWritingTo: log) { p.standardOutput = out; p.standardError = out }
        p.terminationHandler = { _ in
            DispatchQueue.main.async { if !self.quitting { self.serverDied() } }
        }
        do { try p.run() } catch {
            fail("Couldn't start the game server: \(error.localizedDescription)")
            return
        }
        server = p
        waitForServer(triesLeft: 600)  // first launch on a new machine installs dependencies
    }

    func waitForServer(triesLeft: Int) {
        isUp { up in
            if up { self.openGame(); return }
            guard triesLeft > 0, self.server?.isRunning == true else { return }  // serverDied() reports exits
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { self.waitForServer(triesLeft: triesLeft - 1) }
        }
    }

    var quitting = false

    func serverDied() {
        let text = (try? String(contentsOf: log, encoding: .utf8)) ?? ""
        if text.contains("Operation not permitted") {
            fail("macOS blocked access to the game folder.\n\nTurn on The Gauntlet in System Settings → Privacy & Security → Full Disk Access, then open the game again.",
                 settings: true)
        } else {
            fail("The game server stopped.\n\nDetails are in data/server.log inside the ECE-to-AI folder.")
        }
    }

    func isUp(_ done: @escaping (Bool) -> Void) {
        var req = URLRequest(url: gameURL)
        req.timeoutInterval = 1
        URLSession.shared.dataTask(with: req) { _, response, _ in
            let ok = (response as? HTTPURLResponse).map { $0.statusCode < 500 } ?? false
            DispatchQueue.main.async { done(ok) }
        }.resume()
    }

    // MARK: - windows

    func openGame() {
        // Chrome's app mode gives the game its own window with no tabs or address bar.
        if FileManager.default.isExecutableFile(atPath: chrome) {
            let p = Process()
            p.executableURL = URL(fileURLWithPath: chrome)
            p.arguments = ["--app=\(gameURL.absoluteString)"]
            if (try? p.run()) != nil { return }
        }
        NSWorkspace.shared.open(gameURL)
    }

    func fail(_ message: String, settings: Bool = false) {
        NSApp.activate(ignoringOtherApps: true)
        let alert = NSAlert()
        alert.messageText = "The Gauntlet"
        alert.informativeText = message
        alert.alertStyle = .critical
        if settings { alert.addButton(withTitle: "Open Settings"); alert.addButton(withTitle: "Quit") }
        if alert.runModal() == .alertFirstButtonReturn && settings,
           let url = URL(string: "x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles") {
            NSWorkspace.shared.open(url)
        }
        quitting = true
        NSApp.terminate(nil)
    }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.run()
