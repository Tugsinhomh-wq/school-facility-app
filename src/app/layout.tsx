import type { Metadata } from "next";
import { IBM_Plex_Sans_Thai, Pridi } from "next/font/google";
import "./globals.css";

// Body/UI: IBM Plex Sans Thai (clear numerals). Display: Pridi, a Thai serif
// that echoes printed official documents.
const plex = IBM_Plex_Sans_Thai({
  variable: "--font-plex",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600"],
});
const pridi = Pridi({
  variable: "--font-pridi",
  subsets: ["thai", "latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "ระบบแจ้งซ่อม โรงเรียนละหานทรายรัชดาภิเษก",
  description: "ระบบแจ้งซ่อมอาคารสถานที่และสิ่งแวดล้อมโรงเรียน",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="th"
      suppressHydrationWarning
      className={`${plex.variable} ${pridi.variable} dark h-full antialiased`}
    >
      <head>
        {/* Dark is the default; apply a saved "light" choice before first paint. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem("theme")==="light")document.documentElement.classList.remove("dark")}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
