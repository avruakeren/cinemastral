import type { Metadata, Viewport } from "next";
import { Inter, Montserrat } from "next/font/google";
import { MovieDetailModalProvider } from "@/lib/hooks/use-movie-detail-modal";
import { MovieDetailModal } from "@/components/MovieDetailModal";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { FontAwesome } from "@/components/FontAwesome";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: {
    default: "Cinemastral — Nonton Film, Series & Anime",
    template: "%s — Cinemastral",
  },
  description: "Platform streaming film, series, anime, dan donghua online.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.svg", sizes: "any", type: "image/svg+xml" },
      { url: "/favicon.png", sizes: "64x64", type: "image/png" },
      { url: "/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: "/icon-180.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Cinemastral",
  },
};

export const viewport: Viewport = {
  themeColor: "#95FF50",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={`${inter.variable} ${montserrat.variable} h-full antialiased`}>
      <head>
        <FontAwesome />
      </head>
      <body className="min-h-full flex flex-col">
        <MovieDetailModalProvider>
          {children}
          <MovieDetailModal />
        </MovieDetailModalProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
