import Foundation

struct StatsOverview: Codable {
    var totalWords: Int
    var masteredWords: Int
    var totalSessions: Int
    var masteryDistribution: MasteryDistribution
    var reviewActivity: [DayActivity]
    var heatmap: [[HeatmapCell]]
}

struct MasteryDistribution: Codable {
    var new: Int
    var learning: Int
    var mastered: Int
}

struct DayActivity: Codable, Identifiable {
    var id: String { date }
    var date: String
    var count: Int
}

struct HeatmapCell: Codable {
    var date: String
    var count: Int
    var intensity: Int // 0-4
}

struct MemoryRating: Codable {
    var level: String // S, A, B, C, D
    var score: Double
    var summary: String
}
