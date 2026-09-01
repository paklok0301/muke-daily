import Foundation
@preconcurrency import EventKit
import CoreGraphics

public struct CalendarSyncResult: Sendable, Equatable {
    public let created: Int
    public let updated: Int
    public let deleted: Int
    public let calendarIdentifier: String

    public var summary: String {
        "行事曆已同步：新增 \(created)、更新 \(updated)、移除 \(deleted)"
    }
}

public enum CalendarSyncError: LocalizedError, Sendable {
    case accessDenied
    case calendarSourceUnavailable
    case invalidDate(kind: String, identifier: String)

    public var errorDescription: String? {
        switch self {
        case .accessDenied:
            return "未取得行事曆完整存取權，請到「設定」允許暮刻存取行事曆。"
        case .calendarSourceUnavailable:
            return "找不到可用的 iPhone 行事曆帳戶。"
        case let .invalidDate(kind, identifier):
            return "\(kind)（\(identifier)）的日期或時間格式不正確。"
        }
    }
}

/// Owns every EventKit operation for the app. EventKit objects stay on the main actor,
/// which avoids passing non-Sendable framework instances across concurrency domains.
@MainActor
public final class CalendarSyncService {
    public static let calendarTitle = "暮刻"

    private static let calendarIdentifierDefaultsKey = "muke.eventkit.calendar-identifier.v1"
    private static let eventIdentifierDefaultsKey = "muke.eventkit.event-identifiers.v1"
    private static let notesMarkerPrefix = "MUKÉ-MANAGED-ID:"

    private let eventStore: EKEventStore
    private let defaults: UserDefaults

    public init(
        eventStore: EKEventStore = EKEventStore(),
        suiteName: String = AppGroup.identifier
    ) {
        self.eventStore = eventStore
        self.defaults = UserDefaults(suiteName: suiteName) ?? .standard
    }

    public var hasFullAccess: Bool {
        EKEventStore.authorizationStatus(for: .event) == .fullAccess
    }

    /// iOS 17's full-access permission is required so the app can reconcile edits and deletes.
    @discardableResult
    public func requestFullAccess() async throws -> Bool {
        switch EKEventStore.authorizationStatus(for: .event) {
        case .fullAccess:
            return true
        case .notDetermined, .writeOnly:
            return try await eventStore.requestFullAccessToEvents()
        case .denied, .restricted:
            return false
        @unknown default:
            return false
        }
    }

    /// Reconciles the dedicated calendar against the current snapshot. The stable marker in
    /// `notes` is the source of truth; EventKit event identifiers are only an optimization.
    public func synchronize(_ data: MukeData) async throws -> CalendarSyncResult {
        guard hasFullAccess else { throw CalendarSyncError.accessDenied }

        let calendar = try dedicatedCalendar()
        let desired = try eventSpecifications(from: data)
        var savedIdentifiers = storedEventIdentifiers()
        var indexedEvents = indexExistingEvents(
            calendar: calendar,
            desired: desired,
            savedIdentifiers: savedIdentifiers
        )

        var created = 0
        var updated = 0
        var deleted = 0

        for specification in desired.values.sorted(by: { $0.marker < $1.marker }) {
            let event = indexedEvents.removeValue(forKey: specification.marker) ?? EKEvent(eventStore: eventStore)
            let isNew = event.calendar == nil
            apply(specification, to: event, calendar: calendar)
            try eventStore.save(
                event,
                span: isNew || specification.recurrenceRule == nil ? .thisEvent : .futureEvents,
                commit: false
            )
            if let identifier = event.eventIdentifier {
                savedIdentifiers[specification.marker] = identifier
            }
            if isNew { created += 1 } else { updated += 1 }
        }

        // Anything left in the app-owned calendar was removed from the current snapshot.
        for (marker, event) in indexedEvents {
            try eventStore.remove(
                event,
                span: event.hasRecurrenceRules ? .futureEvents : .thisEvent,
                commit: false
            )
            savedIdentifiers.removeValue(forKey: marker)
            deleted += 1
        }

        // Remove stale events that are outside the scan window but still have a saved EventKit ID.
        for marker in Set(savedIdentifiers.keys).subtracting(desired.keys) {
            if let identifier = savedIdentifiers[marker],
               let event = eventStore.event(withIdentifier: identifier),
               event.calendar.calendarIdentifier == calendar.calendarIdentifier {
                try eventStore.remove(
                    event,
                    span: event.hasRecurrenceRules ? .futureEvents : .thisEvent,
                    commit: false
                )
                deleted += 1
            }
            savedIdentifiers.removeValue(forKey: marker)
        }

        try eventStore.commit()
        defaults.set(savedIdentifiers, forKey: Self.eventIdentifierDefaultsKey)

        return CalendarSyncResult(
            created: created,
            updated: updated,
            deleted: deleted,
            calendarIdentifier: calendar.calendarIdentifier
        )
    }
}

