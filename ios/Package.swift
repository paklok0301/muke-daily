// swift-tools-version: 5.9

import PackageDescription

let package = Package(
    name: "MukeShared",
    platforms: [
        .iOS(.v17),
        .macOS(.v13),
    ],
    products: [
        .library(name: "MukeShared", targets: ["MukeShared"]),
    ],
    targets: [
        .target(
            name: "MukeShared",
            path: "Shared"
        ),
        .testTarget(
            name: "MukeSharedTests",
            dependencies: ["MukeShared"],
            path: "Tests/MukeSharedTests"
        ),
    ]
)
