import ActivityKit
import Foundation
import WidgetKit

@MainActor
public final class LiveActivityService: LiveActivityRefreshing {
    public static let shared = LiveActivityService()

    public init() {}

    public func refresh(using data: MukeData) async {
        await Self.refresh(with: data)
    }

    public static func refresh(with data: MukeData) async {
        WidgetCenter.shared.reloadAllTimelines()

        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }

        let now = Date()
        let builder = AgendaBuilder()
        let agenda = builder.entries(on: now, from: data)
            .filter { $0.kind != .task }
            .sorted(by: sortEntries)
        let todos = builder.pendingTasks(from: data)
            .sorted(by: sortEntries)

        guard !agenda.isEmpty || !todos.isEmpty else {
            await endAll()
            return
        }

        let state = DailyAgendaAttributes.ContentState(
            updatedAt: now,
            agenda: agenda.prefix(3).map(makeDisplayItem),
            todos: todos.prefix(2).map(makeDisplayItem),
            agendaTotalCount: agenda.count,
            todoTotalCount: todos.count
        )
        let content = ActivityContent(
            state: state,
            staleDate: Calendar.autoupdatingCurrent.date(byAdding: .hour, value: 2, to: now)
        )

        if let current = Activity<DailyAgendaAttributes>.activities.first {
            await current.update(content)
            for duplicate in Activity<DailyAgendaAttributes>.activities.dropFirst() {
                await duplicate.end(nil, dismissalPolicy: .immediate)
            }
            return
        }

        let attributes = DailyAgendaAttributes(dateKey: dateKey(for: now))
        do {
            _ = try Activity.request(attributes: attributes, content: content, pushType: nil)
        } catch {
            // Live Activities are optional; widgets and scheduled notifications continue to work.
        }
    }

    public static func endAll() async {
        for activity in Activity<DailyAgendaAttributes>.activities {
            await activity.end(nil, dismissalPolicy: .immediate)
        }
    }

    private static func makeDisplayItem(_ entry: AgendaEntry) -> DailyAgendaAttributes.DisplayItem {
        DailyAgendaAttributes.DisplayItem(
            id: entry.id,
            title: entry.title,
            subtitle: entry.subtitle ?? "",
            time: timeText(for: entry),
            kind: entry.kind.rawValue,
            colorHex: entry.colorHex,
            emoji: entry.emoji
        )
    }

    private static func timeText(for entry: AgendaEntry) -> String {
        guard let start = entry.start else { return entry.isAllDay ? "全日" : "" }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "zh_Hant_HK")
        formatter.timeZone = .autoupdatingCurrent
        formatter.dateFormat = "HH:mm"

        guard let end = entry.end else { return formatter.string(from: start) }
        return "\(formatter.string(from: start))–\(formatter.string(from: end))"
    }

    private static func sortEntries(_ lhs: AgendaEntry, _ rhs: AgendaEntry) -> Bool {
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

    private static func dateKey(for date: Date) -> String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = .autoupdatingCurrent
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: date)
    }
}
