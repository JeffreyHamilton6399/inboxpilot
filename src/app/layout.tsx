import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "InboxPilot — Open-source AI inbox assistant",
  description:
    "InboxPilot is the free, open-source AI executive assistant for your inbox. Auto-categorize email, draft tone-matched replies, and chat with your inbox. A self-hostable alternative to Fyxer.",
  keywords: [
    "InboxPilot",
    "open source",
    "AI email assistant",
    "Fyxer alternative",
    "email organizer",
    "AI draft replies",
    "self-hosted",
  ],
  authors: [{ name: "InboxPilot" }],
  openGraph: {
    title: "InboxPilot — Open-source AI inbox assistant",
    description:
      "The free, open-source AI executive assistant for your inbox. A self-hostable alternative to Fyxer.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "InboxPilot — Open-source AI inbox assistant",
    description:
      "The free, open-source AI executive assistant for your inbox. A self-hostable alternative to Fyxer.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
