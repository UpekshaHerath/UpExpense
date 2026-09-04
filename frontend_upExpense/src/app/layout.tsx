import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { PwaRegister } from "@/components/pwa-register";
import { PwaTitlebar } from "@/components/pwa-titlebar";
import { RippleRoot } from "@/components/ripple-root";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Absolute base for OG/Twitter image URLs. Crawlers reject relative paths, so
// resolve a real origin: explicit env → Vercel's production domain → localhost.
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

const title = "upExpense";
const description =
  "Personal expense tracking — daily entries, reports, decisions.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: title,
    template: "%s · upExpense",
  },
  description,
  applicationName: title,
  keywords: [
    "expense tracker",
    "personal finance",
    "budgeting",
    "spending reports",
    "daily expenses",
  ],
  authors: [{ name: "upExpense" }],
  // og:image / twitter:image are injected automatically from
  // app/opengraph-image.tsx — no need to list images here.
  openGraph: {
    type: "website",
    siteName: title,
    title,
    description,
    url: siteUrl,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

export const viewport: Viewport = {
  // viewport-fit=cover lets the app draw behind notches/home bars when
  // installed; safe areas are handled via env(safe-area-inset-*).
  viewportFit: "cover",
  // theme-color is set by the inline <head> script (and kept in sync by
  // PwaTitlebar) so it follows the app's class-based theme, not the OS
  // preference — it paints the installed app's window-controls strip.
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* Apply stored theme + accent before first paint — prevents flash. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("theme");var d=t==="dark"||(!t&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);var m=document.createElement("meta");m.name="theme-color";m.content=d?"#0a0a0a":"#ffffff";document.head.appendChild(m);var a=localStorage.getItem("accent");if(a)document.documentElement.setAttribute("data-accent",a)}catch(e){}})()`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <PwaTitlebar />
        <PwaRegister />
        {/* One delegated listener drives touch feedback for the whole app. */}
        <RippleRoot />
        {children}
      </body>
    </html>
  );
}
