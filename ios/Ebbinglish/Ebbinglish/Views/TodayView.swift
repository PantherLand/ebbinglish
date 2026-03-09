import SwiftUI

struct TodayView: View {
    @StateObject private var viewModel = TodayViewModel()
    @State private var showCreateRound = false
    @State private var navigateToSession: String?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    // Daily Progress Card
                    dailyProgressCard

                    // Your Rounds Section
                    roundsSection
                }
                .padding(.horizontal, 16)
                .padding(.top, 8)
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("Today")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button(action: { showCreateRound = true }) {
                        Label("New", systemImage: "plus")
                            .font(.subheadline.weight(.semibold))
                            .padding(.horizontal, 12)
                            .padding(.vertical, 6)
                            .background(Color.blue)
                            .foregroundColor(.white)
                            .cornerRadius(18)
                    }
                }
            }
            .sheet(isPresented: $showCreateRound) {
                CreateRoundView(onCreated: {
                    Task { await viewModel.load() }
                })
            }
            .refreshable {
                await viewModel.load()
            }
            .task {
                await viewModel.load()
            }
        }
    }

    // MARK: - Daily Progress Card
    private var dailyProgressCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Header
            HStack(spacing: 10) {
                Image(systemName: "checkmark.seal.fill")
                    .font(.title2)
                    .foregroundColor(.white.opacity(0.9))

                VStack(alignment: .leading, spacing: 2) {
                    Text("Daily Progress")
                        .font(.subheadline)
                        .foregroundColor(.white.opacity(0.8))
                    Text("\(viewModel.wordsReviewedToday) Words Reviewed")
                        .font(.title2)
                        .fontWeight(.bold)
                        .foregroundColor(.white)
                }
            }

            // Active round quick access
            if let activeRound = viewModel.activeRound {
                NavigationLink(destination: RoundDetailView(roundId: activeRound.id)) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Continue your active round")
                            .font(.subheadline)
                            .foregroundColor(.white.opacity(0.8))

                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(activeRound.displayName)
                                    .font(.headline)
                                    .fontWeight(.bold)
                                    .foregroundColor(.white)
                                Text("\(activeRound.masteredCount) / \(activeRound.totalCount) mastered")
                                    .font(.caption)
                                    .foregroundColor(.white.opacity(0.7))
                            }

                            Spacer()

                            HStack(spacing: 4) {
                                Image(systemName: "play.fill")
                                Text("Resume")
                            }
                            .font(.subheadline.weight(.semibold))
                            .padding(.horizontal, 16)
                            .padding(.vertical, 8)
                            .background(.white)
                            .foregroundColor(.purple)
                            .cornerRadius(20)
                        }
                    }
                    .padding(14)
                    .background(.white.opacity(0.2))
                    .cornerRadius(12)
                }
            }
        }
        .padding(18)
        .background(
            LinearGradient(
                colors: [.purple, .blue.opacity(0.8)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        )
        .cornerRadius(16)
    }

    // MARK: - Rounds Section
    private var roundsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Your Rounds")
                    .font(.title3)
                    .fontWeight(.bold)

                Spacer()

                NavigationLink("View All") {
                    RoundsView()
                }
                .font(.subheadline)
            }

            if let activeRound = viewModel.activeRound {
                NavigationLink(destination: RoundDetailView(roundId: activeRound.id)) {
                    RoundCard(round: activeRound)
                }
                .buttonStyle(.plain)
            }

            // Create New Round button
            Button(action: { showCreateRound = true }) {
                HStack {
                    Image(systemName: "plus")
                        .foregroundColor(.secondary)
                    Text("Create New Round")
                        .foregroundColor(.secondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(16)
                .background(
                    RoundedRectangle(cornerRadius: 12)
                        .strokeBorder(style: StrokeStyle(lineWidth: 1.5, dash: [8, 4]))
                        .foregroundColor(.secondary.opacity(0.3))
                )
            }
        }
    }
}
