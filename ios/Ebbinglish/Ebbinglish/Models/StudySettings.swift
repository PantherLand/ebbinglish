import Foundation

struct StudySettings: Codable {
    var sessionSize: Int
    var freezeRounds: Int
    var autoPlayAudio: Bool
    var requireConsecutiveKnown: Bool

    static let `default` = StudySettings(
        sessionSize: 5,
        freezeRounds: 3,
        autoPlayAudio: true,
        requireConsecutiveKnown: true
    )
}

struct UserProfile: Codable {
    let id: String
    var name: String?
    var email: String?
    var image: String?
}
