import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { getLocale } from "next-intl/server";
import { Toaster } from "sonner";
import { A11yBootScript } from "@/features/accessibility/a11y-boot-script";
import { AppI18nProvider } from "@/features/i18n/app-i18n-provider";
import { appLocaleToHtmlLang, isAppLocale } from "@/i18n/config";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Persona AI",
    template: "%s · Persona AI",
  },
  description:
    "Hybrid AI fraud detection powered by the Fraud Intelligence Network (FIN). Persona AI combines behavioural intelligence, machine learning, social engineering protection and adaptive authentication into one explainable risk decision.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const htmlLang = appLocaleToHtmlLang(isAppLocale(locale) ? locale : "en");

  return (
    <html
      lang={htmlLang}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <A11yBootScript />
      </head>
      <body className="min-h-full flex flex-col">
        <AppI18nProvider initialLocale={locale}>{children}</AppI18nProvider>
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
