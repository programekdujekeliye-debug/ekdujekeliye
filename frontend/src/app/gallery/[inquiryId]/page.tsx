'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { API_BASE_URL } from '@/config';
import {
  CameraIcon,
  ExternalLinkIcon,
  SparklesIcon,
  CheckIcon,
  CalendarIcon,
  MapPinIcon,
  MessageCircleIcon,
  TicketIcon,
  AlertTriangleIcon,
  Share2Icon
} from '@/components/Icons';

export default function GalleryRedirectPage() {
  const params = useParams();
  const rawInquiryId = (params?.inquiryId as string) || '';
  const inquiryId = decodeURIComponent(rawInquiryId).toUpperCase();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [targetUrl, setTargetUrl] = useState<string | null>(null);
  const [eventName, setEventName] = useState<string>('Ek Duje Ke Liye Seminar');
  const [eventDate, setEventDate] = useState<string>('');
  const [eventVenue, setEventVenue] = useState<string>('');
  const [coupleName, setCoupleName] = useState<string>('');
  const [couplePhoto, setCouplePhoto] = useState<string | null>(null);
  const [groupCode, setGroupCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!inquiryId) return;

    const fetchGallery = async () => {
      try {
        setLoading(true);
        setError(null);

        let res = await fetch(`${API_BASE_URL}/api/submissions/status/${encodeURIComponent(inquiryId)}`);
        if (!res.ok) {
          res = await fetch(`${API_BASE_URL}/api/registrations/status/${encodeURIComponent(inquiryId)}`);
        }

        if (res.ok) {
          const data = await res.json();
          const photoUrl = data.program?.photoLink || data.photoLink || (data.program as any)?.photoUrl || (data.program as any)?.customGalleryUrl;

          if (data.husbandName && data.wifeName) {
            setCoupleName(`${data.husbandName} & ${data.wifeName} ${data.surname || ''}`.trim());
          }
          if (data.couplePhoto) {
            setCouplePhoto(data.couplePhoto);
          }
          if (data.program?.name || data.programName) {
            setEventName(data.program?.name || data.programName);
          }
          if (data.program?.date || data.programDate) {
            setEventDate(data.program?.date || data.programDate);
          }
          if (data.program?.venue || data.venue) {
            setEventVenue(data.program?.venue || data.venue);
          }

          if (photoUrl && String(photoUrl).trim()) {
            const cleanUrl = String(photoUrl).trim();
            setTargetUrl(cleanUrl);

            // Detect groupCode or ucode in query string (e.g. groupCode=X5ZHM6 or ucode=X5ZHM6)
            const codeMatch = cleanUrl.match(/[?&](?:groupCode|ucode|code)=([A-Za-z0-9_-]+)/i);
            if (codeMatch && codeMatch[1]) {
              setGroupCode(codeMatch[1]);
            }
          }
        } else {
          setError('Registration record not found.');
        }
      } catch (err: any) {
        console.warn('Failed to resolve custom event gallery:', err);
        setError(err.message || 'Failed to load photo album.');
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

  const handleShareAlbum = () => {
    if (!targetUrl) return;
    const shareText = encodeURIComponent(
      `એક દુજે કે લિયે સેમિનારના ફોટા જુઓ!\n\n` +
      `Couple: ${coupleName || 'Respected Couple'}\n` +
      `Registration ID: ${inquiryId}\n` +
      (groupCode ? `Album Ucode: ${groupCode}\n\n` : '\n') +
      `ફોટો આલ્બમ લિંક:\n${window.location.href}`
    );
    window.open(`https://api.whatsapp.com/send?text=${shareText}`, '_blank');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] flex flex-col items-center justify-center p-4 text-stone-900">
        <div className="w-10 h-10 border-4 border-rose-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-semibold text-stone-700">Loading your Digital Memories...</p>
      </div>
    );
  }

  if (error && !coupleName && !targetUrl) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] flex flex-col items-center justify-center p-4 text-stone-900">
        <div className="max-w-md w-full bg-white border border-stone-200 rounded-3xl p-6 sm:p-8 text-center space-y-4 shadow-xl">
          <div className="w-14 h-14 bg-rose-50 text-rose-600 border border-rose-200 rounded-2xl flex items-center justify-center mx-auto">
            <AlertTriangleIcon className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-stone-900 tracking-tight">Gallery Not Available</h2>
          <p className="text-sm text-stone-600 leading-relaxed">
            {error || 'The requested digital memories could not be loaded for this registration ID.'}
          </p>
          <div className="pt-2">
            <Link
              href="/"
              className="inline-block px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-rose-600/20"
            >
              Return to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-stone-900 flex flex-col items-center justify-center p-3 sm:p-6 select-none">
      {/* Mobile-First Elegant Container Matching Pass & Invitation Theme */}
      <div className="w-full max-w-md bg-white text-stone-900 rounded-3xl shadow-2xl overflow-hidden border border-stone-200/90 flex flex-col">

        {/* Top Header Banner - Signature Brand Gradient */}
        <div className="bg-gradient-to-r from-rose-700 via-rose-600 to-amber-700 text-white p-5 sm:p-6 text-center relative">
          <div className="flex items-center justify-center gap-1.5 text-[10px] font-extrabold uppercase tracking-widest text-rose-200 mb-1">
            <CameraIcon className="w-3.5 h-3.5" />
            <span>Digital Memories & Photo Album</span>
          </div>
          <h1 className="text-lg sm:text-xl font-black tracking-tight leading-tight">EK DUJE KE LIYE</h1>
          <p className="text-xs text-rose-100 font-medium mt-0.5">A Special Program for Couples</p>

          {/* Status Badge */}
          <div className="flex items-center justify-center gap-2 mt-3">
            <div className="inline-flex items-center gap-1.5 bg-emerald-500 text-white px-3.5 py-1 rounded-full text-[11px] font-extrabold tracking-wide uppercase shadow-xs">
              <SparklesIcon className="w-3.5 h-3.5" />
              <span>PHOTOS ARE READY</span>
            </div>
          </div>
        </div>

        {/* Body Section */}
        <div className="p-5 sm:p-6 flex flex-col items-center text-center space-y-4">

          {/* Hero Registration Identifier Box */}
          <div className="w-full bg-amber-50 border-2 border-amber-300 rounded-2xl p-3.5 text-center shadow-xs">
            <span className="text-[11px] font-black text-amber-900 uppercase tracking-widest block">
              REGISTRATION ID
            </span>
            <div className="text-2xl sm:text-3xl font-black tracking-tight text-amber-950 my-0.5">
              {inquiryId}
            </div>
            <span className="text-[10px] text-amber-800/80 font-semibold block">
              Your personal couple memory portal
            </span>
          </div>

          {/* Couple Profile Card */}
          <div className="flex items-center gap-3 bg-stone-50 border border-stone-200/80 rounded-2xl p-3 w-full text-left">
            {couplePhoto ? (
              <img
                src={couplePhoto}
                alt="Couple"
                className="w-12 h-12 rounded-xl object-cover border border-stone-300 flex-shrink-0"
              />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-rose-100 to-amber-100 text-rose-700 font-black flex items-center justify-center flex-shrink-0 text-sm border border-rose-200">
                EDKL
              </div>
            )}
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-extrabold text-rose-700 uppercase tracking-wider block">
                Honored Couple
              </span>
              <h2 className="text-sm font-bold text-stone-900 truncate">
                {coupleName || 'Respected Couple'}
              </h2>
              {eventVenue && (
                <div className="flex items-center gap-1 text-[11px] text-stone-500 truncate mt-0.5">
                  <MapPinIcon className="w-3 h-3 text-rose-600 flex-shrink-0" />
                  <span className="truncate">{eventVenue}</span>
                </div>
              )}
            </div>
          </div>

          {/* Event Details Card */}
          <div className="w-full bg-stone-50/70 border border-stone-200/60 rounded-2xl p-3 text-left space-y-1 text-xs text-stone-700">
            <div className="font-bold text-stone-900 text-xs leading-snug">
              {eventName}
            </div>
            {eventDate && (
              <div className="flex items-center gap-1.5 text-[11px] text-stone-600">
                <CalendarIcon className="w-3.5 h-3.5 text-rose-600 flex-shrink-0" />
                <span>{eventDate}</span>
              </div>
            )}
          </div>

          {/* Album Access Code Box (Ucode) */}
          {targetUrl ? (
            <div className="w-full space-y-3.5">
              {groupCode && (
                <div className="w-full bg-amber-50/70 border-2 border-amber-300/80 rounded-2xl p-4 text-left space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase tracking-wider text-amber-900">
                      Album Access Code (Ucode)
                    </span>
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-200/60 px-2 py-0.5 rounded-md">
                      BlinkPic Code
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 bg-white px-3.5 py-2.5 rounded-xl border border-amber-200 shadow-xs">
                    <span className="font-mono text-lg font-black text-amber-950 tracking-wider">
                      {groupCode}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyCode}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-xs active:scale-95"
                    >
                      {copied ? (
                        <>
                          <CheckIcon className="w-3.5 h-3.5 text-emerald-300" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <span>Copy Code</span>
                      )}
                    </button>
                  </div>

                  <p className="text-[11px] text-stone-600 leading-relaxed font-medium">
                    તમારા સુંદર ફોટા જોવા માટે નીચે આપેલા બટન પર ક્લિક કરો. જો સાઇટ પર Ucode માંગે તો ઉપરનો કોડ પેસ્ટ કરો.
                  </p>
                </div>
              )}

              {/* Primary Glowing Action Button */}
              <a
                href={targetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-4 px-6 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 text-white font-black rounded-2xl shadow-lg shadow-rose-600/30 flex items-center justify-center gap-2 text-sm transition-all transform active:scale-[0.98] cursor-pointer"
              >
                <span>Open Photos (Full Access)</span>
                <ExternalLinkIcon className="w-4 h-4" />
              </a>

              {/* Share Button */}
              <button
                type="button"
                onClick={handleShareAlbum}
                className="w-full py-2.5 px-4 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Share2Icon className="w-3.5 h-3.5 text-rose-600" />
                <span>Share Album Link on WhatsApp</span>
              </button>

              {/* Official Photographer Credits Card */}
              <div className="w-full bg-gradient-to-br from-stone-50 to-stone-100 border border-stone-200 rounded-2xl p-4 text-left space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-base">📸</span>
                    <span className="text-xs font-black text-stone-900 uppercase tracking-wide">
                      Sai Photo Surat
                    </span>
                  </div>
                  <span className="text-[10px] font-extrabold text-rose-700 uppercase bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                    Official Partner
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs text-stone-600">
                  <span>Pradip Lakhani</span>
                  <a
                    href="tel:+919898240505"
                    className="font-bold text-rose-600 hover:text-rose-700"
                  >
                    +91 98982 40505
                  </a>
                </div>

                <div className="flex gap-2 pt-1">
                  <a
                    href="https://www.instagram.com/sai_photo_surat?igsh=MTR1dDlpZ251NWx1Mw=="
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-2 px-3 bg-gradient-to-r from-fuchsia-600 to-rose-600 hover:from-fuchsia-700 hover:to-rose-700 text-white rounded-xl text-[11px] font-bold text-center flex items-center justify-center gap-1 shadow-xs transition-all"
                  >
                    <span>Follow @sai_photo_surat</span>
                    <ExternalLinkIcon className="w-3 h-3" />
                  </a>
                </div>

                <div className="bg-white/80 p-2.5 rounded-xl border border-stone-200 text-[10px] text-stone-500 leading-snug">
                  ✨ <span className="font-bold text-stone-700">Instagram Story Tip:</span> Tag <span className="text-rose-600 font-bold">@sai_photo_surat</span> and <span className="text-rose-600 font-bold">#EkDujeKeLiye</span> when posting your photos!
                </div>
              </div>
            </div>
          ) : (
            /* Photos Coming Soon State */
            <div className="w-full space-y-3">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 text-left space-y-1.5">
                <p className="font-bold flex items-center gap-1.5 text-amber-800">
                  <SparklesIcon className="w-4 h-4 text-amber-600" />
                  <span>ફોટા તૈયાર થઈ રહ્યા છે (Photos Processing)</span>
                </p>
                <p className="text-[11px] leading-relaxed text-stone-600">
                  તમારા સેમિનારના હાઇ-રિઝોલ્યુશન ફોટોગ્રાફ્સનું એડિટિંગ ચાલી રહ્યું છે. ટૂંક સમયમાં આ લિંક પર ઉપલબ્ધ થઈ જશે.
                </p>
              </div>

              <Link
                href="/#gallery"
                className="inline-flex items-center justify-center gap-2 w-full py-3.5 px-6 bg-stone-900 hover:bg-stone-800 text-white font-bold rounded-2xl transition-all text-xs shadow-md"
              >
                <span>Explore Website Highlights</span>
                <span>→</span>
              </Link>
            </div>
          )}

          {/* Quick Hub Navigation (Feedback, Pass, Invitation) */}
          <div className="w-full pt-2 border-t border-stone-100 flex items-center justify-around gap-2 text-xs">
            <Link
              href={`/feedback/${encodeURIComponent(inquiryId)}`}
              className="flex items-center gap-1 text-rose-600 hover:text-rose-700 font-bold text-[11px] py-1 px-2 rounded-lg hover:bg-rose-50 transition-colors"
            >
              <MessageCircleIcon className="w-3.5 h-3.5" />
              <span>Feedback</span>
            </Link>
            <span className="text-stone-300">&bull;</span>
            <Link
              href={`/pass/${encodeURIComponent(inquiryId)}`}
              className="flex items-center gap-1 text-stone-600 hover:text-stone-900 font-bold text-[11px] py-1 px-2 rounded-lg hover:bg-stone-100 transition-colors"
            >
              <TicketIcon className="w-3.5 h-3.5" />
              <span>Digital Pass</span>
            </Link>
            <span className="text-stone-300">&bull;</span>
            <Link
              href={`/invitation/${encodeURIComponent(inquiryId)}`}
              className="flex items-center gap-1 text-stone-600 hover:text-stone-900 font-bold text-[11px] py-1 px-2 rounded-lg hover:bg-stone-100 transition-colors"
            >
              <SparklesIcon className="w-3.5 h-3.5" />
              <span>Invitation</span>
            </Link>
          </div>

          {/* Footer Note */}
          <div className="pt-2 border-t border-stone-100 w-full">
            <p className="text-[10px] text-stone-400">
              Pass / Inquiry: <span className="font-mono font-bold text-stone-600">{inquiryId}</span> &bull; Ek Duje Ke Liye
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
