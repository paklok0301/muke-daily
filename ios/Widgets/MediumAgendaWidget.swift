import SwiftUI
import WidgetKit

struct MediumAgendaWidget: Widget {
    let kind = "MukeTodayBoard"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: AgendaTimelineProvider()) { entry in
            MediumAgendaView(entry: entry)
                .containerBackground(for: .widget) {
                    MukeWidgetTokens.ink
                }
        }
        .configurationDisplayName("今日課程與待辦")
        .description("鎖定畫面或主畫面一眼看完今日安排。")
        .supportedFamilies([.systemMedium])
        .contentMarginsDisabled()
    }
}

private struct MediumAgendaView: View {
    let entry: AgendaWidgetEntry

    var body: some View {
        HStack(spacing: 0) {
            AgendaColumn(
                symbol: "calendar.day.timeline.left",
                title: "行程",
                items: entry.agenda,
                maximumVisible: 3,
                emptyText: "今天沒有行程"
            )

            Rectangle()
                .fill(MukeWidgetTokens.divider)
                .frame(width: 1)
                .padding(.vertical, 15)

            AgendaColumn(
                symbol: "checkmark.circle.fill",
                title: "待辦",
                items: entry.todos,
                maximumVisible: 2,
                emptyText: "待辦已清空"
            )
        }
        .background(MukeWidgetTokens.ink)
        .foregroundStyle(MukeWidgetTokens.ivory)
        .privacySensitive()
        .widgetURL(URL(string: "muke://today"))
    }
}

private struct AgendaColumn: View {
    let symbol: String
    let title: String
    let items: [AgendaEntry]
    let maximumVisible: Int
    let emptyText: String

    private var remainingCount: Int {
        max(items.count - maximumVisible, 0)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            HStack(spacing: 5) {
                Image(systemName: symbol)
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(title == "待辦" ? MukeWidgetTokens.task : MukeWidgetTokens.recurringClass)
                Text(title)
                    .font(.system(size: 12, weight: .bold, design: .rounded))
                Spacer(minLength: 3)
                Text("0/\(items.count)")
                    .font(.system(size: 10, weight: .bold, design: .rounded).monospacedDigit())
                    .foregroundStyle(title == "待辦" ? MukeWidgetTokens.task : MukeWidgetTokens.recurringClass)
            }

            if items.isEmpty {
                Text(emptyText)
                    .font(.system(size: 10, weight: .medium, design: .rounded))
                    .foregroundStyle(MukeWidgetTokens.muted)
                    .frame(maxHeight: .infinity, alignment: .topLeading)
            } else {
                VStack(alignment: .leading, spacing: 6) {
                    ForEach(Array(items.prefix(maximumVisible))) { item in
                        MediumAgendaRow(item: item)
                    }
                }
                .frame(maxHeight: .infinity, alignment: .top)

                if remainingCount > 0 {
                    Text("＋\(remainingCount) 項")
                        .font(.system(size: 9, weight: .bold, design: .rounded))
                        .foregroundStyle(MukeWidgetTokens.muted)
                }
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 13)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

private struct MediumAgendaRow: View {
    let item: AgendaEntry

    var body: some View {
        HStack(alignment: .top, spacing: 6) {
            RoundedRectangle(cornerRadius: 2, style: .continuous)
                .fill(MukeWidgetTokens.categoryColor(for: item))
                .frame(width: 3, height: 29)

            VStack(alignment: .leading, spacing: 1) {
                Text("\(item.emoji) \(item.title)")
                    .font(.system(size: 10, weight: .semibold, design: .rounded))
                    .foregroundStyle(MukeWidgetTokens.ivory)
                    .lineLimit(1)
                if !item.widgetSubtitleText.isEmpty {
                    Text(item.widgetSubtitleText)
                        .font(.system(size: 8, weight: .medium, design: .rounded))
                        .foregroundStyle(MukeWidgetTokens.muted)
                        .lineLimit(1)
                }
            }
        }
    }
}
