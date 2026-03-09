import Foundation

struct StudyRound: Identifiable, Codable {
    let id: String
    let userId: String
    var name: String
    var status: RoundStatus
    var wordIds: [String]
    var completedWordIds: [String]
    var attemptedWordIds: [String]
    var firstTryKnownWordIds: [String]
    var createdAt: Date
    var updatedAt: Date

    var totalCount: Int { wordIds.count }
    var masteredCount: Int { completedWordIds.count }
    var progress: Double {
        guard totalCount > 0 else { return 0 }
        return Double(masteredCount) / Double(totalCount)
    }

    var isToday: Bool {
        Calendar.current.isDateInToday(createdAt)
    }

    var displayName: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        let dateStr = formatter.string(from: createdAt)
        if isToday {
            return "Round \(dateStr) (Today)"
        }
        return "Round \(dateStr)"
    }
}

enum RoundStatus: String, Codable {
    case active
    case completed
    case archived
}
