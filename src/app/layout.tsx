import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "UOK Dengue Response System",
    template: "%s | UOK Dengue Response System",
  },
  description:
    "Real-time dengue outbreak monitoring and response system for the University of Kelaniya campus. Report breeding sites, track clusters, and coordinate cleanup operations.",
  keywords: [
    "dengue",
    "University of Kelaniya",
    "outbreak response",
    "public health",
    "campus safety",
    "UOK",
  ],
  authors: [{ name: "Department of Industrial Management, Faculty of Science, University of Kelaniya" }],
  openGraph: {
    title: "UOK Dengue Response System",
    description: "Real-time dengue outbreak monitoring for the University of Kelaniya.",
    siteName: "UOK DRS",
    locale: "en_LK",
    type: "website",
  },
  robots: {
    index: false, // Internal tool — do not index
    follow: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1, // Prevent zoom on inputs (mobile UX)
  themeColor: "#0f172a",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          rel="preconnect"
          href="https://fonts.googleapis.com"
        />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin=""
        />
        {/* Leaflet CSS */}
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
          crossOrigin=""
        />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
