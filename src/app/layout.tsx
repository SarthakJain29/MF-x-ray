import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Instrument_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ClientBoot } from "@/components/ClientBoot";

const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const body = Instrument_Sans({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: { default: "MF X-ray — see inside your mutual funds", template: "%s · MF X-ray" },
  description:
    "Upload your CAMS/KFintech CAS and see your true XIRR, fund overlap, hidden costs and goals — parsed privately in your browser.",
  applicationName: "MF X-ray",
  appleWebApp: { capable: true, title: "MF X-ray", statusBarStyle: "black-translucent" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3efe6" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0b12" },
  ],
};

const themeScript = `try{var t=localStorage.getItem('mfxray:theme');if(t)document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-IN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${display.variable} ${body.variable} ${mono.variable} min-h-dvh antialiased`}>
        <ClientBoot />
        {children}
      </body>
    </html>
  );
}
