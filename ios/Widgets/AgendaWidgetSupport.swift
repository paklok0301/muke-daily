import Foundation
import WidgetKit

struct AgendaWidgetEntry: TimelineEntry {
    let date: Date
    let agenda: [AgendaEntry]
    let todos: [AgendaEntry]

    var allItems: [AgendaEntry] {
        (agenda + todos).sorted(by: AgendaWidgetEntry.sortEntries)
    }

    static func sortEntries(_ lhs: AgendaEntry, _ rhs: AgendaEntry) -> Bool {
        switch (lhs.start, rhs.start) {
        case let (.some(left), .some(right)) where left != right:
            return left < right
        case (.some, .none):
            return true
        case (.none, .some):
            return false
        default:
            return lhs.title.localizedStandardCompare(rhs.title) == .orderedAscending
        }
    }
}

struct AgendaTimelineProvider: TimelineProvider {
    private let store = SharedScheduleStore(suiteName: AppGroup.identifier)
    private let builder = AgendaBuilder()

    func placeholder(in context: Context) -> AgendaWidgetEntry {
        let now = Date()
        return makeEntry(for: now, data: .empty)
    }

    func getSnapshot(in context: Context, completion: @escaping (AgendaWidgetEntry) -> Void) {
        completion(makeEntry(for: Date(), data: store.load()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<AgendaWidgetEntry>) -> Void) {
        let now = Date()
        let entry = makeEntry(for: now, data: store.load())
        let calendar = Calendar.autoupdatingCurrent
        let midnight = calendar.startOfDay(for: now)
        let nextDay = calendar.date(byAdding: .day, value: 1, to: midnight) ?? now.addingTimeInterval(3_600)
        let quarterHour = now.addingTimeInterval(15 * 60)
        completion(Timeline(entries: [entry], policy: .after(min(nextDay, quarterHour))))
    }

    private func makeEntry(for date: Date, data: MukeData) -> AgendaWidgetEntry {
        let entries = builder.entries(on: date, from: data)
        let agenda = entries
            .filter { $0.kind != .task }
            .sorted(by: AgendaWidgetEntry.sortEntries)
        let todos = builder.pendingTasks(from: data)
            .sorted(by: AgendaWidgetEntry.sortEntries)
        return AgendaWidgetEntry(date: date, agenda: agenda, todos: todos)
    }
}

extension AgendaEntry {
    var widgetTimeText: String {
        guard let start else { return isAllDay ? "全日" : "" }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "zh_Hant_HK")
        formatter.timeZone = .autoupdatingCurrent
        formatter.dateFormat = "HH:mm"

        guard let end else { return formatter.string(from: start) }
        return "\(formatter.string(from: start))–\(formatter.string(from: end))"
    }

    var widgetSubtitleText: String {
        [widgetTimeText, subtitle ?? ""]
            .filter { !$0.isEmpty }
            .joined(separator: " · ")
    }
}
