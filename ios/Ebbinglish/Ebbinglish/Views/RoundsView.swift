import SwiftUI

struct RoundsView: View {
    @StateObject private var viewModel = RoundsViewModel()
    @State private var showCreateRound = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                // Active Section
                if !viewModel.activeRounds.isEmpty {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Active")
                            .font(.title3)
                            .fontWeight(.bold)
                            .padding(.horizontal, 16)

                        ForEach(viewModel.activeRounds) { round in
                            NavigationLink(destination: RoundDetailView(roundId: round.id)) {
                                RoundCard(round: round)
                                    .padding(.horizontal, 16)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }

                // Completed Section
                if !viewModel.completedRounds.isEmpty {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Completed")
                            .font(.title3)
                            .fontWeight(.bold)
                            .padding(.horizontal, 16)

                        ForEach(viewModel.completedRounds) { round in
                            NavigationLink(destination: RoundDetailView(roundId: round.id)) {
                                RoundCard(round: round)
                                    .padding(.horizontal, 16)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }

                if viewModel.activeRounds.isEmpty && viewModel.completedRounds.isEmpty && !viewModel.isLoading {
                    ContentUnavailableView(
                        "No Rounds Yet",
                        systemImage: "square.grid.2x2",
                        description: Text("Create your first round to start learning")
                    )
                    .padding(.top, 60)
                }
            }
            .padding(.vertical, 8)
        }
        .background(Color(.systemGroupedBackground))
        .navigationTitle("Rounds")
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
