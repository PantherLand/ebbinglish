import Foundation

@MainActor
class TodayViewModel: ObservableObject {
    @Published var wordsReviewedToday: Int = 0
    @Published var activeRound: StudyRound?
    @Published var recentRounds: [StudyRound] = []
    @Published var isLoading = false
    @Published var errorMessage: String?

    func load() async {
        isLoading = true
        do {
            let response = try await APIClient.shared.fetchToday()
            wordsReviewedToday = response.wordsReviewedToday
            activeRound = response.activeRound
            recentRounds = response.recentRounds
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }
}
