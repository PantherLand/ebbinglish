import Foundation
import AuthenticationServices

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

    func login(email: String, password: String) async {
        isLoading = true
        errorMessage = nil
        do {
            let response = try await APIClient.shared.login(email: email, password: password)
            KeychainService.shared.saveToken(response.token)
            currentUser = response.user
            isAuthenticated = true
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    func signOut() {
        KeychainService.shared.deleteToken()
        currentUser = nil
        isAuthenticated = false
        Task {
            try? await APIClient.shared.signOut()
        }
    }

    private func loadProfile() async {
        do {
            currentUser = try await APIClient.shared.fetchProfile()
        } catch {
            // Token may be invalid
            if case APIError.unauthorized = error {
                signOut()
            }
        }
    }
}
