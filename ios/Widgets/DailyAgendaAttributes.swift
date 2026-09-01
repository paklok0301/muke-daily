import ActivityKit
import Foundation

public struct DailyAgendaAttributes: ActivityAttributes {
    public struct DisplayItem: Codable, Hashable, Identifiable, Sendable {
        public let id: String
        public let title: String
        public let subtitle: String
        public let time: String
        public let kind: String
        public let colorHex: String
        public let emoji: String

        public init(
            id: String,
            title: String,
            subtitle: String,
            time: String,
            kind: String,
            colorHex: String,
            emoji: String
        ) {
            self.id = id
            self.title = title
            self.subtitle = subtitle
            self.time = time
            self.kind = kind
            self.colorHex = colorHex
            self.emoji = emoji
        }
    }

    public struct ContentState: Codable, Hashable, Sendable {
        public let updatedAt: Date
        public let agenda: [DisplayItem]
        public let todos: [DisplayItem]
        public let agendaTotalCount: Int
        public let todoTotalCount: Int

        public init(
            updatedAt: Date,
            agenda: [DisplayItem],
            todos: [DisplayItem],
            agendaTotalCount: Int,
            todoTotalCount: Int
        ) {
            self.updatedAt = updatedAt
            self.agenda = agenda
            self.todos = todos
            self.agendaTotalCount = agendaTotalCount
            self.todoTotalCount = todoTotalCount
        }
    }

    public let dateKey: String

    public init(dateKey: String) {
        self.dateKey = dateKey
    }
}
