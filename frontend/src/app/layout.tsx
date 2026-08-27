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
  title: "Ek Duje Ke Liye | Exclusive Couple Seminar & Passes",
  description: "Official Admission Pass & Ticket Portal for Ek Duje Ke Liye by Manish Vaghasiya",
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
