import SwiftUI

struct RoundDetailView: View {
    let roundId: String
    @State private var round: StudyRound?
    @State private var roundWords: [Word] = []
    @State private var isLoading = true
    @State private var errorMessage: String?
    @State private var showStartSession = false
    @State private var activeSession: StudySession?
    @State private var navigateToSession = false
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        Group {
            if isLoading {
                ProgressView("Loading round...")
            } else if let round {
                ScrollView {
                    VStack(spacing: 20) {
                        // Progress Header
                        roundProgressHeader(round)

                        // Action Buttons
                        actionButtons(round)

                        // Word List
                        wordListSection
                    }
                    .padding(16)
                }
            } else {
                ContentUnavailableView("Round Not Found", systemImage: "exclamationmark.triangle")
            }
        }
        .background(Color(.systemGroupedBackground))
        .navigationTitle(round?.displayName ?? "Round")
        .navigationBarTitleDisplayMode(.inline)
        .task { await loadRound() }
        .navigationDestination(isPresented: $navigateToSession) {
            if let session = activeSession {
                SessionView(session: session)
            }
        }
    }

    private func roundProgressHeader(_ round: StudyRound) -> some View {
        VStack(spacing: 12) {
            HStack {
                VStack(alignment: .leading) {
                    Text(round.displayName)
                        .font(.title2)
                        .fontWeight(.bold)
                    RoundStatusBadge(status: round.status)
                }
                Spacer()
            }

            ProgressBar(
                progress: round.progress,
                color: round.status == .completed ? .green : .blue,
                height: 8
            )

            HStack {
                Label("\(round.masteredCount) mastered", systemImage: "checkmark.circle.fill")
                    .font(.caption)
                    .foregroundColor(.green)
                Spacer()
                Label("\(round.totalCount) total", systemImage: "list.bullet")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .padding(16)
        .background(Color(.systemBackground))
        .cornerRadius(12)
    }

    private func actionButtons(_ round: StudyRound) -> some View {
        VStack(spacing: 10) {
            if round.status == .active {
                Button(action: { startNormalSession() }) {
                    HStack {
                        Image(systemName: "play.fill")
                        Text("Start Session")
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(Color.blue)
                    .foregroundColor(.white)
                    .cornerRadius(12)
                    .font(.headline)
                }

                Button(action: { startExtraSession() }) {
                    HStack {
                        Image(systemName: "arrow.clockwise")
                        Text("Extra Practice")
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(Color(.systemBackground))
                    .foregroundColor(.blue)
                    .cornerRadius(12)
                    .font(.headline)
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(Color.blue, lineWidth: 1)
                    )
                }
            }
        }
    }

    private var wordListSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Words (\(roundWords.count))")
                .font(.title3)
                .fontWeight(.bold)

            ForEach(roundWords) { word in
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(word.text)
                            .font(.body)
                            .fontWeight(.medium)
                        if let note = word.note {
                            Text(note)
                                .font(.caption)
                                .foregroundColor(.secondary)
                                .lineLimit(1)
                        }
                    }
                    Spacer()
                    StatusBadge(status: word.status)
                }
                .padding(.vertical, 8)
                .padding(.horizontal, 12)
                .background(Color(.systemBackground))
                .cornerRadius(8)
            }
        }
    }

    private func loadRound() async {
        isLoading = true
        do {
            round = try await APIClient.shared.fetchRoundDetail(roundId: roundId)
            if let round {
                var words: [Word] = []
                for wordId in round.wordIds {
                    let word = try await APIClient.shared.fetchWordDetail(wordId: wordId)
                    words.append(word)
                }
                roundWords = words
            }
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    private func startNormalSession() {
        Task {
            do {
                let response = try await APIClient.shared.startSession(roundId: roundId, type: .normal)
                activeSession = response.session
                navigateToSession = true
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }

    private func startExtraSession() {
        Task {
            do {
                let response = try await APIClient.shared.startSession(roundId: roundId, type: .extra)
                activeSession = response.session
                navigateToSession = true
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }
}
