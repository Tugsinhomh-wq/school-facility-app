import type { Metadata, Viewport } from "next";
import { Noto_Sans_Thai, Prompt } from "next/font/google";
import "./globals.css";

// Body/UI: Noto Sans Thai (neutral, clear numerals). Headings: Prompt, a geometric Thai face
// that reads as an app rather than a printed form.
const noto = Noto_Sans_Thai({
  variable: "--font-noto",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600"],
});
const prompt = Prompt({
  variable: "--font-prompt",
  subsets: ["thai", "latin"],
  weight: ["500", "600", "700"],
});

export const viewport: Viewport = {
  themeColor: "#ffffff",
  viewportFit: "cover",
};

export const metadata: Metadata = {
  applicationName: "สำนักงานออนไลน์",
  appleWebApp: { capable: true, title: "สำนักงานออนไลน์", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
  title: "สำนักงานออนไลน์ โรงเรียนละหานทรายรัชดาภิเษก",
  description: "งานอาคารสถานที่ของกลุ่มงานบริหารทั่วไป: แจ้งซ่อม จองห้องประชุม เขตทำความสะอาด",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="th"
      suppressHydrationWarning
      className={`${noto.variable} ${prompt.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
      </body>
    </html>
  );
}
