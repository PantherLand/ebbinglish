import SwiftUI

struct RoundCard: View {
    let round: StudyRound
    var showStatus = true

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text(round.displayName)
                    .font(.headline)
                    .fontWeight(.semibold)

                Spacer()

                if showStatus {
                    RoundStatusBadge(status: round.status)
                }
            }

            ProgressBar(
                progress: round.progress,
                color: round.status == .completed ? .green : .blue.opacity(0.4)
            )

            HStack {
                Text("\(round.masteredCount) mastered")
                    .font(.caption)
                    .foregroundColor(.secondary)
                Spacer()
                Text("\(round.totalCount) total")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .padding(16)
        .background(Color(.systemBackground))
        .cornerRadius(12)
        .shadow(color: .black.opacity(0.05), radius: 4, y: 2)
    }
}
