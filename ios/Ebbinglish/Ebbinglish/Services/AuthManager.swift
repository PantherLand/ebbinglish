import Foundation

@MainActor
class AuthManager: ObservableObject {
    static let shared = AuthManager()

    @Published var isAuthenticated = false
    @Published var currentUser: UserProfile?
    @Published var isLoading = false
    @Published var errorMessage: String?

    func checkSession() {
        if KeychainService.shared.getToken() != nil {
            isAuthenticated = true
            Task { await loadProfile() }
        }
    }

    /// Authenticate using an API token (generated from web Settings page)
    func loginWithToken(_ token: String) async {
        isLoading = true
        errorMessage = nil

        let trimmed = token.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            errorMessage = "Token cannot be empty"
            isLoading = false
            return
        }

        KeychainService.shared.saveToken(trimmed)

        // Verify token by fetching profile
        do {
            currentUser = try await APIClient.shared.fetchProfile()
            isAuthenticated = true
        } catch {
            KeychainService.shared.deleteToken()
            errorMessage = "Invalid API token. Generate a new one from the web Settings page."
        }

        isLoading = false
    }

    func signOut() {
        KeychainService.shared.deleteToken()
        currentUser = nil
        isAuthenticated = false
    }

    private func loadProfile() async {
        do {
            currentUser = try await APIClient.shared.fetchProfile()
        } catch {
            if case APIError.unauthorized = error {
                signOut()
            }
        }
    }
}
