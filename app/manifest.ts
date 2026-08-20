import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "暮刻 — 日常與工時",
    short_name: "暮刻",
    description: "記錄待辦、兼職工時、工資、健身和每天的心情。",
    start_url: "/",
    display: "standalone",
    background_color: "#0b0a0a",
    theme_color: "#0b0a0a",
    orientation: "portrait",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
    ],
  };
}
