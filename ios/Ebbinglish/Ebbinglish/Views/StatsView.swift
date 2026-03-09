import SwiftUI

struct StatsView: View {
    @StateObject private var viewModel = StatsViewModel()

    var body: some View {
        NavigationStack {
            ScrollView {
                if let stats = viewModel.stats {
                    VStack(spacing: 20) {
                        // Summary Cards
                        summaryCards(stats)

                        // Review Activity Heatmap
                        reviewActivityCard(stats)

                        // Mastery Distribution
                        masteryDistributionCard(stats)
                    }
                    .padding(16)
                } else if viewModel.isLoading {
                    ProgressView()
                        .padding(.top, 100)
                } else {
                    ContentUnavailableView(
                        "No Stats Yet",
                        systemImage: "chart.bar",
                        description: Text("Complete some review sessions to see your stats")
                    )
                }
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("Stats")
            .refreshable {
                await viewModel.load()
            }
            .task {
                await viewModel.load()
            }
        }
    }

    // MARK: - Summary Cards
    private func summaryCards(_ stats: StatsOverview) -> some View {
        HStack(spacing: 12) {
            StatCard(
                value: "\(stats.totalWords)",
                label: "TOTAL",
                color: .primary
            )
            StatCard(
                value: "\(stats.masteredWords)",
                label: "MASTERED",
                color: .green
            )
            StatCard(
                value: "\(stats.totalSessions)",
                label: "SESSIONS",
                color: .blue
            )
        }
    }

    // MARK: - Review Activity
    private func reviewActivityCard(_ stats: StatsOverview) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Review Activity")
                .font(.title3)
                .fontWeight(.bold)

            // Legend
            HStack(spacing: 4) {
                Text("Less")
                    .font(.caption2)
                    .foregroundColor(.secondary)
                ForEach(0..<5) { i in
                    RoundedRectangle(cornerRadius: 2)
                        .fill(heatmapColor(intensity: i))
                        .frame(width: 12, height: 12)
                }
                Text("More")
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }

            // Heatmap Grid
            if !stats.heatmap.isEmpty {
                HeatmapView(heatmap: stats.heatmap)
            }
        }
        .padding(16)
        .background(Color(.systemBackground))
        .cornerRadius(12)
    }

    // MARK: - Mastery Distribution
    private func masteryDistributionCard(_ stats: StatsOverview) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Mastery Distribution")
                .font(.title3)
                .fontWeight(.bold)

            // Donut chart representation
            DonutChartView(distribution: stats.masteryDistribution)
                .frame(height: 220)
        }
        .padding(16)
        .background(Color(.systemBackground))
        .cornerRadius(12)
    }

    private func heatmapColor(intensity: Int) -> Color {
        switch intensity {
        case 0: return Color(.systemGray5)
        case 1: return .green.opacity(0.25)
        case 2: return .green.opacity(0.5)
        case 3: return .green.opacity(0.75)
        default: return .green
        }
    }
}

// MARK: - Stat Card
struct StatCard: View {
    let value: String
    let label: String
    let color: Color

    var body: some View {
        VStack(spacing: 6) {
            Text(value)
                .font(.title)
                .fontWeight(.bold)
                .foregroundColor(color)
            Text(label)
                .font(.caption)
                .foregroundColor(.secondary)
                .fontWeight(.medium)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 16)
        .background(Color(.systemBackground))
        .cornerRadius(12)
        .shadow(color: .black.opacity(0.03), radius: 2, y: 1)
    }
}

// MARK: - Heatmap View
struct HeatmapView: View {
    let heatmap: [[HeatmapCell]]
    let dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

    var body: some View {
        HStack(alignment: .top, spacing: 2) {
            // Day labels
            VStack(spacing: 2) {
                ForEach(dayLabels, id: \.self) { label in
                    Text(label)
                        .font(.system(size: 8))
                        .foregroundColor(.secondary)
                        .frame(height: 12)
                }
            }

            // Heatmap cells
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 2) {
                    ForEach(Array(heatmap.enumerated()), id: \.offset) { weekIdx, week in
                        VStack(spacing: 2) {
                            ForEach(Array(week.enumerated()), id: \.offset) { dayIdx, cell in
                                RoundedRectangle(cornerRadius: 2)
                                    .fill(cellColor(cell.intensity))
                                    .frame(width: 12, height: 12)
                            }
                        }
                    }
                }
            }
        }
    }

    private func cellColor(_ intensity: Int) -> Color {
        switch intensity {
        case 0: return Color(.systemGray5)
        case 1: return .green.opacity(0.25)
        case 2: return .green.opacity(0.5)
        case 3: return .green.opacity(0.75)
        default: return .green
        }
    }
}

// MARK: - Donut Chart
struct DonutChartView: View {
    let distribution: MasteryDistribution

    var total: Double {
        Double(distribution.new + distribution.learning + distribution.mastered)
    }

    var segments: [(color: Color, value: Double, label: String)] {
        guard total > 0 else { return [] }
        return [
            (.orange, Double(distribution.learning) / total, "Learning"),
            (.green, Double(distribution.mastered) / total, "Mastered"),
            (.gray.opacity(0.4), Double(distribution.new) / total, "New"),
        ].filter { $0.value > 0 }
    }

    var body: some View {
        VStack {
            ZStack {
                ForEach(Array(segmentAngles.enumerated()), id: \.offset) { _, segment in
                    DonutSegment(
                        startAngle: segment.start,
                        endAngle: segment.end,
                        color: segment.color
                    )
                }
                Circle()
                    .fill(Color(.systemBackground))
                    .frame(width: 100, height: 100)
            }
            .frame(width: 180, height: 180)

            // Legend
            HStack(spacing: 16) {
                ForEach(segments.indices, id: \.self) { idx in
                    HStack(spacing: 4) {
                        Circle()
                            .fill(segments[idx].color)
                            .frame(width: 8, height: 8)
                        Text(segments[idx].label)
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
            }
        }
    }

    private var segmentAngles: [(start: Angle, end: Angle, color: Color)] {
        var angles: [(start: Angle, end: Angle, color: Color)] = []
        var currentAngle: Double = -90
        for segment in segments {
            let sweep = segment.value * 360
            angles.append((
                start: .degrees(currentAngle),
                end: .degrees(currentAngle + sweep),
                color: segment.color
            ))
            currentAngle += sweep
        }
        return angles
    }
}

struct DonutSegment: Shape {
    let startAngle: Angle
    let endAngle: Angle
    let color: Color

    func path(in rect: CGRect) -> Path {
        var path = Path()
        let center = CGPoint(x: rect.midX, y: rect.midY)
        let outerRadius = min(rect.width, rect.height) / 2
        let innerRadius = outerRadius * 0.55

        path.addArc(center: center, radius: outerRadius, startAngle: startAngle, endAngle: endAngle, clockwise: false)
        path.addArc(center: center, radius: innerRadius, startAngle: endAngle, endAngle: startAngle, clockwise: true)
        path.closeSubpath()

        return path
    }
}

extension DonutSegment: View {
    var body: some View {
        self.fill(color)
    }
}
