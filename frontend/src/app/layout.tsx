import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Cinzel, Noto_Sans_Gujarati } from "next/font/google";
import "./globals.css";

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
  title: "Ek Duje Ke Liye | Educational Relationship & Couple Seminars",
  description: "Official registration and pass portal for Ek Duje Ke Liye — an educational relationship, couple communication, and life skills seminar initiative led by Manish Vaghasiya.",
  keywords: ["Ek Duje Ke Liye", "Educational Seminar", "Couple Communication Workshop", "Relationship Education", "Life Skills Training", "Manish Vaghasiya"],
  openGraph: {
    title: "Ek Duje Ke Liye | Educational Relationship & Couple Seminars",
    description: "Educational relationship, couple communication, and life-skills seminars led by Manish Vaghasiya.",
    type: "website",
    locale: "gu_IN",
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
      className={`${plusJakartaSans.variable} ${cinzel.variable} ${notoSansGujarati.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans bg-[#FAF9F6] text-stone-900 selection:bg-rose-500/20 selection:text-rose-900">
        {children}
      </body>
    </html>
  );
}
