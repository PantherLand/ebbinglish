import type { Metadata } from "next";
import Providers from "@/app/providers";
import "./globals.css";

function getSiteUrl() {
  const raw =
    process.env.AUTH_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    "http://localhost:3000";

  try {
    return new URL(raw);
  } catch {
    return new URL("http://localhost:3000");
  }
}

export const metadata: Metadata = {
  metadataBase: getSiteUrl(),
  applicationName: "Ebbinglish",
  title: {
    default: "Ebbinglish",
    template: "%s | Ebbinglish",
  },
  description:
    "Ebbinglish is an English vocabulary learning app that uses spaced repetition, round-based review, and YouGlish pronunciation examples to help you remember words faster.",
  keywords: [
    "English vocabulary app",
    "spaced repetition",
    "vocabulary learning",
    "memorize English words",
    "YouGlish",
    "English pronunciation practice",
    "flashcards",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Ebbinglish",
    title: "Ebbinglish",
    description:
      "Learn English vocabulary with spaced repetition, round-based review, and YouGlish-powered pronunciation context.",
  },
  twitter: {
    card: "summary",
    title: "Ebbinglish",
    description:
      "Learn English vocabulary with spaced repetition, round-based review, and YouGlish-powered pronunciation context.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
