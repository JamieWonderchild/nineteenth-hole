import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { Providers } from './providers/providers';
import { ProgressBar } from '@/components/ui/ProgressBar';


const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "The 19th Hole",
  description: "The modern platform for golf clubs and players.",
  openGraph: {
    siteName: "The 19th Hole",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans`}>
        <Suspense fallback={null}>
          <ProgressBar />
        </Suspense>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