private extension CalendarSyncService {
    struct EventSpecification {
        let marker: String
        let title: String
        let start: Date
        let end: Date
        let location: String?
        let notes: String
        let alarmOffset: TimeInterval?
        let recurrenceRule: EKRecurrenceRule?
    }

    func dedicatedCalendar() throws -> EKCalendar {
        if let identifier = defaults.string(forKey: Self.calendarIdentifierDefaultsKey),
           let calendar = eventStore.calendar(withIdentifier: identifier) {
            return calendar
        }

        if let calendar = eventStore.calendars(for: .event).first(where: { $0.title == Self.calendarTitle }) {
            defaults.set(calendar.calendarIdentifier, forKey: Self.calendarIdentifierDefaultsKey)
            return calendar
        }

        guard let source = eventStore.defaultCalendarForNewEvents?.source
            ?? eventStore.sources.first(where: { $0.sourceType == .calDAV })
            ?? eventStore.sources.first(where: { $0.sourceType == .local })
        else {
            throw CalendarSyncError.calendarSourceUnavailable
        }

        let calendar = EKCalendar(for: .event, eventStore: eventStore)
        calendar.title = Self.calendarTitle
        calendar.source = source
        calendar.cgColor = CGColor(red: 0.62, green: 0.24, blue: 0.29, alpha: 1)
        try eventStore.saveCalendar(calendar, commit: true)
        defaults.set(calendar.calendarIdentifier, forKey: Self.calendarIdentifierDefaultsKey)
        return calendar
    }

    func eventSpecifications(from data: MukeData) throws -> [String: EventSpecification] {
        var result: [String: EventSpecification] = [:]

        for plan in data.plans where !plan.done {
            guard let start = HongKongDate.dateTime(dateKey: plan.date, time: plan.time) else {
                throw CalendarSyncError.invalidDate(kind: "活動", identifier: plan.id)
            }
            let marker = marker(kind: "plan", id: plan.id)
            result[marker] = EventSpecification(
                marker: marker,
                title: "\(plan.emoji ?? "📌") \(plan.activity)",
                start: start,
                end: start.addingTimeInterval(60 * 60),
                location: nil,
                notes: managedNotes(marker: marker, detail: "由暮刻的「新增活動」同步"),
                alarmOffset: dayAlarmOffset(plan.reminderDays ?? data.scheduleReminderDays),
                recurrenceRule: nil
            )
        }

        for item in data.classes {
            guard let firstDate = firstOccurrence(of: item),
                  let start = HongKongDate.dateTime(
                    dateKey: HongKongDate.dateKey(for: firstDate),
                    time: item.startTime
                  ),
                  var end = HongKongDate.dateTime(
                    dateKey: HongKongDate.dateKey(for: firstDate),
                    time: item.endTime
                  ),
                  let finalDate = HongKongDate.date(from: item.endDate)
            else {
                throw CalendarSyncError.invalidDate(kind: "課堂", identifier: item.id)
            }
            if end <= start { end = end.addingTimeInterval(24 * 60 * 60) }

            let marker = marker(kind: "class", id: item.id)
            let recurrenceEndDate = HongKongDate.calendar.date(
                bySettingHour: 23,
                minute: 59,
                second: 59,
                of: finalDate
            ) ?? finalDate
            let weekDay = EKWeekday(rawValue: item.weekday + 1) ?? .monday
            let recurrence = EKRecurrenceRule(
                recurrenceWith: .weekly,
                interval: 1,
                daysOfTheWeek: [EKRecurrenceDayOfWeek(weekDay)],
                daysOfTheMonth: nil,
                monthsOfTheYear: nil,
                weeksOfTheYear: nil,
                daysOfTheYear: nil,
                setPositions: nil,
                end: EKRecurrenceEnd(end: recurrenceEndDate)
            )
            result[marker] = EventSpecification(
                marker: marker,
                title: "\(item.emoji) \(item.name)",
                start: start,
                end: end,
                location: item.location,
                notes: managedNotes(marker: marker, detail: "由暮刻的「每週課堂」同步"),
                alarmOffset: dayAlarmOffset(data.scheduleReminderDays),
                recurrenceRule: recurrence
            )
        }

        for assignment in data.assignments where !assignment.done {
            guard let due = HongKongDate.dateTime(dateKey: assignment.dueDate, time: assignment.dueTime) else {
                throw CalendarSyncError.invalidDate(kind: "功課", identifier: assignment.id)
            }
            let marker = marker(kind: "assignment", id: assignment.id)
            result[marker] = EventSpecification(
                marker: marker,
                title: "\(assignment.emoji) \(assignment.course) · \(assignment.title)",
                start: due,
                end: due.addingTimeInterval(30 * 60),
                location: nil,
                notes: managedNotes(marker: marker, detail: "由暮刻的「功課死線」同步"),
                alarmOffset: dayAlarmOffset(data.assignmentReminderDays),
                recurrenceRule: nil
            )
        }

        let jobs = Dictionary(uniqueKeysWithValues: data.jobs.map { ($0.id, $0) })
        for shift in data.shifts {
            guard let start = HongKongDate.dateTime(dateKey: shift.date, time: shift.start),
                  var end = HongKongDate.dateTime(dateKey: shift.date, time: shift.end)
            else {
                throw CalendarSyncError.invalidDate(kind: "工作", identifier: shift.id)
            }
            if end <= start { end = end.addingTimeInterval(24 * 60 * 60) }
            let job = jobs[shift.jobId]
            let jobName = shift.jobName ?? job?.name ?? "兼職"
            let marker = marker(kind: "shift", id: shift.id)
            let detail = shift.sessions.map { "\($0) 節" }
            result[marker] = EventSpecification(
                marker: marker,
                title: "💼 \(jobName)",
                start: start,
                end: end,
                location: shift.location,
                notes: managedNotes(marker: marker, detail: detail ?? "由暮刻的「公事」同步"),
                alarmOffset: dayAlarmOffset(data.scheduleReminderDays),
                recurrenceRule: nil
            )
        }

        return result
    }

