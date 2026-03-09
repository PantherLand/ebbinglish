import Foundation

enum APIError: LocalizedError {
    case unauthorized
    case networkError(Error)
    case serverError(Int, String?)
    case decodingError(Error)
    case invalidURL

    var errorDescription: String? {
        switch self {
        case .unauthorized: return "Please sign in again"
        case .networkError(let error): return error.localizedDescription
        case .serverError(let code, let msg): return msg ?? "Server error (\(code))"
        case .decodingError(let error): return "Data error: \(error.localizedDescription)"
        case .invalidURL: return "Invalid URL"
        }
    }
}

class APIClient {
    static let shared = APIClient()

    private var baseURL: String {
        UserDefaults.standard.string(forKey: "serverURL") ?? "https://ebbinglish.app"
    }

    private var authToken: String? {
        KeychainService.shared.getToken()
    }

    private let decoder: JSONDecoder = {
        let d = JSONDecoder()
        d.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let str = try container.decode(String.self)
            // Try ISO8601 with fractional seconds
            let formatter = ISO8601DateFormatter()
            formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            if let date = formatter.date(from: str) { return date }
            // Try without fractional seconds
            formatter.formatOptions = [.withInternetDateTime]
            if let date = formatter.date(from: str) { return date }
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Cannot decode date: \(str)")
        }
        return d
    }()

    private let encoder: JSONEncoder = {
        let e = JSONEncoder()
        e.dateEncodingStrategy = .iso8601
        return e
    }()

    private func request<T: Decodable>(
        method: String,
        path: String,
        body: Encodable? = nil,
        queryItems: [URLQueryItem]? = nil
    ) async throws -> T {
        guard var components = URLComponents(string: baseURL + path) else {
            throw APIError.invalidURL
        }
        if let queryItems { components.queryItems = queryItems }
        guard let url = components.url else { throw APIError.invalidURL }

        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")

        if let token = authToken {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        if let body {
            req.httpBody = try encoder.encode(body)
        }

        let (data, response): (Data, URLResponse)
        do {
            (data, response) = try await URLSession.shared.data(for: req)
        } catch {
            throw APIError.networkError(error)
        }

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.serverError(0, "Invalid response")
        }

        if httpResponse.statusCode == 401 {
            throw APIError.unauthorized
        }

        guard (200..<300).contains(httpResponse.statusCode) else {
            let msg = String(data: data, encoding: .utf8)
            throw APIError.serverError(httpResponse.statusCode, msg)
        }

        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            throw APIError.decodingError(error)
        }
    }

    // MARK: - Auth

    struct LoginRequest: Encodable {
        let email: String
        let password: String
    }

    struct AuthResponse: Decodable {
        let token: String
        let user: UserProfile
    }

    func login(email: String, password: String) async throws -> AuthResponse {
        try await request(method: "POST", path: "/api/auth/login", body: LoginRequest(email: email, password: password))
    }

    // MARK: - Words / Library

    struct LibraryResponse: Decodable {
        let words: [Word]
        let total: Int
        let page: Int
        let pageSize: Int
    }

    func fetchLibrary(keyword: String? = nil, status: String? = nil, page: Int = 1) async throws -> LibraryResponse {
        var items: [URLQueryItem] = [
            URLQueryItem(name: "page", value: "\(page)"),
            URLQueryItem(name: "pageSize", value: "20"),
        ]
        if let keyword, !keyword.isEmpty {
            items.append(URLQueryItem(name: "keyword", value: keyword))
        }
        if let status, status != "all" {
            items.append(URLQueryItem(name: "status", value: status))
        }
        return try await request(method: "GET", path: "/api/library", queryItems: items)
    }

    struct CreateWordRequest: Encodable {
        let text: String
        let language: String
        let note: String?
    }

    struct CreateWordResponse: Decodable {
        let word: Word
    }

    func createWord(text: String, language: String = "en", note: String? = nil) async throws -> CreateWordResponse {
        try await request(method: "POST", path: "/api/library/words", body: CreateWordRequest(text: text, language: language, note: note))
    }

    func deleteWord(wordId: String) async throws -> EmptyResponse {
        try await request(method: "DELETE", path: "/api/library/words/\(wordId)")
    }

    func togglePriority(wordId: String, isPriority: Bool) async throws -> EmptyResponse {
        try await request(method: "PATCH", path: "/api/library/words/\(wordId)", body: ["isPriority": isPriority])
    }

    func fetchWordDetail(wordId: String) async throws -> Word {
        try await request(method: "GET", path: "/api/library/words/\(wordId)")
    }

    func fetchWordLogs(wordId: String) async throws -> [ReviewLog] {
        try await request(method: "GET", path: "/api/library/words/\(wordId)/logs")
    }

    // MARK: - Dictionary

    struct DictMeaningResponse: Decodable {
        let entry: DictionaryEntry?
        let disabled: Bool?
    }

    func lookupMeaning(headword: String) async throws -> DictMeaningResponse {
        try await request(method: "GET", path: "/api/dict/meaning", queryItems: [
            URLQueryItem(name: "headword", value: headword)
        ])
    }

    // MARK: - Rounds

    struct RoundsResponse: Decodable {
        let rounds: [StudyRound]
    }

    func fetchRounds() async throws -> RoundsResponse {
        try await request(method: "GET", path: "/api/rounds")
    }

    struct CreateRoundRequest: Encodable {
        let name: String
        let wordIds: [String]
    }

    struct CreateRoundResponse: Decodable {
        let round: StudyRound
    }

    func createRound(name: String, wordIds: [String]) async throws -> CreateRoundResponse {
        try await request(method: "POST", path: "/api/rounds", body: CreateRoundRequest(name: name, wordIds: wordIds))
    }

    func fetchRoundDetail(roundId: String) async throws -> StudyRound {
        try await request(method: "GET", path: "/api/rounds/\(roundId)")
    }

    func deleteRound(roundId: String) async throws -> EmptyResponse {
        try await request(method: "DELETE", path: "/api/rounds/\(roundId)")
    }

    func updateRoundStatus(roundId: String, status: String) async throws -> EmptyResponse {
        try await request(method: "PATCH", path: "/api/rounds/\(roundId)", body: ["status": status])
    }

    // MARK: - Sessions

    struct StartSessionRequest: Encodable {
        let roundId: String
        let type: String
        let count: Int?
    }

    struct StartSessionResponse: Decodable {
        let session: StudySession
    }

    func startSession(roundId: String, type: SessionType, count: Int? = nil) async throws -> StartSessionResponse {
        try await request(method: "POST", path: "/api/sessions", body: StartSessionRequest(
            roundId: roundId, type: type.rawValue, count: count
        ))
    }

    func fetchSession(sessionId: String) async throws -> StudySession {
        try await request(method: "GET", path: "/api/sessions/\(sessionId)")
    }

    struct SaveProgressRequest: Encodable {
        let results: [SessionResult]
    }

    func saveSessionProgress(sessionId: String, results: [SessionResult]) async throws -> EmptyResponse {
        try await request(method: "PATCH", path: "/api/sessions/\(sessionId)/progress", body: SaveProgressRequest(results: results))
    }

    struct FinishSessionRequest: Encodable {
        let results: [SessionResult]
    }

    struct FinishSessionResponse: Decodable {
        let session: StudySession
        let masteryUpdates: [MasteryUpdate]?
    }

    struct MasteryUpdate: Decodable {
        let wordId: String
        let newStatus: String
    }

    func finishSession(sessionId: String, results: [SessionResult]) async throws -> FinishSessionResponse {
        try await request(method: "POST", path: "/api/sessions/\(sessionId)/finish", body: FinishSessionRequest(results: results))
    }

    // MARK: - Stats

    func fetchStats() async throws -> StatsOverview {
        try await request(method: "GET", path: "/api/stats")
    }

    // MARK: - Settings

    func fetchSettings() async throws -> StudySettings {
        try await request(method: "GET", path: "/api/settings")
    }

    struct UpdateSettingsRequest: Encodable {
        let sessionSize: Int?
        let freezeRounds: Int?
        let autoPlayAudio: Bool?
        let requireConsecutiveKnown: Bool?
    }

    func updateSettings(_ settings: UpdateSettingsRequest) async throws -> StudySettings {
        try await request(method: "PATCH", path: "/api/settings", body: settings)
    }

    func fetchProfile() async throws -> UserProfile {
        try await request(method: "GET", path: "/api/profile")
    }

    // MARK: - Today

    struct TodayResponse: Decodable {
        let wordsReviewedToday: Int
        let activeRound: StudyRound?
        let recentRounds: [StudyRound]
    }

    func fetchToday() async throws -> TodayResponse {
        try await request(method: "GET", path: "/api/today")
    }

    func signOut() async throws -> EmptyResponse {
        try await request(method: "POST", path: "/api/auth/signout")
    }

    func resetProgress() async throws -> EmptyResponse {
        try await request(method: "POST", path: "/api/settings/reset")
    }
}

struct EmptyResponse: Decodable {}
