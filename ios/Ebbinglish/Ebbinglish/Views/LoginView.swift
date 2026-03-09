import SwiftUI

struct LoginView: View {
    @EnvironmentObject var authManager: AuthManager
    @State private var apiToken = ""
    @State private var serverURL = "https://ebbinglish.app"
    @State private var showServerConfig = false

    var body: some View {
        VStack(spacing: 0) {
            Spacer()

            // Logo and Title
            VStack(spacing: 16) {
                Image(systemName: "brain.head.profile")
                    .font(.system(size: 60))
                    .foregroundStyle(
                        LinearGradient(
                            colors: [.purple, .blue],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )

                Text("Ebbinglish")
                    .font(.system(size: 34, weight: .bold))

                Text("Master English vocabulary\nwith spaced repetition")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
            }

            Spacer()

            // Token Auth Form
            VStack(spacing: 14) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("API Token")
                        .font(.subheadline)
                        .fontWeight(.medium)
                    Text("Generate a token from your web account:\nSettings > API Token > Generate")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                TextField("ebl_...", text: $apiToken)
                    .textFieldStyle(.roundedBorder)
                    .autocapitalization(.none)
                    .autocorrectionDisabled()
                    .font(.system(.body, design: .monospaced))

                if let error = authManager.errorMessage {
                    Text(error)
                        .font(.caption)
                        .foregroundColor(.red)
                        .multilineTextAlignment(.center)
                }

                Button(action: {
                    UserDefaults.standard.set(serverURL, forKey: "serverURL")
                    Task { await authManager.loginWithToken(apiToken) }
                }) {
                    if authManager.isLoading {
                        ProgressView()
                            .tint(.white)
                    } else {
                        Text("Connect")
                            .fontWeight(.semibold)
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(Color.blue)
                .foregroundColor(.white)
                .cornerRadius(12)
                .disabled(apiToken.trimmingCharacters(in: .whitespaces).isEmpty || authManager.isLoading)
            }
            .padding(.horizontal, 24)

            // Server Config
            Button(action: { showServerConfig.toggle() }) {
                HStack {
                    Image(systemName: "server.rack")
                    Text("Server: \(serverURL)")
                }
                .font(.caption)
                .foregroundColor(.secondary)
            }
            .padding(.top, 16)

            if showServerConfig {
                TextField("Server URL", text: $serverURL)
                    .textFieldStyle(.roundedBorder)
                    .font(.caption)
                    .padding(.horizontal, 24)
                    .padding(.top, 8)
            }

            Spacer()
                .frame(height: 40)
        }
        .background(Color(.systemGroupedBackground))
    }
}
