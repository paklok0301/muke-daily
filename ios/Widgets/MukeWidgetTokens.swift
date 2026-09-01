import SwiftUI

enum MukeWidgetTokens {
    static let ink = Color(red: 7 / 255, green: 8 / 255, blue: 10 / 255)
    static let panel = Color(red: 18 / 255, green: 20 / 255, blue: 24 / 255)
    static let ivory = Color(red: 247 / 255, green: 242 / 255, blue: 232 / 255)
    static let muted = Color(red: 158 / 255, green: 155 / 255, blue: 146 / 255)
    static let divider = Color.white.opacity(0.12)

    static let plan = Color(red: 246 / 255, green: 180 / 255, blue: 75 / 255)
    static let recurringClass = Color(red: 90 / 255, green: 169 / 255, blue: 1)
    static let assignment = Color(red: 1, green: 107 / 255, blue: 129 / 255)
    static let shift = Color(red: 182 / 255, green: 135 / 255, blue: 1)
    static let workout = Color(red: 1, green: 143 / 255, blue: 86 / 255)
    static let task = Color(red: 106 / 255, green: 214 / 255, blue: 155 / 255)

    static func categoryColor(for entry: AgendaEntry) -> Color {
        if let custom = Color(hex: entry.colorHex) {
            return custom
        }

        switch entry.kind {
        case .plan: plan
        case .recurringClass: recurringClass
        case .assignment: assignment
        case .shift: shift
        case .workout: workout
        case .task: task
        }
    }
}

extension Color {
    init?(hex: String) {
        var value = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        if value.hasPrefix("#") { value.removeFirst() }
        guard value.count == 6, let rgb = UInt64(value, radix: 16) else { return nil }

        self.init(
            red: Double((rgb >> 16) & 0xFF) / 255,
            green: Double((rgb >> 8) & 0xFF) / 255,
            blue: Double(rgb & 0xFF) / 255
        )
    }
}
