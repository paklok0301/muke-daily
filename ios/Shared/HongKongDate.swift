import Foundation

/// Strict, locale-independent date handling for the app's `yyyy-MM-dd` / `HH:mm` JSON fields.
public enum HongKongDate {
    public static let timeZone = TimeZone(identifier: "Asia/Hong_Kong")!

    public static var calendar: Calendar {
        var value = Calendar(identifier: .gregorian)
        value.locale = Locale(identifier: "en_US_POSIX")
        value.timeZone = timeZone
        value.firstWeekday = 2
        return value
    }

    public static func date(from dateKey: String) -> Date? {
        let parts = dateKey.split(separator: "-", omittingEmptySubsequences: false)
        guard parts.count == 3,
              parts[0].count == 4,
              parts[1].count == 2,
              parts[2].count == 2,
              let year = Int(parts[0]),
              let month = Int(parts[1]),
              let day = Int(parts[2]) else {
            return nil
        }

        var components = DateComponents()
        components.calendar = calendar
        components.timeZone = timeZone
        components.year = year
        components.month = month
        components.day = day
        components.hour = 0
        components.minute = 0
        components.second = 0

        guard let result = calendar.date(from: components), self.dateKey(for: result) == dateKey else {
            return nil
        }
        return result
    }

    public static func dateKey(for date: Date) -> String {
        let components = calendar.dateComponents([.year, .month, .day], from: date)
        return String(
            format: "%04d-%02d-%02d",
            locale: Locale(identifier: "en_US_POSIX"),
            components.year ?? 0,
            components.month ?? 0,
            components.day ?? 0
        )
    }

    public static func dateTime(dateKey: String, time: String) -> Date? {
        guard let day = date(from: dateKey) else { return nil }
        let parts = time.split(separator: ":", omittingEmptySubsequences: false)
        guard parts.count == 2,
              parts[0].count == 2,
              parts[1].count == 2,
              let hour = Int(parts[0]),
              let minute = Int(parts[1]),
              (0...23).contains(hour),
              (0...59).contains(minute) else {
            return nil
        }
        return calendar.date(bySettingHour: hour, minute: minute, second: 0, of: day)
    }

    public static func addingDays(_ amount: Int, to date: Date) -> Date? {
        calendar.date(byAdding: .day, value: amount, to: date)
    }

    /// Returns the JavaScript weekday convention used by the website (0 = Sunday, 6 = Saturday).
    public static func weekday(for dateKey: String) -> Int? {
        guard let date = date(from: dateKey) else { return nil }
        return calendar.component(.weekday, from: date) - 1
    }
}
