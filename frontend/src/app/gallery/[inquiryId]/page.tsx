'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { API_BASE_URL } from '@/config';
import { CameraIcon, ExternalLinkIcon, SparklesIcon, CheckIcon } from '@/components/Icons';

export default function GalleryRedirectPage() {
  const params = useParams();
  const inquiryId = params?.inquiryId as string;

  const [loading, setLoading] = useState(true);
  const [targetUrl, setTargetUrl] = useState<string | null>(null);
  const [eventName, setEventName] = useState<string>('Ek Duje Ke Liye Seminar');
  const [coupleName, setCoupleName] = useState<string>('');
  const [groupCode, setGroupCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!inquiryId) return;

    const fetchGallery = async () => {
      try {
        let res = await fetch(`${API_BASE_URL}/api/submissions/status/${encodeURIComponent(inquiryId)}`);
        if (!res.ok) {
          res = await fetch(`${API_BASE_URL}/api/registrations/status/${encodeURIComponent(inquiryId)}`);
        }

        if (res.ok) {
          const data = await res.json();
          const photoUrl = data.program?.photoLink || data.photoLink || (data.program as any)?.photoUrl;
          if (data.husbandName && data.wifeName) {
            setCoupleName(`${data.husbandName} & ${data.wifeName}`);
          }
          if (data.program?.name) {
            setEventName(data.program.name);
          }

          if (photoUrl && photoUrl.trim()) {
            const cleanUrl = photoUrl.trim();
            setTargetUrl(cleanUrl);

            // Detect groupCode or ucode in query string (e.g. groupCode=X5ZHM6 or ucode=X5ZHM6)
            const codeMatch = cleanUrl.match(/[?&](?:groupCode|ucode|code)=([A-Za-z0-9_-]+)/i);
            if (codeMatch && codeMatch[1]) {
              setGroupCode(codeMatch[1]);
            } else {
              // Direct URL like Google Drive / Cloudinary -> redirect immediately
              window.location.replace(cleanUrl);
              return;
            }
          }
        }
      } catch (err) {
        console.warn('Failed to resolve custom event gallery:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchGallery();
  }, [inquiryId]);

  const handleCopyCode = () => {
    if (!groupCode) return;
    navigator.clipboard.writeText(groupCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-stone-900 border border-stone-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-5">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 mx-auto flex items-center justify-center shadow-inner">
          <CameraIcon className="w-8 h-8" />
        </div>

        <div className="space-y-1">
          <span className="text-[10px] uppercase font-extrabold tracking-widest text-rose-400">
            Ek Duje Ke Liye Memories
          </span>
          <h1 className="text-xl sm:text-2xl font-black text-white">
            {coupleName ? `${coupleName}` : 'Event Digital Memories'}
          </h1>
          <p className="text-xs text-stone-400 font-medium">
            {eventName}
          </p>
        </div>

        {loading ? (
          <div className="p-4 bg-stone-900/60 rounded-2xl border border-stone-800 text-xs text-stone-400 space-y-2">
            <div className="w-5 h-5 border-2 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p>તમારા ફોટા લોડ થઈ રહ્યા છે... (Loading photo album...)</p>
          </div>
        ) : targetUrl ? (
          <div className="space-y-4">
            {groupCode && (
              <div className="p-4 bg-stone-800/80 border border-stone-700 rounded-2xl space-y-2.5 text-left">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-400 block">
                  Album Access Code (Ucode)
                </span>
                <div className="flex items-center justify-between gap-2 bg-stone-950 px-3.5 py-2.5 rounded-xl border border-stone-800">
                  <span className="font-mono text-base font-black text-amber-300 tracking-wider">
                    {groupCode}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    {copied ? (
                      <>
                        <CheckIcon className="w-3.5 h-3.5" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <span>Copy Code</span>
                    )}
                  </button>
                </div>
                <p className="text-[11px] text-stone-400 leading-relaxed">
                  ફોટા જોવા માટે &ldquo;Open Photos&rdquo; પર ક્લિક કરો. જો Ucode માંગે તો ઉપર આપેલ કોડ પેસ્ટ કરો.
                </p>
              </div>
            )}

            <a
              href={targetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 w-full py-3.5 px-6 bg-rose-600 hover:bg-rose-500 text-white font-extrabold rounded-2xl shadow-lg transition-all text-xs cursor-pointer"
            >
              <span>Open Photos (Full Access)</span>
              <ExternalLinkIcon className="w-4 h-4" />
            </a>

            {/* Photographer Credits & Social Share */}
            <div className="pt-3 border-t border-stone-800/90 text-left space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-stone-300">
                  📸 Sai Photo Surat
                </span>
                <a
                  href="https://www.instagram.com/sai_photo_surat?igsh=MTR1dDlpZ251NWx1Mw=="
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] font-bold text-rose-400 hover:text-rose-300 underline flex items-center gap-1"
                >
                  <span>Instagram Profile</span>
                  <ExternalLinkIcon className="w-3 h-3" />
                </a>
              </div>
              <p className="text-[10px] text-stone-400">
                Contact: Pradip Lakhani &bull; +91 98982 40505
              </p>
              <div className="bg-stone-950/60 p-2.5 rounded-xl border border-stone-800/80 text-[10px] text-stone-400">
                🔴 Tag & Share: <span className="text-rose-300 font-semibold">@sai_photo_surat</span> and <span className="text-rose-300 font-semibold">#EkDujeKeLiye</span> on Instagram!
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-amber-950/30 border border-amber-800/40 rounded-2xl text-xs text-amber-200/90 text-left space-y-1.5">
              <p className="font-bold flex items-center gap-1.5 text-amber-400">
                <SparklesIcon className="w-4 h-4" />
                <span>ફોટા તૈયાર થઈ રહ્યા છે (Photos Coming Soon)</span>
              </p>
              <p className="text-[11px] leading-relaxed text-stone-300">
                આ સેમિનારના હાઇ-રિઝોલ્યુશન ફોટા પ્રોસેસ થઈ રહ્યા છે. થોડા સમયમાં અહીં લિંક ઉપલબ્ધ થઈ જશે.
              </p>
            </div>
            <a
              href="/#gallery"
              className="inline-flex items-center justify-center gap-2 w-full py-3 px-6 bg-stone-800 hover:bg-stone-700 text-white font-bold rounded-2xl transition-all text-xs"
            >
              <span>Explore Website Gallery</span>
              <span>→</span>
            </a>
          </div>
        )}

        <div className="pt-2 border-t border-stone-800/80">
          <p className="text-[10px] text-stone-500">
            Pass / Inquiry: <span className="font-mono text-stone-400">{inquiryId}</span> &bull; Ek Duje Ke Liye
          </p>
        </div>
      </div>
    </div>
  );
}
