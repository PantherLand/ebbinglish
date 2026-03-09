import SwiftUI

struct SessionView: View {
    let session: StudySession
    @StateObject private var viewModel = SessionViewModel()
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        Group {
            if viewModel.isLoading {
                ProgressView("Loading session...")
            } else if viewModel.isCompleted {
                sessionSummary
            } else if let word = viewModel.currentWord {
                sessionCard(word: word)
            } else {
                ContentUnavailableView("No Words", systemImage: "doc.text")
            }
        }
        .navigationBarBackButtonHidden(!viewModel.isCompleted)
        .toolbar {
            if !viewModel.isCompleted {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Exit") { dismiss() }
                        .foregroundColor(.secondary)
                }
                ToolbarItem(placement: .principal) {
                    Text("\(viewModel.results.count + 1) / \(viewModel.words.count)")
                        .font(.subheadline)
                        .fontWeight(.medium)
                }
            }
        }
        .task {
            await viewModel.loadExistingSession(sessionId: session.id)
        }
    }

    // MARK: - Session Card
    private func sessionCard(word: Word) -> some View {
        VStack(spacing: 0) {
            // Progress bar
            ProgressBar(progress: viewModel.progress, color: .blue, height: 4)
                .padding(.horizontal, 16)
                .padding(.top, 8)

            Spacer()

            // Word display
            VStack(spacing: 16) {
                Text(word.text)
                    .font(.system(size: 36, weight: .bold))
                    .multilineTextAlignment(.center)

                if let entry = word.entryJson, let pron = entry.pronunciation {
                    Text(pron)
                        .font(.title3)
                        .foregroundColor(.secondary)
                }

                // Audio button
                if let entry = word.entryJson, let audioUrls = entry.audioUrls, !audioUrls.isEmpty {
                    Button(action: { /* play audio */ }) {
                        Image(systemName: "speaker.wave.2.fill")
                            .font(.title2)
                            .foregroundColor(.blue)
                            .padding(12)
                            .background(Color.blue.opacity(0.1))
                            .clipShape(Circle())
                    }
                }

                // Show/Hide definition
                if viewModel.showDefinition {
                    definitionView(word: word)
                        .transition(.opacity.combined(with: .move(edge: .bottom)))
                } else {
                    Button("Show Definition") {
                        withAnimation(.easeInOut(duration: 0.25)) {
                            viewModel.showDefinition = true
                        }
                    }
                    .font(.subheadline)
                    .foregroundColor(.blue)
                    .padding(.top, 8)
                }
            }
            .padding(.horizontal, 24)

            Spacer()

            // Grade Buttons
            gradeButtons
        }
    }

    private func definitionView(word: Word) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            if let note = word.note, !note.isEmpty {
                Text(note)
                    .font(.body)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity)
            }

            if let entry = word.entryJson, let posBlocks = entry.posBlocks {
                ForEach(Array(posBlocks.prefix(2).enumerated()), id: \.offset) { _, block in
                    VStack(alignment: .leading, spacing: 4) {
                        Text(block.pos)
                            .font(.caption)
                            .fontWeight(.semibold)
                            .foregroundColor(.blue)
                        ForEach(Array(block.senses.prefix(2).enumerated()), id: \.offset) { _, sense in
                            Text(sense.definition)
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                        }
                    }
                }
            }
        }
        .padding(16)
        .background(Color(.systemGray6))
        .cornerRadius(12)
    }

    private var gradeButtons: some View {
        HStack(spacing: 12) {
            GradeButton(
                title: "Unknown",
                icon: "xmark.circle.fill",
                color: .red
            ) {
                Task { await viewModel.recordOutcome(.unknown) }
            }

            GradeButton(
                title: "Fuzzy",
                icon: "questionmark.circle.fill",
                color: .orange
            ) {
                Task { await viewModel.recordOutcome(.fuzzy) }
            }

            GradeButton(
                title: "Known",
                icon: "checkmark.circle.fill",
                color: .green
            ) {
                Task { await viewModel.recordOutcome(.known) }
            }
        }
        .padding(.horizontal, 16)
        .padding(.bottom, 32)
    }

    // MARK: - Session Summary
    private var sessionSummary: some View {
        ScrollView {
            VStack(spacing: 24) {
                // Header
                VStack(spacing: 8) {
                    Image(systemName: "checkmark.seal.fill")
                        .font(.system(size: 50))
                        .foregroundColor(.green)
                    Text("Session Complete!")
                        .font(.title2)
                        .fontWeight(.bold)
                    Text("\(viewModel.words.count) words reviewed")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
                .padding(.top, 20)

                // Results breakdown
                HStack(spacing: 16) {
                    ResultCard(
                        count: viewModel.knownCount,
                        label: "Known",
                        color: .green,
                        icon: "checkmark.circle.fill"
                    )
                    ResultCard(
                        count: viewModel.fuzzyCount,
                        label: "Fuzzy",
                        color: .orange,
                        icon: "questionmark.circle.fill"
                    )
                    ResultCard(
                        count: viewModel.unknownCount,
                        label: "Unknown",
                        color: .red,
                        icon: "xmark.circle.fill"
                    )
                }
                .padding(.horizontal, 16)

                // Mastery Updates
                if !viewModel.masteryUpdates.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Mastery Updates")
                            .font(.headline)

                        ForEach(viewModel.masteryUpdates, id: \.wordId) { update in
                            HStack {
                                Image(systemName: "arrow.up.circle.fill")
                                    .foregroundColor(.green)
                                Text("Word \(update.wordId)")
                                Spacer()
                                Text(update.newStatus)
                                    .font(.caption)
                                    .fontWeight(.semibold)
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 2)
                                    .background(Color.green.opacity(0.15))
                                    .foregroundColor(.green)
                                    .cornerRadius(4)
                            }
                            .padding(.vertical, 4)
                        }
                    }
                    .padding(16)
                    .background(Color(.systemBackground))
                    .cornerRadius(12)
                    .padding(.horizontal, 16)
                }

                // Done Button
                Button(action: { dismiss() }) {
                    Text("Done")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .background(Color.blue)
                        .foregroundColor(.white)
                        .cornerRadius(12)
                }
                .padding(.horizontal, 16)
            }
        }
        .navigationTitle("Summary")
    }
}

// MARK: - Grade Button
struct GradeButton: View {
    let title: String
    let icon: String
    let color: Color
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.title2)
                Text(title)
                    .font(.caption)
                    .fontWeight(.medium)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 16)
            .background(color.opacity(0.1))
            .foregroundColor(color)
            .cornerRadius(12)
        }
    }
}

// MARK: - Result Card
struct ResultCard: View {
    let count: Int
    let label: String
    let color: Color
    let icon: String

    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: icon)
                .font(.title2)
                .foregroundColor(color)
            Text("\(count)")
                .font(.title2)
                .fontWeight(.bold)
            Text(label)
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 16)
        .background(Color(.systemBackground))
        .cornerRadius(12)
        .shadow(color: .black.opacity(0.03), radius: 2, y: 1)
    }
}
