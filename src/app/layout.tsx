import type { Metadata, Viewport } from "next";
import { Noto_Sans_Thai, Prompt } from "next/font/google";
import Script from "next/script";
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
  themeColor: "#f6f7fb",
  viewportFit: "cover",
};

export const metadata: Metadata = {
  applicationName: "ระบบแจ้งซ่อม",
  appleWebApp: { capable: true, title: "แจ้งซ่อม", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
  title: "ระบบแจ้งซ่อม โรงเรียนละหานทรายรัชดาภิเษก",
  description: "ระบบแจ้งซ่อมอาคารสถานที่และสิ่งแวดล้อมโรงเรียน",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="th"
      suppressHydrationWarning
      className={`${noto.variable} ${prompt.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Light is the default; apply a saved "dark" choice before first paint. */}
        <Script id="theme-init" strategy="beforeInteractive">
          {`try{if(localStorage.getItem("theme")==="dark")document.documentElement.classList.add("dark")}catch(e){}`}
        </Script>
        {children}
      </body>
    </html>
  );
}
