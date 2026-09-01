import Foundation

public enum AppGroup {
    public static let identifier = "group.com.paklok0301.muke"
}

public enum SharedScheduleStoreError: Error, Equatable {
    case unreadableData
}

/// JSON persistence shared by the native app, widgets and notification scheduler.
public final class SharedScheduleStore: @unchecked Sendable {
    public static let defaultStorageKey = "muke-app-v1"

    public let suiteName: String
    public let storageKey: String
    private let defaults: UserDefaults
    private let encoder: JSONEncoder
    private let decoder: JSONDecoder

    public init(
        suiteName: String = AppGroup.identifier,
        storageKey: String = SharedScheduleStore.defaultStorageKey,
        userDefaults: UserDefaults? = nil
    ) {
        self.suiteName = suiteName
        self.storageKey = storageKey
        defaults = userDefaults ?? UserDefaults(suiteName: suiteName) ?? .standard
        encoder = JSONEncoder()
        decoder = JSONDecoder()
    }

    public func save(_ data: MukeData) throws {
        defaults.set(try encoder.encode(data), forKey: storageKey)
    }

    public func load() -> MukeData {
        (try? loadThrowing()) ?? .empty
    }

    public func loadThrowing() throws -> MukeData {
        guard let stored = defaults.object(forKey: storageKey) else {
            return .empty
        }
        if let data = stored as? Data {
            return try decoder.decode(MukeData.self, from: data)
        }
        if let json = stored as? String, let data = json.data(using: .utf8) {
            return try decoder.decode(MukeData.self, from: data)
        }
        throw SharedScheduleStoreError.unreadableData
    }

    public func removeAllData() {
        defaults.removeObject(forKey: storageKey)
    }
}
