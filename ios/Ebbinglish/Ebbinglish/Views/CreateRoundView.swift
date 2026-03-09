import SwiftUI

struct CreateRoundView: View {
    @StateObject private var viewModel = CreateRoundViewModel()
    @Environment(\.dismiss) private var dismiss
    var onCreated: (() -> Void)?

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Round Name
                VStack(alignment: .leading, spacing: 8) {
                    Text("Round Name")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                    TextField("Round name", text: $viewModel.roundName)
                        .textFieldStyle(.roundedBorder)
                }
                .padding(16)

                // Search & Filter
                VStack(spacing: 8) {
                    HStack {
                        Image(systemName: "magnifyingglass")
                            .foregroundColor(.secondary)
                        TextField("Search words...", text: $viewModel.searchText)
                    }
                    .padding(10)
                    .background(Color(.systemGray6))
                    .cornerRadius(10)

                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            FilterChip(title: "All", isSelected: viewModel.statusFilter == "all") {
                                viewModel.statusFilter = "all"
                            }
                            ForEach(WordStatus.allCases, id: \.self) { status in
                                FilterChip(title: status.displayName, isSelected: viewModel.statusFilter == status.rawValue.lowercased()) {
                                    viewModel.statusFilter = status.rawValue.lowercased()
                                }
                            }
                        }
                    }
                }
                .padding(.horizontal, 16)

                // Selection count
                HStack {
                    Text("\(viewModel.selectedWordIds.count) words selected")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                    Spacer()
                    if !viewModel.selectedWordIds.isEmpty {
                        Button("Clear") {
                            viewModel.selectedWordIds.removeAll()
                        }
                        .font(.subheadline)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 8)

                // Word List
                if viewModel.isLoading {
                    Spacer()
                    ProgressView()
                    Spacer()
                } else {
                    List {
                        ForEach(viewModel.filteredWords) { word in
                            Button(action: { viewModel.toggleWord(word.id) }) {
                                HStack {
                                    Image(systemName: viewModel.selectedWordIds.contains(word.id)
                                          ? "checkmark.circle.fill" : "circle")
                                        .foregroundColor(viewModel.selectedWordIds.contains(word.id) ? .blue : .secondary)

                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(word.text)
                                            .font(.body)
                                            .fontWeight(.medium)
                                            .foregroundColor(.primary)
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
                            }
                        }
                    }
                    .listStyle(.plain)
                }
            }
            .navigationTitle("New Round")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Create") {
                        Task {
                            if let _ = await viewModel.createRound() {
                                onCreated?()
                                dismiss()
                            }
                        }
                    }
                    .disabled(viewModel.selectedWordIds.isEmpty || viewModel.isCreating)
                }
            }
            .task {
                await viewModel.loadWords()
            }
            .alert("Error", isPresented: .init(
                get: { viewModel.errorMessage != nil },
                set: { if !$0 { viewModel.errorMessage = nil } }
            )) {
                Button("OK") { viewModel.errorMessage = nil }
            } message: {
                Text(viewModel.errorMessage ?? "")
            }
        }
    }
}

struct FilterChip: View {
    let title: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.caption)
                .fontWeight(isSelected ? .semibold : .regular)
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(isSelected ? Color.blue : Color(.systemGray6))
                .foregroundColor(isSelected ? .white : .primary)
                .cornerRadius(16)
        }
    }
}
