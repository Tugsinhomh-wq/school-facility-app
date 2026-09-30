import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ระบบแจ้งซ่อม โรงเรียนละหานทรายรัชดาภิเษก",
    short_name: "แจ้งซ่อม",
    description: "แจ้งซ่อมอาคารสถานที่และขอใช้ห้องประชุม",
    lang: "th",
    start_url: "/",
    display: "standalone",
    background_color: "#070b2a",
    theme_color: "#131f78",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
