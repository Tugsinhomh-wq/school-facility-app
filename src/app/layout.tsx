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
  themeColor: "#131f78",
  viewportFit: "cover",
};

export const metadata: Metadata = {
  applicationName: "ระบบแจ้งซ่อม",
  appleWebApp: { capable: true, title: "แจ้งซ่อม", statusBarStyle: "black-translucent" },
  icons: { apple: "/icons/apple-touch-icon.png" },
  title: "ระบบแจ้งซ่อม โรงเรียนละหานทรายรัชดาภิเษก",
  description: "ระบบแจ้งซ่อมอาคารสถานที่และสิ่งแวดล้อมโรงเรียน",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="th"
      suppressHydrationWarning
      className={`${noto.variable} ${prompt.variable} dark h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Dark is the default; apply a saved "light" choice before first paint. */}
        <Script id="theme-init" strategy="beforeInteractive">
          {`try{if(localStorage.getItem("theme")==="light")document.documentElement.classList.remove("dark")}catch(e){}`}
        </Script>
        {children}
      </body>
    </html>
  );
}
