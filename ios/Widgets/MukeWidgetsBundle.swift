import SwiftUI
import WidgetKit

@main
struct MukeWidgetsBundle: WidgetBundle {
    var body: some Widget {
        LockScreenAgendaWidget()
        MediumAgendaWidget()
        AgendaLiveActivity()
    }
}
