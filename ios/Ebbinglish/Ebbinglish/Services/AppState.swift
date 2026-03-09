import Foundation

@MainActor
class AppState: ObservableObject {
    static let shared = AppState()

    @Published var selectedTab: AppTab = .today

    enum AppTab: Int, CaseIterable {
        case today = 0
        case rounds
        case library
        case stats
        case settings

        var title: String {
            switch self {
            case .today: return "Today"
            case .rounds: return "Rounds"
            case .library: return "Library"
            case .stats: return "Stats"
            case .settings: return "Settings"
            }
        }

        var icon: String {
            switch self {
            case .today: return "calendar"
            case .rounds: return "square.grid.2x2"
            case .library: return "book"
            case .stats: return "chart.bar"
            case .settings: return "gearshape"
            }
        }

        var selectedIcon: String {
            switch self {
            case .today: return "calendar.fill"
            case .rounds: return "square.grid.2x2.fill"
            case .library: return "book.fill"
            case .stats: return "chart.bar.fill"
            case .settings: return "gearshape.fill"
            }
        }
    }
}
