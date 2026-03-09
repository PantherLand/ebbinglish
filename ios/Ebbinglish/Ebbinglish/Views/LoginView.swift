import SwiftUI

struct LoginView: View {
    @EnvironmentObject var authManager: AuthManager
    @State private var email = ""
    @State private var password = ""
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

            // Login Form
            VStack(spacing: 14) {
                TextField("Email", text: $email)
                    .textFieldStyle(.roundedBorder)
                    .textContentType(.emailAddress)
                    .autocapitalization(.none)
                    .autocorrectionDisabled()

                SecureField("Password", text: $password)
                    .textFieldStyle(.roundedBorder)
                    .textContentType(.password)

                if let error = authManager.errorMessage {
                    Text(error)
                        .font(.caption)
                        .foregroundColor(.red)
                        .multilineTextAlignment(.center)
                }

                Button(action: {
                    UserDefaults.standard.set(serverURL, forKey: "serverURL")
                    Task { await authManager.login(email: email, password: password) }
                }) {
                    if authManager.isLoading {
                        ProgressView()
                            .tint(.white)
                    } else {
                        Text("Sign In")
                            .fontWeight(.semibold)
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(Color.blue)
                .foregroundColor(.white)
                .cornerRadius(12)
                .disabled(email.isEmpty || password.isEmpty || authManager.isLoading)
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
