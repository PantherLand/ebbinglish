import Foundation

@MainActor
class RoundsViewModel: ObservableObject {
    @Published var activeRounds: [StudyRound] = []
    @Published var completedRounds: [StudyRound] = []
    @Published var isLoading = false
    @Published var errorMessage: String?

    func load() async {
        isLoading = true
        do {
            let response = try await APIClient.shared.fetchRounds()
            activeRounds = response.rounds.filter { $0.status == .active }
            completedRounds = response.rounds.filter { $0.status == .completed }
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    func deleteRound(_ round: StudyRound) async {
        do {
            _ = try await APIClient.shared.deleteRound(roundId: round.id)
            activeRounds.removeAll { $0.id == round.id }
            completedRounds.removeAll { $0.id == round.id }
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

@MainActor
class CreateRoundViewModel: ObservableObject {
    @Published var availableWords: [Word] = []
    @Published var selectedWordIds: Set<String> = []
    @Published var roundName: String = ""
    @Published var searchText: String = ""
    @Published var statusFilter: String = "all"
    @Published var isLoading = false
    @Published var isCreating = false
    @Published var errorMessage: String?

    var filteredWords: [Word] {
        availableWords.filter { word in
            let matchesSearch = searchText.isEmpty || word.text.localizedCaseInsensitiveContains(searchText)
            let matchesStatus = statusFilter == "all" || word.status.rawValue.lowercased() == statusFilter.lowercased()
            return matchesSearch && matchesStatus
        }
    }

    func loadWords() async {
        isLoading = true
        do {
            let response = try await APIClient.shared.fetchLibrary(page: 1)
            availableWords = response.words
            // Generate default name
            let formatter = DateFormatter()
            formatter.dateFormat = "yyyy-MM-dd"
            roundName = "Round \(formatter.string(from: Date()))"
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    func toggleWord(_ wordId: String) {
        if selectedWordIds.contains(wordId) {
            selectedWordIds.remove(wordId)
        } else {
            selectedWordIds.insert(wordId)
        }
    }

    func createRound() async -> StudyRound? {
        guard !selectedWordIds.isEmpty else {
            errorMessage = "Select at least one word"
            return nil
        }
        isCreating = true
        do {
            let response = try await APIClient.shared.createRound(
                name: roundName,
                wordIds: Array(selectedWordIds)
            )
            return response.round
        } catch {
            errorMessage = error.localizedDescription
            return nil
        }
    }
}
