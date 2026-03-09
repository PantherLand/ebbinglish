import SwiftUI

struct MainTabView: View {
    @EnvironmentObject var appState: AppState

    var body: some View {
        TabView(selection: $appState.selectedTab) {
            TodayView()
                .tabItem {
                    Label("Today", systemImage: appState.selectedTab == .today
                          ? AppState.AppTab.today.selectedIcon
                          : AppState.AppTab.today.icon)
                }
                .tag(AppState.AppTab.today)

            NavigationStack {
                RoundsView()
            }
            .tabItem {
                Label("Rounds", systemImage: appState.selectedTab == .rounds
                      ? AppState.AppTab.rounds.selectedIcon
                      : AppState.AppTab.rounds.icon)
            }
            .tag(AppState.AppTab.rounds)

            LibraryView()
                .tabItem {
                    Label("Library", systemImage: appState.selectedTab == .library
                          ? AppState.AppTab.library.selectedIcon
                          : AppState.AppTab.library.icon)
                }
                .tag(AppState.AppTab.library)

            StatsView()
                .tabItem {
                    Label("Stats", systemImage: appState.selectedTab == .stats
                          ? AppState.AppTab.stats.selectedIcon
                          : AppState.AppTab.stats.icon)
                }
                .tag(AppState.AppTab.stats)

            SettingsView()
                .tabItem {
                    Label("Settings", systemImage: appState.selectedTab == .settings
                          ? AppState.AppTab.settings.selectedIcon
                          : AppState.AppTab.settings.icon)
                }
                .tag(AppState.AppTab.settings)
        }
        .tint(.blue)
    }
}
