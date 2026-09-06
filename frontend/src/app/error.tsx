'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log client error for debugging
    console.error('[EDKL App Error Boundary]:', error);
  }, [error]);

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
        <div className="w-16 h-16 rounded-full bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto text-2xl font-bold">
          !
        </div>

        <div className="space-y-2">
          <span className="text-[11px] font-extrabold text-rose-700 uppercase tracking-widest block">
            Something Went Wrong &bull; કઈક ભૂલ થઈ છે
          </span>
          <h1 className="text-2xl font-extrabold text-stone-900 tracking-tight">
            Please Reload The Page
          </h1>
          <p className="text-xs text-stone-600 leading-relaxed font-medium">
            પેજ લોડ કરવામાં થોડી ક્ષણિક તકલીફ આવી છે. નીચે આપેલા બટન પર ક્લિક કરીને ફરી પ્રયાસ કરો.
          </p>
        </div>

        <div className="pt-3 space-y-3">
          <button
            onClick={() => reset()}
            className="w-full py-3.5 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-700 hover:to-amber-700 text-white font-bold rounded-2xl transition-all shadow-md shadow-rose-600/25 active:scale-[0.98] text-sm cursor-pointer"
          >
            ↻ Try Again (ફરી પ્રયાસ કરો)
          </button>

          <Link
            href="/"
            className="block w-full py-3 bg-stone-100 hover:bg-stone-200 text-stone-800 font-semibold rounded-2xl transition-all text-xs"
          >
            ← Back to Home (મુખ્ય પેજ પર જાઓ)
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
