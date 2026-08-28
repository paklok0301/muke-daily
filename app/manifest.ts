import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "暮刻 — 日常與工時",
    short_name: "暮刻",
    description: "記錄活動、每週課表、功課死線、待辦、兼職工時和健身。",
    start_url: "/",
    display: "standalone",
    background_color: "#0b0a0a",
    theme_color: "#0b0a0a",
    orientation: "portrait",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
