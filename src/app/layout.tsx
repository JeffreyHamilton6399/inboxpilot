import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";
import { AppProviders } from "@/components/app-providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "InboxPilot — Your AI email",
  description:
    "InboxPilot is your AI email client. Log in, connect Gmail, and let AI organize your inbox, draft replies in your voice, and answer questions about your email. Open source and free.",
  keywords: [
    "InboxPilot",
    "AI email client",
    "email assistant",
    "open source email",
    "AI inbox",
  ],
  authors: [{ name: "InboxPilot" }],
  icons: {
    icon: "/icon.svg",
  },
  openGraph: {
    title: "InboxPilot — Your AI email",
    description:
      "Log in, connect Gmail, and let AI organize your inbox, draft replies, and answer questions about your email. Free and open source.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "InboxPilot — Your AI email",
    description:
      "Your AI email client. Connect Gmail, organize, draft, and chat with your inbox.",
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
          <AppProviders>
            {children}
            <Toaster />
          </AppProviders>
        </ThemeProvider>
      </body>
    </html>
  );
}
