import SwiftUI

struct WordDetailView: View {
    let wordId: String
    @State private var word: Word?
    @State private var logs: [ReviewLog] = []
    @State private var isLoading = true
    @State private var errorMessage: String?

    var body: some View {
        Group {
            if isLoading {
                ProgressView("Loading...")
            } else if let word {
                ScrollView {
                    VStack(alignment: .leading, spacing: 20) {
                        // Word Header
                        wordHeader(word)

                        // Dictionary Entry
                        if let entry = word.entryJson {
                            dictionarySection(entry)
                        }

                        // Review History
                        if !logs.isEmpty {
                            reviewHistorySection
                        }
                    }
                    .padding(16)
                }
            } else {
                ContentUnavailableView("Word Not Found", systemImage: "exclamationmark.triangle")
            }
        }
        .background(Color(.systemGroupedBackground))
        .navigationTitle(word?.text ?? "Word")
        .navigationBarTitleDisplayMode(.inline)
        .task { await loadData() }
    }

    private func wordHeader(_ word: Word) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text(word.text)
                    .font(.largeTitle)
                    .fontWeight(.bold)
                Spacer()
                StatusBadge(status: word.status)
            }

            if let note = word.note, !note.isEmpty {
                Text(note)
                    .font(.body)
                    .foregroundColor(.secondary)
            }

            if let entry = word.entryJson, let pron = entry.pronunciation {
                Text(pron)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }

            // Audio buttons
            if let entry = word.entryJson, let audioUrls = entry.audioUrls, !audioUrls.isEmpty {
                HStack(spacing: 12) {
                    ForEach(Array(audioUrls.enumerated()), id: \.offset) { _, url in
                        Button(action: { playAudio(url: url) }) {
                            Image(systemName: "speaker.wave.2.fill")
                                .font(.title3)
                                .foregroundColor(.blue)
                        }
                    }
                }
            }

            HStack(spacing: 16) {
                if let state = word.reviewState {
                    Label("Seen \(state.seenCount)×", systemImage: "eye")
                    Label("Lapses \(state.lapseCount)", systemImage: "arrow.uturn.backward")
                    if state.freezeRounds > 0 {
                        Label("Frozen \(state.freezeRounds) rounds", systemImage: "snowflake")
                    }
                }
            }
            .font(.caption)
            .foregroundColor(.secondary)
        }
        .padding(16)
        .background(Color(.systemBackground))
        .cornerRadius(12)
    }

    private func dictionarySection(_ entry: DictionaryEntry) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Dictionary")
                .font(.title3)
                .fontWeight(.bold)

            if let posBlocks = entry.posBlocks {
                ForEach(Array(posBlocks.enumerated()), id: \.offset) { _, block in
                    VStack(alignment: .leading, spacing: 8) {
                        Text(block.pos)
                            .font(.subheadline)
                            .fontWeight(.semibold)
                            .foregroundColor(.blue)
                            .italic()

                        ForEach(Array(block.senses.enumerated()), id: \.offset) { idx, sense in
                            VStack(alignment: .leading, spacing: 4) {
                                HStack(alignment: .top) {
                                    Text("\(idx + 1).")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                    Text(sense.definition)
                                        .font(.body)
                                }
                                if let examples = sense.examples {
                                    ForEach(examples, id: \.self) { example in
                                        Text("• \(example)")
                                            .font(.caption)
                                            .foregroundColor(.secondary)
                                            .italic()
                                            .padding(.leading, 16)
                                    }
                                }
                            }
                        }
                    }
                    .padding(12)
                    .background(Color(.systemBackground))
                    .cornerRadius(8)
                }
            }

            if let idioms = entry.idioms, !idioms.isEmpty {
                Text("Idioms")
                    .font(.subheadline)
                    .fontWeight(.semibold)

                ForEach(Array(idioms.enumerated()), id: \.offset) { _, idiom in
                    VStack(alignment: .leading, spacing: 2) {
                        Text(idiom.phrase)
                            .font(.body)
                            .fontWeight(.medium)
                        Text(idiom.definition)
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    .padding(8)
                    .background(Color(.systemBackground))
                    .cornerRadius(6)
                }
            }
        }
    }

    private var reviewHistorySection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Review History")
                .font(.title3)
                .fontWeight(.bold)

            ForEach(logs) { log in
                HStack {
                    Circle()
                        .fill(gradeColor(log.grade))
                        .frame(width: 8, height: 8)

                    Text(gradeLabel(log.grade))
                        .font(.subheadline)
                        .fontWeight(.medium)

                    Spacer()

                    Text(log.reviewedAt, style: .relative)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                .padding(.vertical, 6)
                .padding(.horizontal, 12)
                .background(Color(.systemBackground))
                .cornerRadius(6)
            }
        }
    }

    private func gradeColor(_ grade: Int) -> Color {
        switch grade {
        case 0: return .red
        case 1: return .orange
        case 2: return .green
        default: return .gray
        }
    }

    private func gradeLabel(_ grade: Int) -> String {
        switch grade {
        case 0: return "Unknown"
        case 1: return "Fuzzy"
        case 2: return "Known"
        default: return "N/A"
        }
    }

    private func playAudio(url: String) {
        // Audio playback will be implemented with AVFoundation
    }

    private func loadData() async {
        isLoading = true
        do {
            word = try await APIClient.shared.fetchWordDetail(wordId: wordId)
            logs = try await APIClient.shared.fetchWordLogs(wordId: wordId)
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }
}
