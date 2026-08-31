import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
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

// Display only — headlines on the landing page and the setup flow. The
// interface itself stays in Geist, where a serif at 13px would cost more in
// legibility than it returns in character.
const displaySerif = Instrument_Serif({
  variable: "--font-display-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "InboxPilot — an assistant for the inbox you already have",
  description:
    "InboxPilot connects to your Gmail, sorts what arrives, drafts replies in the way you write, and answers questions about your mail. MIT licensed, and it runs on your own deployment against a model key you supply.",
  keywords: [
    "InboxPilot",
    "AI email client",
    "email assistant",
    "self-hosted email",
    "open source email",
    "Gmail assistant",
  ],
  authors: [{ name: "InboxPilot" }],
  icons: {
    icon: "/icon.svg",
  },
  openGraph: {
    title: "InboxPilot — an assistant for the inbox you already have",
    description:
      "Sorts what arrives, drafts replies in the way you write, answers questions about your mail. Your deployment, your Google client, your model key.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "InboxPilot — an assistant for the inbox you already have",
    description:
      "Sorts what arrives, drafts replies in the way you write, answers questions about your mail. Your deployment, your model key.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    /*
     * The font variables belong on <html>, not on <body>.
     *
     * globals.css resolves them in an `@theme inline` block, which is
     * evaluated at :root — so while next/font declared them one level down on
     * <body>, --font-sans resolved to nothing and the entire site rendered in
     * whatever sans the browser happened to default to. Geist was loaded on
     * every page and used on none of them.
     */
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${displaySerif.variable}`}
    >
      <body className="antialiased bg-background text-foreground">
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
