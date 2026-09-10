'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { API_BASE_URL } from '../../config';
import {
  SparklesIcon,
  TicketIcon,
  CheckCircleIcon,
  CameraIcon,
  UploadIcon,
  CalendarIcon,
  ClockIcon,
  MapPinIcon,
  AlertTriangleIcon,
  CheckIcon,
  HeartHandshakeIcon,
  LockIcon,
  UsersIcon,
  RefreshCwIcon
} from '../../components/Icons';
import toast from 'react-hot-toast';
import { formatToDDMMYYYY } from '../../utils/dateFormat';

// Client-side image compression helper matching main event registration
const compressImage = (file: File, maxWidth = 1200, maxHeight = 1200, quality = 0.8): Promise<File> => {
  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => resolve(file), 4000);
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            clearTimeout(timeoutId);
            return resolve(file);
          }

          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob(
            (blob) => {
              clearTimeout(timeoutId);
              if (blob) {
                try {
                  const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
                    type: 'image/jpeg',
                    lastModified: Date.now()
                  });
                  resolve(compressedFile);
                } catch {
                  const fallbackBlob: any = blob;
                  fallbackBlob.name = file.name;
                  fallbackBlob.lastModified = Date.now();
                  resolve(fallbackBlob as File);
                }
              } else {
                resolve(file);
              }
            },
            'image/jpeg',
            quality
          );
        } catch {
          clearTimeout(timeoutId);
          resolve(file);
        }
      };
      img.onerror = () => {
        clearTimeout(timeoutId);
        resolve(file);
      };
    };
    reader.onerror = () => {
      clearTimeout(timeoutId);
      resolve(file);
    };
  });
};

