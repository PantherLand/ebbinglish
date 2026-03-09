import SwiftUI

struct StatusBadge: View {
    let status: WordStatus

    var backgroundColor: Color {
        switch status {
        case .new: return .blue.opacity(0.15)
        case .seen: return .orange.opacity(0.15)
        case .unknown: return .red.opacity(0.15)
        case .fuzzy: return .yellow.opacity(0.15)
        case .known: return .green.opacity(0.15)
        case .frozen: return .cyan.opacity(0.15)
        case .mastered: return .green.opacity(0.15)
        }
    }

    var textColor: Color {
        switch status {
        case .new: return .blue
        case .seen: return .orange
        case .unknown: return .red
        case .fuzzy: return .yellow.opacity(0.8)
        case .known: return .green
        case .frozen: return .cyan
        case .mastered: return .green
        }
    }

    var body: some View {
        Text(status.displayName)
            .font(.caption2)
            .fontWeight(.semibold)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(backgroundColor)
            .foregroundColor(textColor)
            .cornerRadius(4)
    }
}

struct RoundStatusBadge: View {
    let status: RoundStatus

    var body: some View {
        Text(status.rawValue.uppercased())
            .font(.caption2)
            .fontWeight(.semibold)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(status == .active ? Color.blue.opacity(0.15) : Color.gray.opacity(0.15))
            .foregroundColor(status == .active ? .blue : .gray)
            .cornerRadius(4)
    }
}

struct ProgressBar: View {
    let progress: Double
    var color: Color = .green
    var height: CGFloat = 6

    var body: some View {
        GeometryReader { geometry in
            ZStack(alignment: .leading) {
                RoundedRectangle(cornerRadius: height / 2)
                    .fill(Color(.systemGray5))
                    .frame(height: height)

                RoundedRectangle(cornerRadius: height / 2)
                    .fill(color)
                    .frame(width: max(0, geometry.size.width * progress), height: height)
            }
        }
        .frame(height: height)
    }
}
