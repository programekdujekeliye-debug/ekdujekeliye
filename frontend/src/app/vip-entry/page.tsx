'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';
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
  ShieldCheckIcon,
  AlertTriangleIcon,
  CheckIcon,
  HeartHandshakeIcon
} from '../../components/Icons';
import toast from 'react-hot-toast';

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

export default function VipEntryPage() {
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
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
      formData.append('programId', 'prog-2026-09-07');
      if (couplePhoto) {
        formData.append('couplePhoto', couplePhoto);
      }

      const res = await fetch(`${API_BASE_URL}/api/vip/submit`, {
        method: 'POST',
        body: formData
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'VIP પાસ વિનંતી સબમિટ કરવામાં સમસ્યા આવી. કૃપા કરીને ફરી પ્રયાસ કરો.');
      }

      setSubmittedData({
        inquiryId: data.inquiryId,
        husbandName: data.husbandName || cleanH,
        wifeName: data.wifeName || cleanW,
        status: data.status || 'pending',
        programName: data.programName || 'Ek Duje Ke Liye - Sardar Patel Smruti Bhavan'
      });

      toast.success('VIP પાસ વિનંતી સફળતાપૂર્વક નોંધાઈ ગઈ છે!');
    } catch (err: any) {
      setErrorMessage(err.message || 'VIP પાસ નોંધણી નિષ્ફળ ગઈ. કૃપા કરીને ફરી પ્રયત્ન કરો.');
    } finally {
      setSubmitting(false);
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

        {/* Hero Badge & Headings */}
        <div className="text-center space-y-2.5 mb-8">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-50 border border-amber-300 text-amber-900 text-xs font-bold tracking-wide uppercase shadow-xs">
            <SparklesIcon className="w-4 h-4 text-amber-600" />
            <span>વિશેષ આમંત્રિત અતિથિ &bull; VIP Guest Registration</span>
          </div>

          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-stone-900 tracking-tight">
            એક દુજે કે લિયે &bull; VIP પ્રવેશ પાસ નોંધણી
          </h1>
          <p className="text-xs sm:text-sm text-stone-600 max-w-lg mx-auto font-medium">
            માનવંતા મહેમાનો માટે ડિજિટલ VIP કપલ પાસ નોંધણી ફોર્મ. વિગતો સબમિટ કર્યા બાદ એડમિન મંજૂરી મળતાં જ તમારો પાસ જનરેટ થઈ જશે.
          </p>
        </div>

        {/* Submitted Success View */}
        {submittedData ? (
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
                <span className="font-bold text-stone-900">એક દુજે કે લિયે (Surat)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500 font-medium">તારીખ અને સમય:</span>
                <span className="font-semibold text-stone-900">સોમવાર, ૦૭ સપ્ટેમ્બર ૨૦૨૬ &bull; રાત્રે ૮:૩૦</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500 font-medium">સ્થળ (Venue):</span>
                <span className="font-semibold text-stone-900">સરદાર પટેલ સ્મૃતિ ભવન, સુરત</span>
              </div>
              <div className="flex justify-between border-t border-stone-200 pt-2">
                <span className="text-stone-500 font-medium">પાસ પ્રકાર:</span>
                <span className="font-bold text-rose-700">માનવંત અતિથિ પાસ (VIP Complimentary)</span>
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
                className="py-3.5 px-6 border border-stone-300 hover:bg-stone-100 text-stone-700 font-bold rounded-2xl text-xs sm:text-sm transition-all"
              >
                બીજી VIP નોંધણી કરો (New Entry)
              </button>
            </div>
          </div>
        ) : (
          /* Normal Registration Form View: 2 Columns */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Left Column: Event & VIP Info Card */}
            <div className="lg:col-span-5 bg-white border border-stone-200/90 rounded-3xl p-6 md:p-8 shadow-xl space-y-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold text-rose-700 uppercase tracking-widest block">
                    Surat &bull; સુરત
                  </span>
                  <span className="px-2.5 py-0.5 bg-amber-50 border border-amber-300 text-amber-900 text-[10px] font-bold rounded-md uppercase tracking-wider">
                    VIP Special
                  </span>
                </div>
                <h2 className="text-xl md:text-2xl font-extrabold text-stone-900 leading-tight">
                  એક દુજે કે લિયે &bull; સરદાર પટેલ સ્મૃતિ ભવન
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
                    <span className="font-semibold text-stone-900">સોમવાર, ૦૭ સપ્ટેમ્બર ૨૦૨૬</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-stone-700">
                  <ClockIcon className="w-5 h-5 text-amber-600 flex-shrink-0" />
                  <div>
                    <span className="text-xs text-stone-500 block font-medium">સમય (Time)</span>
                    <span className="font-semibold text-stone-900">રાત્રે ૮:૩૦ વાગ્યે (8:30 PM)</span>
                  </div>
                </div>

                <div className="flex items-start gap-3 text-stone-700">
                  <MapPinIcon className="w-5 h-5 text-stone-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="text-xs text-stone-500 block font-medium">સ્થળ (Venue)</span>
                    <span className="font-semibold text-stone-900">
                      સરદાર પટેલ સ્મૃતિ ભવન, મીની બજાર પાસે, વરાછા રોડ, સુરત
                    </span>
                    <a
                      href="https://share.google/y1jtFAZXuKusYTiUD"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-rose-700 hover:underline block mt-0.5 font-bold"
                    >
                      Google Maps પર જુઓ →
                    </a>
                  </div>
                </div>

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
                  <ShieldCheckIcon className="w-4 h-4 text-rose-600" />
                  <span>મહત્વપૂર્ણ નિયમો અને સૂચનાઓ:</span>
                </p>
                <ul className="list-disc pl-4 space-y-1 text-stone-700">
                  <li>આ કાર્યક્રમ ફક્ત યુગલો (Married / Committed Couples) માટે છે.</li>
                  <li>કપલ તરીકે બંને પાર્ટનર્સનું સાથે ઉપસ્થિત રહેવું ફરજિયાત છે.</li>
                  <li>બાળકોને લાવવાની સખત મનાઈ છે.</li>
                  <li>પાસ પર તમારો ફોટો મુકાશે, જેથી સારો કપલ ફોટો અપલોડ કરવો.</li>
                  <li>ફોર્મ ભર્યા પછી એડમિન દ્વારા મંજૂર થતાં જ ડિજિટલ પાસ સક્રિય થશે.</li>
                </ul>
              </div>
            </div>

            {/* Right Column: VIP Entry Form */}
            <div className="lg:col-span-7 bg-white border border-stone-200/90 rounded-3xl p-6 md:p-8 shadow-xl space-y-6">
              <div>
                <h3 className="text-xl md:text-2xl font-extrabold text-stone-900">
                  VIP મહેમાન વિગત (Couple Details)
                </h3>
                <p className="text-xs text-stone-600 mt-1 font-medium">
                  કૃપા કરીને વર-વધૂ બંનેનું નામ અને સાચો વોટ્સએપ નંબર ભરો જેથી પાસ મોકલી શકાય.
                </p>
              </div>

              {errorMessage && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-rose-800 text-xs font-semibold">
                  <AlertTriangleIcon className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                
                {/* Couple Names Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider">
                      પતિનું નામ (Husband Name) <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={husbandName}
                      onChange={(e) => setHusbandName(e.target.value)}
                      placeholder="દા.ત. સંજયભાઈ / Sanjay"
                      className="w-full px-4 py-3 bg-stone-50 border border-stone-300 rounded-xl text-stone-900 placeholder-stone-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-600 transition-all text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider">
                      પત્નીનું નામ (Wife Name) <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={wifeName}
                      onChange={(e) => setWifeName(e.target.value)}
                      placeholder="દા.ત. કિરણબેન / Kiran"
                      className="w-full px-4 py-3 bg-stone-50 border border-stone-300 rounded-xl text-stone-900 placeholder-stone-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-600 transition-all text-sm"
                    />
                  </div>
                </div>

                {/* Surname & Phone Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider">
                      અટક (Surname)
                    </label>
                    <input
                      type="text"
                      value={surname}
                      onChange={(e) => setSurname(e.target.value)}
                      placeholder="દા.ત. અમીપરા / Amipara"
                      className="w-full px-4 py-3 bg-stone-50 border border-stone-300 rounded-xl text-stone-900 placeholder-stone-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-600 transition-all text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider">
                      WhatsApp મોબાઇલ નંબર <span className="text-rose-600">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-500 font-bold text-xs">
                        +91
                      </span>
                      <input
                        type="tel"
                        required
                        maxLength={10}
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        placeholder="98765 43210"
                        className="w-full pl-12 pr-4 py-3 bg-stone-50 border border-stone-300 rounded-xl text-stone-900 placeholder-stone-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-600 transition-all text-sm font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Couple Photo Upload */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider">
                    કપલ ફોટો (Couple Photo for Pass)
                  </label>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoSelect}
                    className="hidden"
                  />

                  {photoPreview ? (
                    <div className="flex items-center gap-4 p-3.5 bg-stone-50 border border-stone-200 rounded-2xl">
                      <img
                        src={photoPreview}
                        alt="Couple Preview"
                        className="w-16 h-16 object-cover rounded-xl border border-stone-300 shadow-xs"
                      />
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-bold text-stone-900 block truncate">
                          {couplePhoto?.name || 'Couple Photo'}
                        </span>
                        <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1 mt-0.5">
                          <CheckIcon className="w-3.5 h-3.5 text-emerald-600" />
                          <span>ફોટો તૈયાર છે (Photo Selected)</span>
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-1.5 text-xs font-bold text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-all"
                      >
                        બદલો (Change)
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-rose-300 hover:border-rose-500 bg-rose-50/40 hover:bg-rose-50/70 rounded-2xl p-6 text-center cursor-pointer transition-all space-y-2"
                    >
                      <div className="w-12 h-12 rounded-full bg-white text-rose-600 flex items-center justify-center mx-auto shadow-xs border border-rose-200">
                        <CameraIcon className="w-6 h-6 text-rose-600" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-stone-900 block">
                          અહીં ક્લિક કરી કપલ ફોટો અપલોડ કરો
                        </span>
                        <span className="text-[11px] text-stone-500 block mt-0.5">
                          JPG, PNG અથવા WEBP (Max 20MB)
                        </span>
                      </div>
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-rose-700 bg-white px-3 py-1 rounded-full border border-rose-200 shadow-2xs">
                        <UploadIcon className="w-3 h-3 text-rose-600" />
                        <span>ફોટો પસંદ કરો</span>
                      </span>
                    </div>
                  )}
                </div>

                {/* Submit Button */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-4 bg-gradient-to-r from-rose-600 via-rose-500 to-amber-600 hover:from-rose-700 hover:to-amber-700 text-white font-extrabold rounded-2xl transition-all shadow-xl shadow-rose-600/20 text-center flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider text-sm disabled:opacity-50"
                  >
                    {submitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>વિનંતી સબમિટ થઈ રહી છે...</span>
                      </>
                    ) : (
                      <>
                        <TicketIcon className="w-5 h-5 text-white" />
                        <span>VIP પાસ વિનંતી સબમિટ કરો (Submit VIP Request)</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Disclaimer */}
                <p className="text-center text-[11px] text-stone-500 leading-relaxed font-medium">
                  આ ફોર્મ સબમિટ કરવાથી તમારી વિનંતી સીધી આયોજક (Admin) સમક્ષ જશે. એડમિન મંજૂર કરશે એટલે તમારા WhatsApp પર અને આ લિંક પર તમારો પાસ જોવા મળશે.
                </p>
              </form>
            </div>
          </div>
        )}
      </main>

      {/* Official Website Footer */}
      <footer className="bg-stone-100 text-stone-600 border-t border-stone-200/80 mt-16 pt-8 pb-8 px-6 lg:px-12 text-xs">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div>
            &copy; {new Date().getFullYear()} Ek Duje Ke Liye &bull; A Special Program for Couples by Manish Vaghasiya. All rights reserved.
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 text-[11px] font-medium">
            <Link href="/privacy-policy" className="hover:text-rose-600 hover:underline">Privacy Policy</Link>
            <span>&bull;</span>
            <Link href="/terms" className="hover:text-rose-600 hover:underline">Terms &amp; Conditions</Link>
            <span>&bull;</span>
            <Link href="/cancellation-refund-policy" className="hover:text-rose-600 hover:underline">Refund Policy</Link>
            <span>&bull;</span>
            <Link href="/contact" className="hover:text-rose-600 hover:underline">Contact Us</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
