import Foundation

@MainActor
class SessionViewModel: ObservableObject {
    @Published var session: StudySession?
    @Published var words: [Word] = []
    @Published var currentIndex: Int = 0
    @Published var results: [SessionResult] = []
    @Published var isLoading = false
    @Published var isFinishing = false
    @Published var isCompleted = false
    @Published var errorMessage: String?
    @Published var showDefinition = false
    @Published var masteryUpdates: [APIClient.MasteryUpdate] = []

    var currentWord: Word? {
        guard currentIndex < words.count else { return nil }
        return words[currentIndex]
    }

    var progress: Double {
        guard !words.isEmpty else { return 0 }
        return Double(results.count) / Double(words.count)
    }

    var knownCount: Int { results.filter { $0.outcome == .known }.count }
    var fuzzyCount: Int { results.filter { $0.outcome == .fuzzy }.count }
    var unknownCount: Int { results.filter { $0.outcome == .unknown }.count }

    func startSession(roundId: String, type: SessionType) async {
        isLoading = true
        do {
            let response = try await APIClient.shared.startSession(roundId: roundId, type: type)
            session = response.session
            // Load word details for each word in the session
            var loadedWords: [Word] = []
            for wordId in response.session.wordIds {
                let word = try await APIClient.shared.fetchWordDetail(wordId: wordId)
                loadedWords.append(word)
            }
            words = loadedWords
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    func loadExistingSession(sessionId: String) async {
        isLoading = true
        do {
            session = try await APIClient.shared.fetchSession(sessionId: sessionId)
            if let session {
                var loadedWords: [Word] = []
                for wordId in session.wordIds {
                    let word = try await APIClient.shared.fetchWordDetail(wordId: wordId)
                    loadedWords.append(word)
                }
                words = loadedWords
                results = session.results
                currentIndex = results.count
            }
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    func recordOutcome(_ outcome: ReviewOutcome) async {
        guard let currentWord, let session else { return }

        let result = SessionResult(
            wordId: currentWord.id,
            outcome: outcome,
            timestamp: Date()
        )
        results.append(result)

        // Save progress
        do {
            _ = try await APIClient.shared.saveSessionProgress(sessionId: session.id, results: results)
        } catch {
            // Continue even if save fails - we have local state
        }

        showDefinition = false

        if results.count >= words.count {
            await finishSession()
        } else {
            currentIndex += 1
        }
    }

    private func finishSession() async {
        guard let session else { return }
        isFinishing = true
        do {
            let response = try await APIClient.shared.finishSession(sessionId: session.id, results: results)
            self.session = response.session
            masteryUpdates = response.masteryUpdates ?? []
            isCompleted = true
        } catch {
            errorMessage = error.localizedDescription
            // Still mark as completed locally
            isCompleted = true
        }
        isFinishing = false
    }
}