    func firstOccurrence(of item: RecurringClass) -> Date? {
        guard var date = HongKongDate.date(from: item.startDate) else { return nil }
        for _ in 0..<7 {
            if HongKongDate.calendar.component(.weekday, from: date) - 1 == item.weekday {
                return HongKongDate.dateKey(for: date) <= item.endDate ? date : nil
            }
            guard let next = HongKongDate.addingDays(1, to: date) else { return nil }
            date = next
        }
        return nil
    }

    func apply(_ specification: EventSpecification, to event: EKEvent, calendar: EKCalendar) {
        event.calendar = calendar
        event.title = specification.title
        event.startDate = specification.start
        event.endDate = specification.end
        event.location = specification.location
        event.notes = specification.notes
        event.isAllDay = false
        event.availability = .busy
        event.alarms = specification.alarmOffset.map { [EKAlarm(relativeOffset: $0)] } ?? []
        event.recurrenceRules = specification.recurrenceRule.map { [$0] }
    }

    func indexExistingEvents(
        calendar: EKCalendar,
        desired: [String: EventSpecification],
        savedIdentifiers: [String: String]
    ) -> [String: EKEvent] {
        var indexed: [String: EKEvent] = [:]

        for (marker, identifier) in savedIdentifiers {
            guard let event = eventStore.event(withIdentifier: identifier),
                  event.calendar.calendarIdentifier == calendar.calendarIdentifier
            else { continue }
            indexed[marker] = event
        }

        let desiredDates = desired.values.flatMap { [$0.start, $0.end] }
        let now = Date()
        let earliest = desiredDates.min() ?? now
        let latest = desiredDates.max() ?? now
        let scanStart = HongKongDate.calendar.date(byAdding: .year, value: -2, to: min(earliest, now))
            ?? earliest.addingTimeInterval(-2 * 365 * 24 * 60 * 60)
        let scanEnd = HongKongDate.calendar.date(byAdding: .year, value: 3, to: max(latest, now))
            ?? latest.addingTimeInterval(3 * 365 * 24 * 60 * 60)

        // EventKit performs best with bounded predicates. Two-year windows also make recurring
        // occurrences discoverable without asking the store for a decades-long range.
        var windowStart = scanStart
        while windowStart < scanEnd {
            let windowEnd = min(
                HongKongDate.calendar.date(byAdding: .year, value: 2, to: windowStart) ?? scanEnd,
                scanEnd
            )
            let predicate = eventStore.predicateForEvents(
                withStart: windowStart,
                end: windowEnd,
                calendars: [calendar]
            )
            for event in eventStore.events(matching: predicate) {
                guard let marker = marker(in: event.notes) else { continue }
                // Recurrence searches return occurrences. Prefer the earliest one so `.futureEvents`
                // consistently edits or removes the entire app-managed series.
                if let existing = indexed[marker], existing.startDate <= event.startDate { continue }
                indexed[marker] = event
            }
            guard windowEnd > windowStart else { break }
            windowStart = windowEnd
        }
        return indexed
    }

    func storedEventIdentifiers() -> [String: String] {
        defaults.dictionary(forKey: Self.eventIdentifierDefaultsKey) as? [String: String] ?? [:]
    }

    func marker(kind: String, id: String) -> String {
        "\(kind):\(id)"
    }

    func managedNotes(marker: String, detail: String) -> String {
        "\(Self.notesMarkerPrefix)\(marker)\n\(detail)\n請在暮刻內修改這項安排。"
    }

    func marker(in notes: String?) -> String? {
        guard let line = notes?.split(separator: "\n", maxSplits: 1).first,
              line.hasPrefix(Self.notesMarkerPrefix)
        else { return nil }
        return String(line.dropFirst(Self.notesMarkerPrefix.count))
    }

    func dayAlarmOffset(_ days: Int) -> TimeInterval? {
        guard days > 0 else { return nil }
        return -TimeInterval(days * 24 * 60 * 60)
    }
}
