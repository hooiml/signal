import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { ThemeProviderV6 } from "@/components/v6/ThemeProviderV6";
import { PwaLifecycle } from "@/components/pwa/PwaLifecycle";
import { WorkspaceNavigation } from "@/components/navigation/WorkspaceNavigation";
import { v8ThemeBootScript } from "@/components/v8/v8-theme";

const sourceSans = localFont({
  src: "./fonts/SourceSans3-Variable.woff2",
  variable: "--font-source-sans",
  weight: "400 800",
  style: "normal",
  display: "swap",
});

const robotoMono = localFont({
  src: "./fonts/RobotoMono-Variable.woff2",
  variable: "--font-roboto-mono",
  weight: "400 700",
  style: "normal",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Signal",
  description: "Personal project to monitor market sentiment and indicate signal",
  applicationName: "Signal",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/signal-192.svg", sizes: "192x192", type: "image/svg+xml" },
      { url: "/icons/signal-512.svg", sizes: "512x512", type: "image/svg+xml" },
    ],
    apple: "/icons/signal-192.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f766e",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // The boot script sets data-v8-theme on <html> before hydration.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: v8ThemeBootScript }} />
      </head>
      <body
        className={`${sourceSans.variable} ${robotoMono.variable} antialiased`}
      >
        <PwaLifecycle />
        <WorkspaceNavigation />
        <ThemeProviderV6>{children}</ThemeProviderV6>
      </body>
    </html>
  );
}
