import type { Metadata } from "next";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  title: "SmartLeading — Subvenciones en 72 horas",
  description: "Encuentra, solicita y justifica subvenciones públicas con IA. Tu empresa merece el dinero que ya existe.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`h-full ${geist.variable} ${geistMono.variable}`}>
      <body className="h-full antialiased">
        <Script
          src="https://t.contentsquare.net/uxa/157486111e4ab.js"
          strategy="afterInteractive"
        />
        {children}
      </body>
    </html>
  );
}
