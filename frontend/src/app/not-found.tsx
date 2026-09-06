import React from 'react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#FAF9F6] text-stone-900 flex flex-col justify-between font-sans px-4 py-8">
      {/* Header */}
      <div className="max-w-md mx-auto w-full text-center">
        <Link href="/" className="inline-flex items-center gap-2 mb-8">
          <img src="/logo.png" alt="Ek Duje Ke Liye Logo" className="h-10 w-auto object-contain mx-auto" />
          <span className="text-base font-extrabold tracking-wider text-stone-900 uppercase">
            Ek Duje Ke Liye
          </span>
        </Link>
      </div>

      {/* Card */}
      <div className="max-w-md mx-auto w-full bg-white border border-stone-200/90 rounded-3xl p-8 md:p-10 shadow-xl text-center space-y-5">
        <div className="w-16 h-16 rounded-full bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto text-2xl font-bold">
          404
        </div>

        <div className="space-y-2">
          <span className="text-[11px] font-extrabold text-rose-700 uppercase tracking-widest block">
            Page Not Found &bull; પેજ મળ્યું નથી
          </span>
          <h1 className="text-2xl font-extrabold text-stone-900 tracking-tight">
            Oops! Page Not Found
          </h1>
          <p className="text-xs text-stone-600 leading-relaxed font-medium">
            તમે જે પેજ શોધી રહ્યા છો તે ઉપલબ્ધ નથી અથવા લિંક બદલાઈ ગઈ છે.
          </p>
        </div>

        <div className="pt-3">
          <Link
            href="/"
            className="block w-full py-3.5 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-700 hover:to-amber-700 text-white font-bold rounded-2xl transition-all shadow-md shadow-rose-600/25 active:scale-[0.98] text-sm"
          >
            ← View All Upcoming Seminars (મુખ્ય પેજ પર જાઓ)
          </Link>
        </div>
      </div>

      {/* Footer */}
      <div className="max-w-md mx-auto w-full text-center text-[11px] text-stone-600 pt-8">
        &copy; {new Date().getFullYear()} Ek Duje Ke Liye &bull; Manish Vaghasiya
      </div>
    </div>
  );
}
