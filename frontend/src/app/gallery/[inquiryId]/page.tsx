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
  Share2Icon,
  AlertTriangleIcon
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
      <div className="min-h-screen bg-gradient-to-b from-[#FFFDF9] via-[#FAF6F0] to-[#F5EFEB] flex flex-col items-center justify-center p-4 text-stone-900">
        <div className="w-10 h-10 border-4 border-rose-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-semibold text-stone-700">Loading your Digital Memories...</p>
      </div>
    );
  }

  if (error && !coupleName && !targetUrl) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#FFFDF9] via-[#FAF6F0] to-[#F5EFEB] flex flex-col items-center justify-center p-4 text-stone-900">
        <div className="max-w-md w-full bg-white border border-stone-200 rounded-3xl p-6 sm:p-8 text-center space-y-4 shadow-xl">
          <div className="w-14 h-14 bg-rose-50 text-rose-600 border border-rose-200 rounded-2xl flex items-center justify-center mx-auto">
            <AlertTriangleIcon className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-stone-900 tracking-tight">Memories Not Available</h2>
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
    <div className="min-h-screen bg-gradient-to-b from-[#FFFDF9] via-[#FAF6F0] to-[#F5EFEB] text-stone-900 py-8 px-4 sm:px-6 flex flex-col items-center justify-center select-none">
      
      {/* Luxury Photo Gallery Hub Container */}
      <div className="w-full max-w-xl bg-white text-stone-900 rounded-3xl shadow-2xl overflow-hidden border border-rose-100/80 flex flex-col transition-all">

        {/* Top Header Banner - Signature Celebration Gradient */}
        <div className="bg-gradient-to-r from-rose-700 via-rose-600 to-amber-700 text-white p-6 sm:p-8 text-center relative overflow-hidden">
          {/* Subtle Background Pattern Elements */}
          <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 rounded-full bg-white/10 blur-xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 -ml-8 -mb-8 w-32 h-32 rounded-full bg-amber-400/20 blur-xl pointer-events-none" />

          <div className="relative z-10 space-y-2">
            <div className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-md text-rose-100 border border-white/30 px-3.5 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-widest shadow-xs">
              <CameraIcon className="w-3.5 h-3.5" />
              <span>Event Digital Memories</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white drop-shadow-xs">
              EK DUJE KE LIYE
            </h1>
            <p className="text-xs sm:text-sm text-rose-100 font-medium max-w-sm mx-auto leading-relaxed">
              તમારી સાથે વિતાવેલી સુંદર પળોની અમૂલ્ય યાદો
            </p>
          </div>
        </div>

        {/* Main Body */}
        <div className="p-6 sm:p-8 space-y-6">

          {/* Couple Spotlight & Event Header */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 p-4 rounded-2xl bg-gradient-to-br from-rose-50/60 via-amber-50/40 to-stone-50 border border-rose-100/80 text-center sm:text-left">
            {couplePhoto ? (
              <img
                src={couplePhoto}
                alt="Couple"
                className="w-20 h-20 sm:w-22 sm:h-22 rounded-2xl object-cover border-2 border-rose-200 shadow-md flex-shrink-0"
              />
            ) : (
              <div className="w-20 h-20 sm:w-22 sm:h-22 rounded-2xl bg-gradient-to-br from-rose-100 to-amber-100 text-rose-700 font-black flex items-center justify-center flex-shrink-0 text-xl border-2 border-rose-200 shadow-md">
                EDKL
              </div>
            )}

            <div className="space-y-1.5 flex-1 min-w-0">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <span className="text-[10px] font-extrabold text-rose-700 bg-rose-100/70 border border-rose-200 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  Honored Couple
                </span>
                <span className="text-[10px] font-bold text-amber-900 bg-amber-100/70 border border-amber-200 px-2.5 py-0.5 rounded-full font-mono">
                  {inquiryId}
                </span>
              </div>

              <h2 className="text-lg sm:text-xl font-black text-stone-900 tracking-tight truncate">
                {coupleName || 'Respected Couple'}
              </h2>

              <p className="text-xs font-semibold text-stone-700 leading-snug">
                {eventName}
              </p>

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 text-[11px] text-stone-500 pt-0.5">
                {eventDate && (
                  <div className="flex items-center gap-1">
                    <CalendarIcon className="w-3.5 h-3.5 text-rose-600 flex-shrink-0" />
                    <span>{eventDate}</span>
                  </div>
                )}
                {eventVenue && (
                  <div className="flex items-center gap-1">
                    <MapPinIcon className="w-3.5 h-3.5 text-rose-600 flex-shrink-0" />
                    <span className="truncate max-w-[200px]">{eventVenue}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Heartfelt Appreciation Message */}
          <div className="p-4 sm:p-5 rounded-2xl bg-stone-50/80 border border-stone-200/80 text-center space-y-2">
            <p className="text-xs sm:text-sm font-bold text-stone-800 leading-relaxed">
              નમસ્તે <span className="text-rose-700">{coupleName || 'દંપતી'}</span>, એક દુજે કે લિયે કાર્યક્રમમાં જોડાવા બદલ આપનો દિલથી આભાર.
            </p>
            <p className="text-xs text-stone-600 leading-relaxed">
              તમારી સાથે વિતાવેલી સુંદર પળોની યાદો હવે તૈયાર છે. નીચે આપેલ બટન દ્વારા તમારા તમામ ફોટા જુઓ અને આ સુંદર સ્મૃતિઓને કાયમ માટે સાચવી રાખો.
            </p>
          </div>

          {/* Photo Album Access & Ucode Card */}
          {targetUrl ? (
            <div className="space-y-4">
              {/* Ucode Card if group code is present */}
              {groupCode && (
                <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50/60 border-2 border-amber-300/90 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-amber-900">
                      <SparklesIcon className="w-4 h-4 text-amber-600" />
                      <span className="text-xs font-black uppercase tracking-wider">
                        Album Access Code (Ucode)
                      </span>
                    </div>
                    <span className="text-[10px] font-extrabold text-amber-800 bg-amber-200/70 border border-amber-300 px-2 py-0.5 rounded-md">
                      BlinkPic Code
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3 bg-white p-3 rounded-xl border border-amber-200 shadow-xs">
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-semibold text-stone-400 block uppercase tracking-wider">
                        Your Secret Access Code
                      </span>
                      <span className="font-mono text-xl sm:text-2xl font-black text-amber-950 tracking-wider">
                        {groupCode}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={handleCopyCode}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-rose-600/20"
                    >
                      {copied ? (
                        <>
                          <CheckIcon className="w-4 h-4 text-emerald-300" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <span>Copy Code</span>
                      )}
                    </button>
                  </div>

                  <p className="text-[11px] text-stone-600 leading-relaxed">
                    👉 ફોટા જોવા માટે નીચેના બટન પર ક્લિક કરો. જો સાઇટ પર Ucode માંગે તો આ કોડ પેસ્ટ કરો.
                  </p>
                </div>
              )}

              {/* Primary Photo Album Open CTA */}
              <a
                href={targetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-4 px-6 bg-gradient-to-r from-rose-600 via-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 active:scale-[0.98] text-white font-black rounded-2xl shadow-xl shadow-rose-600/30 flex items-center justify-center gap-2.5 text-sm sm:text-base transition-all cursor-pointer"
              >
                <span>📸 Open Event Photo Album (Full Access)</span>
                <ExternalLinkIcon className="w-4 h-4" />
              </a>

              {/* WhatsApp Share Button */}
              <button
                type="button"
                onClick={handleShareAlbum}
                className="w-full py-3 px-4 bg-stone-100 hover:bg-stone-200 active:scale-[0.99] text-stone-800 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer border border-stone-200"
              >
                <Share2Icon className="w-4 h-4 text-emerald-600" />
                <span>Share Album Link on WhatsApp</span>
              </button>
            </div>
          ) : (
            /* Photos Coming Soon State */
            <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200 text-center space-y-3">
              <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center mx-auto">
                <SparklesIcon className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-black text-amber-950">
                ફોટા તૈયાર થઈ રહ્યા છે (Photos Processing)
              </h3>
              <p className="text-xs text-stone-600 leading-relaxed max-w-md mx-auto">
                સેમિનારના હાઇ-રિઝોલ્યુશન ફોટોગ્રાફ્સનું એડિટિંગ અને અપલોડિંગ ચાલી રહ્યું છે. ટૂંક સમયમાં જ અહીં આલ્બમ લિંક ઉપલબ્ધ થઈ જશે.
              </p>
            </div>
          )}

          {/* Dedicated Instagram Celebration & Tagging Card */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-fuchsia-50/70 via-rose-50/60 to-amber-50/50 border-2 border-rose-200/80 space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">📸</span>
                <span className="text-xs sm:text-sm font-black text-stone-900 tracking-tight">
                  Instagram Story & Reel Tagging
                </span>
              </div>
              <span className="text-[10px] font-black text-rose-700 bg-white border border-rose-200 px-2.5 py-0.5 rounded-full shadow-xs">
                #ekdujekeliye
              </span>
            </div>

            {/* Crucial Gujarati Instruction Requested by User */}
            <div className="p-3 bg-white/90 rounded-xl border border-rose-200/80 text-xs text-stone-800 leading-relaxed font-semibold">
              ✨ Instagram પર <span className="text-rose-600 font-black">@ekdujekeliye01</span> અને <span className="text-rose-600 font-black">@sai_photo_surat</span> ને ટેગ કરજો અને <span className="text-rose-600 font-black">#ekdujekeliye</span> સાથે તમારી સુંદર પળો શેર કરજો!
            </div>

            {/* Social Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <a
                href="https://www.instagram.com/ekdujekeliye01"
                target="_blank"
                rel="noopener noreferrer"
                className="py-2.5 px-3 bg-gradient-to-r from-fuchsia-600 to-rose-600 hover:from-fuchsia-700 hover:to-rose-700 text-white rounded-xl text-xs font-bold text-center flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-95"
              >
                <span>Follow @ekdujekeliye01</span>
                <ExternalLinkIcon className="w-3.5 h-3.5" />
              </a>

              <a
                href="https://www.instagram.com/sai_photo_surat?igsh=MTR1dDlpZ251NWx1Mw=="
                target="_blank"
                rel="noopener noreferrer"
                className="py-2.5 px-3 bg-white hover:bg-stone-50 border border-stone-300 text-stone-800 rounded-xl text-xs font-bold text-center flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-xs"
              >
                <span>Follow @sai_photo_surat</span>
                <ExternalLinkIcon className="w-3.5 h-3.5" />
              </a>
            </div>

            {/* Official Photographer Attribution */}
            <div className="flex items-center justify-between text-[11px] text-stone-500 pt-1 border-t border-rose-200/60">
              <span>Official Photography: <strong className="text-stone-700">Sai Photo Surat</strong> (Pradip Lakhani)</span>
              <a href="tel:+919898240505" className="font-bold text-rose-600 hover:text-rose-700">
                +91 98982 40505
              </a>
            </div>
          </div>

          {/* Heartfelt Post-Event Experience & Feedback Card */}
          <div className="p-4 sm:p-5 rounded-2xl bg-stone-50 border border-stone-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
            <div className="space-y-0.5">
              <div className="flex items-center justify-center sm:justify-start gap-1.5 text-rose-600 font-bold text-xs">
                <MessageCircleIcon className="w-4 h-4" />
                <span>તમારો અનુભવ કેવો રહ્યો?</span>
              </div>
              <p className="text-[11px] text-stone-600">
                કૃપા કરીને 2 મિનિટ ફાળવીને તમારો કિંમતી પ્રતિભાવ આપશો.
              </p>
            </div>

            <Link
              href={`/feedback/${encodeURIComponent(inquiryId)}`}
              className="py-2.5 px-4 bg-stone-900 hover:bg-stone-800 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all flex-shrink-0 active:scale-95"
            >
              <span>⭐ Give Feedback</span>
            </Link>
          </div>

          {/* Footer Signature */}
          <div className="pt-2 text-center text-[10px] text-stone-400 space-y-1">
            <p>
              Inquiry: <span className="font-mono font-bold text-stone-600">{inquiryId}</span> &bull; Ek Duje Ke Liye
            </p>
            <p className="text-[10px] text-stone-500">
              Couple Relationship Seminar &bull; Counselor Manish Vaghasiya
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
