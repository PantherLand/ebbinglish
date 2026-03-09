import Foundation

struct StudySession: Identifiable, Codable {
    let id: String
    let userId: String
    let roundId: String
    var type: SessionType
    var wordIds: [String]
    var results: [SessionResult]
    var startedAt: Date
    var completedAt: Date?

    var isCompleted: Bool { completedAt != nil }
    var totalWords: Int { wordIds.count }
    var completedWords: Int { results.count }
}

enum SessionType: String, Codable {
    case normal
    case extra
}

struct SessionResult: Codable, Hashable {
    let wordId: String
    let outcome: ReviewOutcome
    let timestamp: Date
}

enum ReviewOutcome: String, Codable, Hashable {
    case known
    case fuzzy
    case unknown

    var grade: Int {
        switch self {
        case .unknown: return 0
        case .fuzzy: return 1
        case .known: return 2
        }
    }

    var displayName: String {
        switch self {
        case .unknown: return "Unknown"
        case .fuzzy: return "Fuzzy"
        case .known: return "Known"
        }
    }

    var iconName: String {
        switch self {
        case .unknown: return "xmark.circle.fill"
        case .fuzzy: return "questionmark.circle.fill"
        case .known: return "checkmark.circle.fill"
        }
    }
}
