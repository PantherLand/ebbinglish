import Foundation

struct Word: Identifiable, Codable, Hashable {
    let id: String
    let userId: String
    var text: String
    var language: String
    var note: String?
    var entryJson: DictionaryEntry?
    var isPriority: Bool
    var isAchieved: Bool
    var manualCategory: String?
    var createdAt: Date
    var updatedAt: Date

    // Computed from ReviewState
    var status: WordStatus = .new
    var reviewState: ReviewState?

    enum CodingKeys: String, CodingKey {
        case id, userId, text, language, note, entryJson
        case isPriority, isAchieved, manualCategory
        case createdAt, updatedAt, status, reviewState
    }
}

enum WordStatus: String, Codable, CaseIterable {
    case new = "NEW"
    case seen = "SEEN"
    case unknown = "UNKNOWN"
    case fuzzy = "FUZZY"
    case known = "KNOWN"
    case frozen = "FROZEN"
    case mastered = "MASTERED"

    var displayName: String {
        rawValue
    }

    var color: String {
        switch self {
        case .new: return "StatusNew"
        case .seen: return "StatusSeen"
        case .unknown: return "StatusUnknown"
        case .fuzzy: return "StatusFuzzy"
        case .known: return "StatusKnown"
        case .frozen: return "StatusFrozen"
        case .mastered: return "StatusMastered"
        }
    }
}

struct ReviewState: Codable, Hashable {
    let id: String
    var seenCount: Int
    var lapseCount: Int
    var latestFirstTryGrade: Int?
    var consecutivePerfect: Int
    var freezeRounds: Int
    var isMastered: Bool
    var masteryPhase: Int
    var lastReviewedAt: Date?
}

struct ReviewLog: Identifiable, Codable {
    let id: String
    let userId: String
    let wordId: String
    var grade: Int // 0=unknown, 1=fuzzy, 2=known
    var revealedAnswer: Bool
    var msSpent: Int?
    var reviewedAt: Date
}

struct DictionaryEntry: Codable, Hashable {
    var headword: String?
    var pronunciation: String?
    var audioUrls: [String]?
    var posBlocks: [PosBlock]?
    var idioms: [Idiom]?

    struct PosBlock: Codable, Hashable {
        var pos: String
        var senses: [Sense]

        struct Sense: Codable, Hashable {
            var definition: String
            var examples: [String]?
        }
    }

    struct Idiom: Codable, Hashable {
        var phrase: String
        var definition: String
    }
}
