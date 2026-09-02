'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { API_BASE_URL } from '@/config';
import { CameraIcon, ExternalLinkIcon, SparklesIcon } from '@/components/Icons';

export default function GalleryRedirectPage() {
  const params = useParams();
  const inquiryId = params?.inquiryId as string;

  const [loading, setLoading] = useState(true);
  const [targetUrl, setTargetUrl] = useState<string | null>(null);
  const [eventName, setEventName] = useState<string>('Ek Duje Ke Liye Seminar');
  const [coupleName, setCoupleName] = useState<string>('');

  useEffect(() => {
    if (!inquiryId) return;

    const fetchGallery = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/registrations/status/${encodeURIComponent(inquiryId)}`);
        if (res.ok) {
          const data = await res.json();
          const photoUrl = data.program?.photoLink || data.photoLink;
          if (data.husbandName && data.wifeName) {
            setCoupleName(`${data.husbandName} & ${data.wifeName}`);
          }
          if (data.program?.name) {
            setEventName(data.program.name);
          }

          if (photoUrl && photoUrl.trim()) {
            setTargetUrl(photoUrl.trim());
            // Smoothly redirect to the photo album / Google Drive
            window.location.replace(photoUrl.trim());
            return;
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

  return (
    <div className="min-h-screen bg-stone-900 text-stone-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-stone-800/90 border border-stone-700 rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-5">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 mx-auto flex items-center justify-center shadow-inner">
          <CameraIcon className="w-8 h-8 animate-pulse" />
        </div>

        <div className="space-y-1">
          <span className="text-[10px] uppercase font-extrabold tracking-widest text-rose-400">
            Ek Duje Ke Liye Memories
          </span>
          <h1 className="text-xl sm:text-2xl font-black text-white">
            {coupleName ? `${coupleName}` : 'Event Photo Gallery'}
          </h1>
          <p className="text-xs text-stone-400 font-medium">
            {eventName}
          </p>
        </div>

        {loading ? (
          <div className="p-4 bg-stone-900/60 rounded-2xl border border-stone-700/50 text-xs text-stone-400 space-y-2">
            <div className="w-5 h-5 border-2 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p>તમારા ફોટા લોડ થઈ રહ્યા છે... (Opening photo album...)</p>
          </div>
        ) : targetUrl ? (
          <div className="space-y-3">
            <p className="text-xs text-stone-300">
              Redirecting you to the official event photo album...
            </p>
            <a
              href={targetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 w-full py-3.5 px-6 bg-rose-600 hover:bg-rose-500 text-white font-extrabold rounded-2xl shadow-lg transition-all text-xs"
            >
              <span>Open Event Photos Album</span>
              <ExternalLinkIcon className="w-4 h-4" />
            </a>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-amber-950/30 border border-amber-800/40 rounded-2xl text-xs text-amber-200/90 text-left space-y-1.5">
              <p className="font-bold flex items-center gap-1.5 text-amber-400">
                <SparklesIcon className="w-4 h-4" />
                <span>ફોટા તૈયાર થઈ રહ્યા છે (Photos Coming Soon)</span>
              </p>
              <p className="text-[11px] leading-relaxed text-stone-300">
                આ સેમિનારના હાઇ-રિઝોલ્યુશન ફોટા પ્રોસેસ થઈ રહ્યા છે. થોડા સમયમાં અહીં લિંક અપડેટ થઈ જશે.
              </p>
            </div>
            <a
              href="/#gallery"
              className="inline-flex items-center justify-center gap-2 w-full py-3 px-6 bg-stone-700 hover:bg-stone-600 text-white font-bold rounded-2xl transition-all text-xs"
            >
              <span>Explore Website Gallery</span>
              <span>→</span>
            </a>
          </div>
        )}

        <div className="pt-2 border-t border-stone-700/50">
          <p className="text-[10px] text-stone-500">
            Registration: <span className="font-mono text-stone-400">{inquiryId}</span> &bull; Ek Duje Ke Liye
          </p>
        </div>
      </div>
    </div>
  );
}
