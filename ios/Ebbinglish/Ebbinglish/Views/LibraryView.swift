import SwiftUI

struct LibraryView: View {
    @StateObject private var viewModel = LibraryViewModel()
    @State private var showAddSheet = false
    @State private var newWordText = ""
    @State private var newWordNote = ""

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Search Bar
                HStack {
                    Image(systemName: "magnifyingglass")
                        .foregroundColor(.secondary)
                    TextField("Search words...", text: $viewModel.searchText)
                        .textFieldStyle(.plain)
                        .onSubmit { Task { await viewModel.load() } }
                    if !viewModel.searchText.isEmpty {
                        Button(action: {
                            viewModel.searchText = ""
                            Task { await viewModel.load() }
                        }) {
                            Image(systemName: "xmark.circle.fill")
                                .foregroundColor(.secondary)
                        }
                    }
                }
                .padding(12)
                .background(Color(.systemGray6))
                .cornerRadius(10)
                .padding(.horizontal, 16)
                .padding(.top, 8)

                // Status Filter
                HStack {
                    Image(systemName: "line.3.horizontal.decrease")
                        .foregroundColor(.secondary)
                    Menu {
                        Button("All Status") { updateFilter("all") }
                        Divider()
                        ForEach(WordStatus.allCases, id: \.self) { status in
                            Button(status.displayName) { updateFilter(status.rawValue.lowercased()) }
                        }
                    } label: {
                        HStack {
                            Text(viewModel.statusFilter == "all" ? "All Status" : viewModel.statusFilter.capitalized)
                                .font(.subheadline)
                            Image(systemName: "chevron.down")
                                .font(.caption)
                        }
                        .foregroundColor(.primary)
                    }
                    Spacer()
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 10)

                // Word List
                if viewModel.isLoading && viewModel.words.isEmpty {
                    Spacer()
                    ProgressView()
                    Spacer()
                } else if viewModel.words.isEmpty {
                    Spacer()
                    ContentUnavailableView(
                        "No Words",
                        systemImage: "book",
                        description: Text("Add your first word to get started")
                    )
                    Spacer()
                } else {
                    List {
                        ForEach(viewModel.words) { word in
                            NavigationLink(destination: WordDetailView(wordId: word.id)) {
                                WordRow(word: word)
                            }
                            .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                                Button(role: .destructive) {
                                    Task { await viewModel.deleteWord(word) }
                                } label: {
                                    Label("Delete", systemImage: "trash")
                                }
                            }
                            .onAppear {
                                if word.id == viewModel.words.last?.id {
                                    Task { await viewModel.loadMore() }
                                }
                            }
                        }

                        if viewModel.isLoadingMore {
                            HStack {
                                Spacer()
                                ProgressView()
                                Spacer()
                            }
                        }
                    }
                    .listStyle(.plain)
                }
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("Library")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button(action: { showAddSheet = true }) {
                        Label("Add", systemImage: "plus")
                            .font(.subheadline.weight(.semibold))
                            .padding(.horizontal, 12)
                            .padding(.vertical, 6)
                            .background(Color.blue)
                            .foregroundColor(.white)
                            .cornerRadius(18)
                    }
                }
            }
            .sheet(isPresented: $showAddSheet) {
                addWordSheet
            }
            .refreshable {
                await viewModel.load()
            }
            .task {
                await viewModel.load()
            }
        }
    }

    private func updateFilter(_ filter: String) {
        viewModel.statusFilter = filter
        Task { await viewModel.load() }
    }

    private var addWordSheet: some View {
        NavigationStack {
            Form {
                Section("Word") {
                    TextField("Enter word", text: $newWordText)
                        .autocapitalization(.none)
                        .autocorrectionDisabled()
                }
                Section("Note (optional)") {
                    TextField("Definition or note", text: $newWordNote)
                }
            }
            .navigationTitle("Add Word")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        showAddSheet = false
                        resetAddForm()
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add") {
                        Task {
                            let success = await viewModel.addWord(
                                text: newWordText.trimmingCharacters(in: .whitespacesAndNewlines),
                                note: newWordNote.isEmpty ? nil : newWordNote
                            )
                            if success {
                                showAddSheet = false
                                resetAddForm()
                            }
                        }
                    }
                    .disabled(newWordText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
        }
        .presentationDetents([.medium])
    }

    private func resetAddForm() {
        newWordText = ""
        newWordNote = ""
    }
}

struct WordRow: View {
    let word: Word

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 3) {
                Text(word.text)
                    .font(.body)
                    .fontWeight(.semibold)
                if let note = word.note, !note.isEmpty {
                    Text(note)
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .lineLimit(1)
                }
            }
            Spacer()
            StatusBadge(status: word.status)
        }
        .padding(.vertical, 4)
    }
}
