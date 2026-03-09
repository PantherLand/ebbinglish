import SwiftUI

struct SettingsView: View {
    @StateObject private var viewModel = SettingsViewModel()
    @EnvironmentObject var authManager: AuthManager

    var body: some View {
        NavigationStack {
            List {
                // Profile Section
                Section {
                    HStack(spacing: 14) {
                        Circle()
                            .fill(Color(.systemGray4))
                            .frame(width: 50, height: 50)
                            .overlay(
                                Text(authManager.currentUser?.name?.prefix(1).uppercased() ?? "U")
                                    .font(.title2)
                                    .fontWeight(.semibold)
                                    .foregroundColor(.secondary)
                            )

                        VStack(alignment: .leading, spacing: 2) {
                            Text(authManager.currentUser?.name ?? "User")
                                .font(.headline)
                            Text(authManager.currentUser?.email ?? "")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }
                    .padding(.vertical, 4)
                }

                // Session Settings
                Section("SESSION") {
                    HStack {
                        Text("Words per Session")
                        Spacer()
                        Stepper("Words \(viewModel.settings.sessionSize)",
                                value: $viewModel.settings.sessionSize,
                                in: 1...60)
                            .labelsHidden()
                        Text("Words \(viewModel.settings.sessionSize)")
                            .foregroundColor(.blue)
                            .font(.subheadline)
                    }
                    .onChange(of: viewModel.settings.sessionSize) { _, newValue in
                        Task { await viewModel.updateSessionSize(newValue) }
                    }

                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Auto-Play Audio")
                            Text("Play pronunciation automatically")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                        Spacer()
                        Toggle("", isOn: $viewModel.settings.autoPlayAudio)
                            .labelsHidden()
                            .tint(.green)
                    }
                    .onChange(of: viewModel.settings.autoPlayAudio) { _, _ in
                        Task { await viewModel.toggleAutoPlay() }
                    }
                }

                // Mastery Settings
                Section("MASTERY") {
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Strict Mode")
                            Text("Require 2 consecutive \"Knowns\"")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                        Spacer()
                        Toggle("", isOn: $viewModel.settings.requireConsecutiveKnown)
                            .labelsHidden()
                            .tint(.green)
                    }
                    .onChange(of: viewModel.settings.requireConsecutiveKnown) { _, _ in
                        Task { await viewModel.toggleStrictMode() }
                    }

                    HStack {
                        Text("Freeze Duration")
                        Spacer()
                        Stepper("\(viewModel.settings.freezeRounds)",
                                value: $viewModel.settings.freezeRounds,
                                in: 1...20)
                            .labelsHidden()
                        Text("\(viewModel.settings.freezeRounds)")
                            .foregroundColor(.blue)
                            .font(.subheadline)
                        Text("Rounds")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                    }
                    .onChange(of: viewModel.settings.freezeRounds) { _, newValue in
                        Task { await viewModel.updateFreezeRounds(newValue) }
                    }
                }

                // Sign Out
                Section {
                    Button(action: { authManager.signOut() }) {
                        HStack {
                            Spacer()
                            Text("Sign Out")
                                .foregroundColor(.blue)
                            Spacer()
                        }
                    }
                }

                // Reset
                Section {
                    Button(action: { viewModel.showResetConfirmation = true }) {
                        HStack {
                            Spacer()
                            Text("Reset All Progress")
                                .foregroundColor(.red)
                            Spacer()
                        }
                    }
                }
            }
            .navigationTitle("Settings")
            .task {
                await viewModel.load()
            }
            .alert("Reset All Progress?", isPresented: $viewModel.showResetConfirmation) {
                Button("Cancel", role: .cancel) {}
                Button("Reset", role: .destructive) {
                    Task { await viewModel.resetAllProgress() }
                }
            } message: {
                Text("This will reset all your learning progress. This action cannot be undone.")
            }
        }
    }
}