function VipEntryContent() {
  const searchParams = useSearchParams();
  const rawCode = (searchParams.get('code') || '').trim().toLowerCase();

  const [loadingLink, setLoadingLink] = useState(true);
  const [linkInfo, setLinkInfo] = useState<{
    found: boolean;
    isOpen: boolean;
    status: 'ACTIVE' | 'HOUSEFULL' | 'CLOSED';
    code?: string;
    name?: string;
    category?: string;
    sponsorName?: string;
    programId?: string;
    programName?: string;
    programDate?: string;
    programTime?: string;
    venue?: string;
    city?: string;
    maxSeats?: number;
    usedSeats?: number;
    approvedSeats?: number;
    remainingSeats?: number | null;
    message?: string;
    error?: string;
  } | null>(null);

  const [husbandName, setHusbandName] = useState('');
  const [wifeName, setWifeName] = useState('');
  const [surname, setSurname] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [couplePhoto, setCouplePhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submittedData, setSubmittedData] = useState<{
    inquiryId: string;
    husbandName: string;
    wifeName: string;
    status: string;
    programName?: string;
    programDate?: string;
    venue?: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Check VIP link status and capacity on load
  const fetchLinkStatus = async () => {
    if (!rawCode) {
      setLoadingLink(false);
      setLinkInfo({
        found: false,
        isOpen: false,
        status: 'CLOSED',
        error: 'કૃપા કરીને આયોજકો દ્વારા આપેલ માન્ય VIP આમંત્રણ લિંકનો ઉપયોગ કરો (VIP Invitation Link required).'
      });
      return;
    }

    try {
      setLoadingLink(true);
      const res = await fetch(`${API_BASE_URL}/api/vip-links/check?code=${encodeURIComponent(rawCode)}`);
      const data = await res.json();
      setLinkInfo(data);
    } catch {
      setLinkInfo({
        found: true,
        isOpen: false,
        status: 'HOUSEFULL',
        message: 'VIP બેઠકો પૂર્ણ થઈ ગયેલ છે (Housefull).'
      });
    } finally {
      setLoadingLink(false);
    }
  };

  useEffect(() => {
    fetchLinkStatus();
  }, [rawCode]);

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const originalFile = e.target.files[0];
      if (originalFile.size > 20 * 1024 * 1024) {
        toast.error('ફોટો 20MB કરતાં નાનો હોવો જોઈએ (Photo must be under 20MB)');
        return;
      }

      try {
        const compressed = await compressImage(originalFile);
        setCouplePhoto(compressed);
        const reader = new FileReader();
        reader.onload = () => setPhotoPreview(reader.result as string);
        reader.readAsDataURL(compressed);
      } catch {
        setCouplePhoto(originalFile);
        const reader = new FileReader();
        reader.onload = () => setPhotoPreview(reader.result as string);
        reader.readAsDataURL(originalFile);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!linkInfo?.isOpen) {
      setErrorMessage('આ લિંક પર રજીસ્ટ્રેશન બંધ છે (Housefull).');
      return;
    }

    const cleanH = husbandName.trim();
    const cleanW = wifeName.trim();
    const cleanP = phoneNumber.trim().replace(/\D/g, '').slice(-10);

    if (!cleanH || !cleanW) {
      setErrorMessage('કૃપા કરીને પતિ અને પત્ની બંનેનું નામ દાખલ કરો! (Please enter both Husband & Wife names)');
      return;
    }

    if (!cleanP || cleanP.length !== 10) {
      setErrorMessage('કૃપા કરીને ૧૦-આંકડાનો સાચો મોબાઇલ નંબર દાખલ કરો! (Please enter a valid 10-digit phone number)');
      return;
    }

    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('husbandName', cleanH);
      formData.append('wifeName', cleanW);
      formData.append('surname', surname.trim());
      formData.append('phoneNumber', cleanP);
      formData.append('programId', linkInfo?.programId || '');
      formData.append('linkCode', rawCode);
      if (couplePhoto) {
        formData.append('couplePhoto', couplePhoto);
      }

      const res = await fetch(`${API_BASE_URL}/api/vip/submit`, {
        method: 'POST',
        body: formData
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.housefull) {
          fetchLinkStatus();
        }
        throw new Error(data.error || 'VIP પાસ વિનંતી સબમિટ કરવામાં સમસ્યા આવી. કૃપા કરીને ફરી પ્રયાસ કરો.');
      }

      setSubmittedData({
        inquiryId: data.inquiryId,
        husbandName: data.husbandName || cleanH,
        wifeName: data.wifeName || cleanW,
        status: data.status || 'pending',
        programName: data.programName || linkInfo?.programName || 'Ek Duje Ke Liye',
        programDate: data.programDate || linkInfo?.programDate || '',
        venue: linkInfo?.venue || ''
      });

      toast.success('VIP પાસ વિનંતી સફળતાપૂર્વક નોંધાઈ ગઈ છે!');
      fetchLinkStatus();
    } catch (err: any) {
      setErrorMessage(err.message || 'VIP પાસ નોંધણી નિષ્ફળ ગઈ. કૃપા કરીને ફરી પ્રયત્ન કરો.');
    } finally {
      setSubmitting(false);
    }
  };

  const getCategoryBadgeLabel = () => {
    switch (linkInfo?.category) {
      case 'TITLE_SPONSOR':
        return '🏆 Title Sponsor VIP Pass';
      case 'POWERED_BY':
        return '⚡ Powered By Sponsor VIP Pass';
      case 'CO_POWERED_BY':
        return '🤝 Co-Powered By Sponsor VIP Pass';
      case 'SUPPORTED_BY':
        return '🎖️ Supported By Sponsor VIP Pass';
      case 'VIP_GUEST':
        return '🌟 Special VIP Guest Pass';
      default:
        return linkInfo?.name || 'VIP Special Guest Pass';
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-stone-900 font-sans flex flex-col justify-between selection:bg-rose-500/20 selection:text-rose-900 relative overflow-x-hidden">
      
      {/* Subtle Warm Luxury Ambient Glows */}
      <div 
        className="fixed inset-0 pointer-events-none z-0 opacity-70"
        style={{
          backgroundImage: `
            radial-gradient(ellipse 65% 55% at 25% 10%, rgba(254, 205, 211, 0.45) 0%, transparent 70%),
            radial-gradient(ellipse 55% 45% at 85% 35%, rgba(254, 243, 199, 0.45) 0%, transparent 70%),
            radial-gradient(ellipse 60% 50% at 10% 85%, rgba(254, 215, 170, 0.35) 0%, transparent 70%)
          `,
          willChange: 'transform',
          transform: 'translateZ(0)'
        }}
      />

      {/* Official Website Header */}
      <header className="py-4 px-6 md:px-12 border-b border-stone-200 bg-white/90 backdrop-blur-md sticky top-0 z-50 shadow-xs">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <Link href="/" className="flex items-center gap-3 group">
            <img
              src="/logo.png"
              alt="Ek Duje Ke Liye Logo"
              className="h-10 md:h-11 w-auto object-contain transition-transform group-hover:scale-105"
            />
            <div>
              <span className="text-lg md:text-xl font-extrabold tracking-wider text-stone-900 uppercase block leading-tight">
                Ek Duje Ke Liye
              </span>
              <span className="text-[10px] tracking-widest text-rose-700 font-bold uppercase block">
                by Manish Vaghasiya
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-xs text-rose-700 hover:text-rose-800 font-bold border border-rose-300 hover:bg-rose-50 px-4 py-2 rounded-xl transition-all"
            >
              ← All Events
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-grow max-w-6xl mx-auto px-4 sm:px-6 py-8 md:py-12 w-full z-10">

        {/* Loading Link Status Skeleton */}
        {loadingLink ? (
          <div className="py-24 text-center space-y-4 max-w-md mx-auto">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto animate-spin">
              <RefreshCwIcon className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-stone-600">VIP લિંક ચકાસાઈ રહી છે... (Checking VIP Status)</p>
          </div>
        ) : !rawCode || !linkInfo?.found ? (
          /* ========================================================================= */
          /* 🔒 INVITATION REQUIRED SCREEN: When no valid code is provided in URL */
          /* ========================================================================= */
          <div className="max-w-2xl mx-auto bg-white border border-stone-200 rounded-3xl p-6 sm:p-10 md:p-12 shadow-2xl text-center space-y-6 animate-fade-in relative overflow-hidden">
            <div className="w-20 h-20 rounded-3xl bg-amber-50 border-2 border-amber-200 flex items-center justify-center mx-auto shadow-inner text-amber-700">
              <SparklesIcon className="w-10 h-10 text-amber-600" />
            </div>

            <div className="space-y-3">
              <span className="inline-block px-3.5 py-1 bg-amber-100 text-amber-900 border border-amber-300 text-xs font-black rounded-full uppercase tracking-wider">
                VIP Invitation Only &bull; ખાસ આમંત્રિત મહેમાનો માટે
              </span>
              <h1 className="text-2xl sm:text-3xl font-black text-stone-900">
                વિશેષ VIP આમંત્રણ લિંક જરૂરી છે
              </h1>
              <p className="text-xs sm:text-sm text-stone-600 max-w-md mx-auto font-medium leading-relaxed">
                આ પેજ ફક્ત સ્પોન્સર્સ અને ખાસ આમંત્રિત મહેમાનો માટે છે. કૃપા કરીને આયોજકો અથવા સ્પોન્સર તરફથી આપેલ પર્સનલ VIP લિંકનો ઉપયોગ કરો.
              </p>
            </div>

            <div className="pt-4 flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/"
                className="py-3.5 px-6 bg-stone-900 hover:bg-stone-800 text-white font-bold rounded-2xl text-xs sm:text-sm transition-all shadow-md"
              >
                મુખ્ય વેબસાઇટ પર જાઓ (Home)
              </Link>
              <a
                href="tel:+918200302328"
                className="py-3.5 px-6 border border-stone-300 hover:bg-stone-100 text-stone-700 font-bold rounded-2xl text-xs sm:text-sm transition-all"
              >
                આયોજક ટીમનો સંપર્ક (+91 82003 02328)
              </a>
            </div>
          </div>
        ) : !linkInfo?.isOpen ? (
          /* ========================================================================= */
          /* 🛑 HOUSEFULL / CLOSED SCREEN: Dynamic Branded Aesthetic */
          /* ========================================================================= */
          <div className="max-w-2xl mx-auto bg-white border border-rose-200/90 rounded-3xl p-6 sm:p-10 md:p-12 shadow-2xl text-center space-y-7 animate-fade-in relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-rose-600 via-amber-500 to-rose-600" />

            <div className="relative inline-block">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-rose-50 border-2 border-rose-200 flex items-center justify-center mx-auto shadow-inner">
                <LockIcon className="w-10 h-10 sm:w-12 sm:h-12 text-rose-600" />
              </div>
              <span className="absolute -bottom-2 -right-2 px-2.5 py-0.5 bg-rose-600 text-white text-[10px] font-black rounded-full uppercase tracking-wider shadow-md">
                CLOSED
              </span>
            </div>

            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-rose-100 text-rose-900 border border-rose-300 font-black text-xs tracking-wider uppercase shadow-xs">
                <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping" />
                <span>HOUSEFULL &bull; બેઠકો પૂર્ણ થયેલ છે</span>
              </div>

              <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-stone-900 tracking-tight leading-tight">
                {linkInfo.name || 'આ લિંક પર'} VIP રજીસ્ટ્રેશન પૂર્ણ થયેલ છે
              </h1>

              <p className="text-xs sm:text-sm text-stone-600 max-w-md mx-auto font-medium leading-relaxed">
                આદરણીય મહેમાનો, <strong>{linkInfo.programName || 'એક દુજે કે લિયે'}</strong> કાર્યક્રમ માટે આ VIP લિંક પર ફાળવેલ તમામ બેઠકો પૂર્ણ (Housefull) થઈ ગયેલ છે.
              </p>
            </div>

            {/* Event Details Notice Box */}
            <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-5 text-left space-y-2 text-xs sm:text-sm text-amber-950">
              <div className="flex items-center gap-2 font-black text-amber-900 text-xs sm:text-sm">
                <AlertTriangleIcon className="w-4 h-4 text-amber-700 flex-shrink-0" />
                <span>નવી VIP એન્ટ્રી નોંધણી હાલ બંધ છે</span>
              </div>
              <p className="text-stone-700 text-xs leading-relaxed">
                બેઠક ક્ષમતાના નિયમો મુજબ ફાળવેલી તમામ VIP પાસ બેઠકો ભરાઈ ગઈ હોવાથી નવી અરજી સ્વીકારવામાં આવતી નથી.
              </p>
              <div className="pt-2 border-t border-amber-200/80 flex flex-col sm:flex-row justify-between gap-1 text-[11px] text-stone-600">
                <span>📍 {linkInfo.venue || linkInfo.city || 'Event Venue'}</span>
                <span>🗓️ {formatToDDMMYYYY(linkInfo.programDate)} • {linkInfo.programTime}</span>
              </div>
            </div>

            <div className="pt-3 flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/"
                className="py-3.5 px-6 bg-stone-900 hover:bg-stone-800 text-white font-bold rounded-2xl text-xs sm:text-sm transition-all shadow-md flex items-center justify-center gap-2"
              >
                <span>મુખ્ય પેજ પર જાઓ (Return to Home)</span>
              </Link>
              <a
                href="tel:+918200302328"
                className="py-3.5 px-6 border border-stone-300 hover:bg-stone-100 text-stone-700 font-bold rounded-2xl text-xs sm:text-sm transition-all flex items-center justify-center gap-2"
              >
                <span>આયોજક ટીમનો સંપર્ક (+91 82003 02328)</span>
              </a>
            </div>
          </div>
        ) : submittedData ? (
          /* ========================================================================= */
          /* Submitted Success View */
          /* ========================================================================= */
          <div className="bg-white border border-rose-200 rounded-3xl p-6 sm:p-10 md:p-12 shadow-2xl text-center space-y-6 max-w-2xl mx-auto animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto text-3xl font-bold shadow-sm">
              <CheckCircleIcon className="w-9 h-9 text-emerald-600" />
            </div>

            <div className="space-y-2">
              <span className="px-3.5 py-1 bg-amber-50 text-amber-800 border border-amber-300 text-xs font-extrabold rounded-full uppercase tracking-wider inline-block">
                ⏳ મંજૂરી પ્રક્રિયામાં &bull; Pending Approval
              </span>
              <h2 className="text-2xl md:text-3xl font-extrabold text-stone-900">
                VIP પાસ વિનંતી સફળતાપૂર્વક નોંધાઈ ગઈ છે!
              </h2>
              <p className="text-xs sm:text-sm text-stone-600 font-medium max-w-md mx-auto">
                નમસ્તે <strong className="text-stone-900 font-bold">{submittedData.husbandName} &amp; {submittedData.wifeName}</strong>, તમારી VIP એન્ટ્રી વિનંતી સિસ્ટમમાં નોંધાઈ ગઈ છે.
              </p>
            </div>

            {/* Inquiry ID Badge */}
            <div className="bg-gradient-to-r from-amber-50 via-rose-50 to-amber-50 border border-amber-300 rounded-2xl p-5 text-center space-y-1.5 shadow-inner">
              <span className="text-[11px] font-bold text-amber-900 uppercase tracking-widest block">
                તમારો VIP નોંધણી નંબર (Inquiry ID)
              </span>
              <div className="text-3xl sm:text-4xl font-extrabold text-amber-700 tracking-tight font-mono select-all">
                {submittedData.inquiryId}
              </div>
              <p className="text-xs text-stone-600 font-medium">
                આયોજક (Organizer) દ્વારા મંજૂરી મળતાં જ તમારો એન્ટ્રી પાસ સક્રિય થઈ જશે.
              </p>
            </div>

            {/* Event Summary Box */}
            <div className="bg-stone-50 border border-stone-200 rounded-2xl p-5 text-left space-y-2 text-xs sm:text-sm">
              <div className="flex justify-between">
                <span className="text-stone-500 font-medium">કાર્યક્રમ (Event):</span>
                <span className="font-bold text-stone-900">{submittedData.programName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500 font-medium">તારીખ અને સમય:</span>
                <span className="font-semibold text-stone-900">{formatToDDMMYYYY(submittedData.programDate)}</span>
              </div>
              {submittedData.venue && (
                <div className="flex justify-between">
                  <span className="text-stone-500 font-medium">સ્થળ (Venue):</span>
                  <span className="font-semibold text-stone-900">{submittedData.venue}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-stone-200 pt-2">
                <span className="text-stone-500 font-medium">આમંત્રણ પ્રકાર:</span>
                <span className="font-bold text-rose-700">{getCategoryBadgeLabel()}</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href={`/pass/${submittedData.inquiryId}`}
                className="flex-1 py-3.5 px-6 bg-gradient-to-r from-rose-600 via-rose-500 to-amber-600 hover:from-rose-700 hover:to-amber-700 text-white font-bold rounded-2xl text-xs sm:text-sm transition-all shadow-md shadow-rose-600/20 flex items-center justify-center gap-2 cursor-pointer"
              >
                <TicketIcon className="w-4 h-4" />
                <span>ચેક પાસ સ્ટેટસ (View Pass)</span>
              </Link>

              <button
                type="button"
                onClick={() => {
                  setSubmittedData(null);
                  setHusbandName('');
                  setWifeName('');
                  setSurname('');
                  setPhoneNumber('');
                  setCouplePhoto(null);
                  setPhotoPreview(null);
                }}
                className="py-3.5 px-6 border border-stone-300 hover:bg-stone-100 text-stone-700 font-bold rounded-2xl text-xs sm:text-sm transition-all cursor-pointer"
              >
                બીજી VIP નોંધણી કરો (New Entry)
              </button>
            </div>
          </div>
        ) : (
          /* ========================================================================= */
          /* Dynamic Registration Form View (When Link is Open/Active) */
          /* ========================================================================= */
          <div className="space-y-6">
            {/* Sponsor / VIP Category Top Banner */}
            <div className="bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-amber-500/10 border border-amber-300/80 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">✨</span>
                <div>
                  <span className="text-[11px] font-black uppercase tracking-wider text-amber-900 block">
                    {getCategoryBadgeLabel()}
                  </span>
                  <span className="text-xs font-bold text-stone-700">
                    {linkInfo.sponsorName ? `Reserved for ${linkInfo.sponsorName}` : linkInfo.name}
                  </span>
                </div>
              </div>
              {linkInfo.maxSeats && linkInfo.maxSeats > 0 ? (
                <span className="px-3 py-1 bg-amber-200/90 rounded-lg text-amber-950 font-black text-xs self-end sm:self-center">
                  {linkInfo.remainingSeats ?? 0} બેઠકો બાકી (Remaining)
                </span>
              ) : null}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* Left Column: Dynamic Event & VIP Info Card */}
              <div className="lg:col-span-5 bg-white border border-stone-200/90 rounded-3xl p-6 md:p-8 shadow-xl space-y-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold text-rose-700 uppercase tracking-widest block">
                      {linkInfo.city || 'Gujarat'}
                    </span>
                    <span className="px-2.5 py-0.5 bg-amber-50 border border-amber-300 text-amber-900 text-[10px] font-bold rounded-md uppercase tracking-wider">
                      VIP Invitation
                    </span>
                  </div>
                  <h2 className="text-xl md:text-2xl font-extrabold text-stone-900 leading-tight">
                    {linkInfo.programName || 'એક દુજે કે લિયે'}
                  </h2>
                  <p className="text-xs text-stone-500 mt-1 font-medium">
                    સંબંધોમાં સંવાદ, પ્રેમ અને આત્મીયતાનો અદભુત પરિસંવાદ &bull; મનીષ વઘાસીયા
                  </p>
                </div>

                {/* Seminar Schedule Details */}
                <div className="space-y-4 pt-2 text-sm border-t border-stone-100">
                  <div className="flex items-center gap-3 text-stone-700">
                    <CalendarIcon className="w-5 h-5 text-rose-600 flex-shrink-0" />
                    <div>
                      <span className="text-xs text-stone-500 block font-medium">તારીખ (Date)</span>
                      <span className="font-semibold text-stone-900">{formatToDDMMYYYY(linkInfo.programDate) || 'Event Date'}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-stone-700">
                    <ClockIcon className="w-5 h-5 text-amber-600 flex-shrink-0" />
                    <div>
                      <span className="text-xs text-stone-500 block font-medium">સમય (Time)</span>
                      <span className="font-semibold text-stone-900">{linkInfo.programTime || '8:30 PM'}</span>
                    </div>
                  </div>

                  {linkInfo.venue && (
                    <div className="flex items-start gap-3 text-stone-700">
                      <MapPinIcon className="w-5 h-5 text-stone-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <span className="text-xs text-stone-500 block font-medium">સ્થળ (Venue)</span>
                        <span className="font-semibold text-stone-900">{linkInfo.venue}</span>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-3 text-stone-700">
                    <TicketIcon className="w-5 h-5 text-amber-600 flex-shrink-0" />
                    <div>
                      <span className="text-xs text-stone-500 block font-medium">પાસ પ્રકાર (Pass Type)</span>
                      <span className="font-extrabold text-amber-700 text-lg">
                        માનવંત અતિથિ પાસ (Complimentary VIP)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Guidelines Card */}
                <div className="bg-rose-50 border border-rose-200/80 rounded-2xl p-4 text-xs text-rose-900 space-y-2">
                  <p className="font-bold flex items-center gap-1.5 text-rose-950">
                    <span>📌</span>
                    <span>મહત્વની સૂચનાઓ (Important Guidelines):</span>
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-stone-700 font-medium pl-1">
                    <li>આ સેમિનાર ફક્ત પરિણીત યુગલો (Couples) માટે છે.</li>
                    <li>બાળકોને પ્રવેશ મળશે નહીં (Strictly No Kids).</li>
                    <li>એન્ટ્રી પાસ ફક્ત આયોજક દ્વારા મંજૂરી બાદ જ એક્ટિવ થશે.</li>
                  </ul>
                </div>
              </div>

              {/* Right Column: Registration Form */}
              <div className="lg:col-span-7 bg-white border border-stone-200/90 rounded-3xl p-6 md:p-8 shadow-xl">
                <div className="mb-6 pb-4 border-b border-stone-100">
                  <span className="text-xs font-bold text-amber-600 uppercase tracking-wider block mb-1">
                    Registration Form
                  </span>
                  <h3 className="text-xl font-black text-stone-900">
                    VIP યુગલ નોંધણી ફોર્મ
                  </h3>
                  <p className="text-xs text-stone-500 font-medium mt-0.5">
                    કૃપા કરીને આપની વિગતો અને યુગલ ફોટો અપલોડ કરો.
                  </p>
                </div>

                {errorMessage && (
                  <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm font-semibold flex items-center gap-2">
                    <AlertTriangleIcon className="w-5 h-5 text-rose-600 flex-shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1.5">
                        પતિનું નામ (Husband's Name) *
                      </label>
                      <input
                        type="text"
                        required
                        value={husbandName}
                        onChange={(e) => setHusbandName(e.target.value)}
                        placeholder="દા.ત. રમેશભાઈ"
                        className="w-full px-4 py-3 bg-stone-50 border border-stone-300 focus:bg-white focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 rounded-xl text-sm font-medium outline-none transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1.5">
                        પત્નીનું નામ (Wife's Name) *
                      </label>
                      <input
                        type="text"
                        required
                        value={wifeName}
                        onChange={(e) => setWifeName(e.target.value)}
                        placeholder="દા.ત. ગીતાબેન"
                        className="w-full px-4 py-3 bg-stone-50 border border-stone-300 focus:bg-white focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 rounded-xl text-sm font-medium outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1.5">
                        અટક (Surname) *
                      </label>
                      <input
                        type="text"
                        required
                        value={surname}
                        onChange={(e) => setSurname(e.target.value)}
                        placeholder="દા.ત. પટેલ"
                        className="w-full px-4 py-3 bg-stone-50 border border-stone-300 focus:bg-white focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 rounded-xl text-sm font-medium outline-none transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1.5">
                        વોટ્સએપ નંબર (WhatsApp No.) *
                      </label>
                      <input
                        type="tel"
                        required
                        maxLength={10}
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                        placeholder="10-આંકડાનો મોબાઇલ નંબર"
                        className="w-full px-4 py-3 bg-stone-50 border border-stone-300 focus:bg-white focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 rounded-xl text-sm font-bold font-mono outline-none transition-all"
                      />
                    </div>
                  </div>

                  {/* Couple Photo Upload */}
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1.5">
                      યુગલ ફોટો (Couple Photograph) *
                    </label>
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/*"
                      onChange={handlePhotoSelect}
                      className="hidden"
                    />

                    {photoPreview ? (
                      <div className="relative rounded-2xl overflow-hidden border-2 border-rose-300 p-2 bg-rose-50/50 flex items-center gap-4">
                        <img
                          src={photoPreview}
                          alt="Couple Preview"
                          className="w-20 h-24 object-cover rounded-xl shadow-xs shrink-0"
                        />
                        <div className="space-y-1">
                          <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                            <CheckIcon className="w-4 h-4 text-emerald-600" />
                            <span>ફોટો પસંદ થઈ ગયો છે!</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="text-xs text-rose-700 hover:text-rose-800 font-bold underline block cursor-pointer"
                          >
                            બીજો ફોટો પસંદ કરો (Change)
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed border-stone-300 hover:border-rose-400 rounded-2xl p-6 text-center cursor-pointer transition-colors bg-stone-50 hover:bg-rose-50/40 group"
                      >
                        <CameraIcon className="w-8 h-8 text-stone-400 group-hover:text-rose-500 mx-auto mb-2 transition-colors" />
                        <span className="text-xs font-bold text-stone-700 block">
                          પતિ-પત્ની બંનેનો સાથે ફોટો અપલોડ કરો
                        </span>
                        <span className="text-[11px] text-stone-400 mt-1 block">
                          (Click to select couple photo from gallery or camera)
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Submit Button */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full py-4 bg-gradient-to-r from-rose-600 via-rose-500 to-amber-600 hover:from-rose-700 hover:to-amber-700 text-white font-extrabold rounded-2xl text-sm transition-all shadow-lg shadow-rose-600/25 flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-50"
                    >
                      {submitting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>વિનંતી સબમિટ થઈ રહી છે...</span>
                        </>
                      ) : (
                        <>
                          <SparklesIcon className="w-4 h-4" />
                          <span>VIP પાસ માટે વિનંતી કરો (Submit VIP Request)</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Official Footer */}
      <footer className="py-6 px-6 border-t border-stone-200 text-center text-xs text-stone-500 bg-white/70 backdrop-blur-sm z-10">
        <p>© 2026 Ek Duje Ke Liye &bull; Manish Vaghasiya. All rights reserved.</p>
      </footer>
    </div>
  );
}

export default function VipEntryPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#FAF9F6] flex items-center justify-center">
        <div className="w-10 h-10 border-3 border-rose-600 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <VipEntryContent />
    </Suspense>
  );
}
