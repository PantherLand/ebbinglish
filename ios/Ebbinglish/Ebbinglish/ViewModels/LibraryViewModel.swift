import Foundation

@MainActor
class LibraryViewModel: ObservableObject {
    @Published var words: [Word] = []
    @Published var searchText: String = ""
    @Published var statusFilter: String = "all"
    @Published var totalCount: Int = 0
    @Published var currentPage: Int = 1
    @Published var isLoading = false
    @Published var isLoadingMore = false
    @Published var errorMessage: String?
    @Published var showAddWord = false

    private let pageSize = 20
    var hasMore: Bool { words.count < totalCount }

    func load() async {
        isLoading = true
        currentPage = 1
        do {
            let response = try await APIClient.shared.fetchLibrary(
                keyword: searchText.isEmpty ? nil : searchText,
                status: statusFilter == "all" ? nil : statusFilter,
                page: 1
            )
            words = response.words
            totalCount = response.total
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    func loadMore() async {
        guard hasMore, !isLoadingMore else { return }
        isLoadingMore = true
        currentPage += 1
        do {
            let response = try await APIClient.shared.fetchLibrary(
                keyword: searchText.isEmpty ? nil : searchText,
                status: statusFilter == "all" ? nil : statusFilter,
                page: currentPage
            )
            words.append(contentsOf: response.words)
        } catch {
            errorMessage = error.localizedDescription
            currentPage -= 1
        }
        isLoadingMore = false
    }

    func deleteWord(_ word: Word) async {
        do {
            _ = try await APIClient.shared.deleteWord(wordId: word.id)
            words.removeAll { $0.id == word.id }
            totalCount -= 1
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func addWord(text: String, note: String?) async -> Bool {
        do {
            let response = try await APIClient.shared.createWord(text: text, note: note)
            words.insert(response.word, at: 0)
            totalCount += 1
            return true
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }
}
