import SwiftUI
import WidgetKit

struct LockScreenAgendaWidget: Widget {
    let kind = "MukeLockScreenAgenda"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: AgendaTimelineProvider()) { entry in
            LockScreenAgendaView(entry: entry)
                .containerBackground(.clear, for: .widget)
        }
        .configurationDisplayName("今日安排")
        .description("不用開啟 App，也能在鎖定畫面看見下一項安排。")
        .supportedFamilies([.accessoryRectangular])
    }
}

private struct LockScreenAgendaView: View {
    let entry: AgendaWidgetEntry

    private var visibleItems: ArraySlice<AgendaEntry> {
        entry.allItems.prefix(2)
    }

    private var remainingCount: Int {
        max(entry.allItems.count - visibleItems.count, 0)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            if visibleItems.isEmpty {
                Text("今天沒有安排")
                    .font(.system(size: 14, weight: .semibold, design: .rounded))
                Text("留一點空白給自己")
                    .font(.system(size: 10, weight: .medium, design: .rounded))
                    .foregroundStyle(.secondary)
            } else {
                ForEach(Array(visibleItems)) { item in
                    HStack(spacing: 5) {
                        Capsule(style: .continuous)
                            .fill(MukeWidgetTokens.categoryColor(for: item))
                            .frame(width: 3, height: 13)
                            .widgetAccentable()

                        VStack(alignment: .leading, spacing: 0) {
                            Text("\(item.emoji) \(item.title)")
                                .font(.system(size: 11, weight: .semibold, design: .rounded))
                                .lineLimit(1)
                            if !item.widgetSubtitleText.isEmpty {
                                Text(item.widgetSubtitleText)
                                    .font(.system(size: 8, weight: .medium, design: .rounded))
                                    .foregroundStyle(.secondary)
                                    .lineLimit(1)
                            }
                        }
                    }
                }

                if remainingCount > 0 {
                    Text("另有 \(remainingCount) 項")
                        .font(.system(size: 8, weight: .semibold, design: .rounded))
                        .foregroundStyle(.secondary)
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .privacySensitive()
        .widgetURL(URL(string: "muke://today"))
    }
}
