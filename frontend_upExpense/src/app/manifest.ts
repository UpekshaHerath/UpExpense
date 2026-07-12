import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "upExpense",
    short_name: "upExpense",
    description:
      "Personal expense tracking — daily entries, reports, decisions.",
    id: "/",
    start_url: "/",
    display: "standalone",
    // Desktop: draw our own title bar (see components/pwa-titlebar.tsx);
    // only the OS close/minimize/maximize buttons overlay it. Falls back
    // to plain standalone where WCO is unsupported.
    display_override: ["window-controls-overlay", "standalone"],
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#059669",
    categories: ["finance", "productivity"],
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
