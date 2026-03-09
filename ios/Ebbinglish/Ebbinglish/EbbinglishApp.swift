import SwiftUI
import SwiftData

@main
struct EbbinglishApp: App {
    @StateObject private var authManager = AuthManager.shared
    @StateObject private var appState = AppState.shared

    var body: some Scene {
        WindowGroup {
            Group {
                if authManager.isAuthenticated {
                    MainTabView()
                        .environmentObject(authManager)
                        .environmentObject(appState)
                } else {
                    LoginView()
                        .environmentObject(authManager)
                }
            }
            .onAppear {
                authManager.checkSession()
            }
        }
    }
}
