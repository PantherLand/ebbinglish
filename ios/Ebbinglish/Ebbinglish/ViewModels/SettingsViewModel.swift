import Foundation

@MainActor
class SettingsViewModel: ObservableObject {
    @Published var settings: StudySettings = .default
    @Published var isLoading = false
    @Published var isSaving = false
    @Published var errorMessage: String?
    @Published var showResetConfirmation = false
    @Published var isResetting = false

    func load() async {
        isLoading = true
        do {
            settings = try await APIClient.shared.fetchSettings()
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    func updateSessionSize(_ size: Int) async {
        let clamped = max(1, min(60, size))
        settings.sessionSize = clamped
        await saveSettings(.init(sessionSize: clamped, freezeRounds: nil, autoPlayAudio: nil, requireConsecutiveKnown: nil))
    }

    func updateFreezeRounds(_ rounds: Int) async {
        let clamped = max(1, min(20, rounds))
        settings.freezeRounds = clamped
        await saveSettings(.init(sessionSize: nil, freezeRounds: clamped, autoPlayAudio: nil, requireConsecutiveKnown: nil))
    }

    func toggleAutoPlay() async {
        settings.autoPlayAudio.toggle()
        await saveSettings(.init(sessionSize: nil, freezeRounds: nil, autoPlayAudio: settings.autoPlayAudio, requireConsecutiveKnown: nil))
    }

    func toggleStrictMode() async {
        settings.requireConsecutiveKnown.toggle()
        await saveSettings(.init(sessionSize: nil, freezeRounds: nil, autoPlayAudio: nil, requireConsecutiveKnown: settings.requireConsecutiveKnown))
    }

    private func saveSettings(_ req: APIClient.UpdateSettingsRequest) async {
        isSaving = true
        do {
            settings = try await APIClient.shared.updateSettings(req)
        } catch {
            errorMessage = error.localizedDescription
        }
        isSaving = false
    }

    func resetAllProgress() async {
        isResetting = true
        do {
            _ = try await APIClient.shared.resetProgress()
        } catch {
            errorMessage = error.localizedDescription
        }
        isResetting = false
    }
}
