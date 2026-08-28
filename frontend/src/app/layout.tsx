import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Cinzel, Noto_Sans_Gujarati } from "next/font/google";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: "#FAF9F6",
  colorScheme: "light"
};

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const cinzel = Cinzel({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["600", "700", "800", "900"],
  display: "swap",
});

const notoSansGujarati = Noto_Sans_Gujarati({
  variable: "--font-gujarati",
  subsets: ["gujarati"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Ek Duje Ke Liye | A Special Program for Couples",
  description: "Official registration and digital pass portal for Ek Duje Ke Liye — a special interactive program created for couples led by Manish Vaghasiya.",
  keywords: ["Ek Duje Ke Liye", "Couple Seminar", "Couple Program", "Relationship Event", "Couple Experience", "Manish Vaghasiya"],
  openGraph: {
    title: "Ek Duje Ke Liye | A Special Program for Couples",
    description: "A special interactive experience created for married couples led by Manish Vaghasiya.",
    type: "website",
    locale: "gu_IN",
  },
  other: {
    "color-scheme": "light"
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="gu"
      style={{ colorScheme: 'light' }}
      className={`${plusJakartaSans.variable} ${cinzel.variable} ${notoSansGujarati.variable} h-full antialiased light`}
    >
      <body className="min-h-full flex flex-col font-sans bg-[#FAF9F6] text-stone-900 selection:bg-rose-500/20 selection:text-rose-900" style={{ colorScheme: 'light' }}>
        {children}
      </body>
    </html>
  );
}
