import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Grantix — El Stripe de las Subvenciones",
  description: "Encuentra, solicita y justifica subvenciones públicas con IA. Tu empresa merece el dinero que ya existe.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full">
      <body className={`${inter.className} h-full bg-gray-50 antialiased`}>{children}</body>
    </html>
  );
}
