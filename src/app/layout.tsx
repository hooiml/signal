import type { Metadata } from "next";
import { Roboto_Mono, Source_Sans_3 } from "next/font/google";
import "./globals.css";
import { ThemeProviderV6 } from "@/components/v6/ThemeProviderV6";

const sourceSans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const robotoMono = Roboto_Mono({
  variable: "--font-roboto-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Signal",
  description: "Personal project to monitor market sentiment and indicate signal",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${sourceSans.variable} ${robotoMono.variable} antialiased`}
      >
        <ThemeProviderV6>{children}</ThemeProviderV6>
      </body>
    </html>
  );
}
