import Foundation

@MainActor
class StatsViewModel: ObservableObject {
    @Published var stats: StatsOverview?
    @Published var isLoading = false
    @Published var errorMessage: String?

    func load() async {
        isLoading = true
        do {
            stats = try await APIClient.shared.fetchStats()
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }
}
