import ActivityKit
import SwiftUI
import WidgetKit

struct AgendaLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: DailyAgendaAttributes.self) { context in
            LiveActivityBoard(state: context.state)
                .activityBackgroundTint(MukeWidgetTokens.ink)
                .activitySystemActionForegroundColor(MukeWidgetTokens.ivory)
                .widgetURL(URL(string: "muke://today"))
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Text(context.state.agenda.first?.emoji ?? "◷")
                        .font(.system(size: 18))
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text("\(context.state.agendaTotalCount + context.state.todoTotalCount) 項")
                        .font(.system(size: 12, weight: .bold, design: .rounded).monospacedDigit())
                }
                DynamicIslandExpandedRegion(.bottom) {
                    LiveActivityBoard(state: context.state, compact: true)
                        .padding(.horizontal, 4)
                }
            } compactLeading: {
                Text(context.state.agenda.first?.emoji ?? "◷")
            } compactTrailing: {
                Text("\(context.state.agendaTotalCount + context.state.todoTotalCount)")
                    .font(.caption2.monospacedDigit())
            } minimal: {
                Circle()
                    .fill(MukeWidgetTokens.plan)
                    .frame(width: 9, height: 9)
            }
            .widgetURL(URL(string: "muke://today"))
            .keylineTint(MukeWidgetTokens.plan)
        }
    }
}

private struct LiveActivityBoard: View {
    let state: DailyAgendaAttributes.ContentState
    var compact = false

    var body: some View {
        HStack(alignment: .top, spacing: 0) {
            LiveActivityColumn(
                symbol: "calendar.day.timeline.left",
                title: "行程",
                items: Array(state.agenda.prefix(compact ? 2 : 3)),
                totalCount: state.agendaTotalCount,
                accent: MukeWidgetTokens.recurringClass
            )

            Rectangle()
                .fill(MukeWidgetTokens.divider)
                .frame(width: 1)
                .padding(.vertical, compact ? 4 : 10)

            LiveActivityColumn(
                symbol: "checkmark.circle.fill",
                title: "待辦",
                items: Array(state.todos.prefix(compact ? 1 : 2)),
                totalCount: state.todoTotalCount,
                accent: MukeWidgetTokens.task
            )
        }
        .padding(.horizontal, compact ? 2 : 11)
        .padding(.vertical, compact ? 4 : 11)
        .background(MukeWidgetTokens.ink)
        .foregroundStyle(MukeWidgetTokens.ivory)
        .privacySensitive()
    }
}

private struct LiveActivityColumn: View {
    let symbol: String
    let title: String
    let items: [DailyAgendaAttributes.DisplayItem]
    let totalCount: Int
    let accent: Color

    private var remainingCount: Int {
        max(totalCount - items.count, 0)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 5) {
                Image(systemName: symbol)
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(accent)
                Text(title)
                    .font(.system(size: 11, weight: .bold, design: .rounded))
                Spacer(minLength: 2)
                Text("\(totalCount)")
                    .font(.system(size: 10, weight: .bold, design: .rounded).monospacedDigit())
                    .foregroundStyle(accent)
            }

            if items.isEmpty {
                Text(title == "待辦" ? "已清空" : "沒有安排")
                    .font(.system(size: 9, weight: .medium, design: .rounded))
                    .foregroundStyle(MukeWidgetTokens.muted)
            } else {
                ForEach(items) { item in
                    LiveActivityRow(item: item)
                }
            }

            if remainingCount > 0 {
                Text("＋\(remainingCount) 項")
                    .font(.system(size: 9, weight: .bold, design: .rounded))
                    .foregroundStyle(MukeWidgetTokens.muted)
            }
        }
        .padding(.horizontal, 9)
        .frame(maxWidth: .infinity, alignment: .topLeading)
    }
}

private struct LiveActivityRow: View {
    let item: DailyAgendaAttributes.DisplayItem

    var body: some View {
        HStack(alignment: .top, spacing: 6) {
            RoundedRectangle(cornerRadius: 2, style: .continuous)
                .fill(Color(hex: item.colorHex) ?? MukeWidgetTokens.plan)
                .frame(width: 3, height: 27)

            VStack(alignment: .leading, spacing: 0) {
                Text("\(item.emoji) \(item.title)")
                    .font(.system(size: 10, weight: .semibold, design: .rounded))
                    .lineLimit(1)
                let details = [item.time, item.subtitle].filter { !$0.isEmpty }.joined(separator: " · ")
                if !details.isEmpty {
                    Text(details)
                        .font(.system(size: 8, weight: .medium, design: .rounded))
                        .foregroundStyle(MukeWidgetTokens.muted)
                        .lineLimit(1)
                }
            }
        }
    }
}
