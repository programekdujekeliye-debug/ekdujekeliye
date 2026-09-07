'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import { API_BASE_URL } from '../../config';
import {
  SparklesIcon,
  TicketIcon,
  CheckCircleIcon,
  UploadIcon,
  CalendarIcon,
  ClockIcon,
  MapPinIcon,
  PhoneIcon,
  AlertTriangleIcon
} from '../../components/Icons';
import toast from 'react-hot-toast';

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
    programDate?: string;
    programTime?: string;
    venue?: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 15 * 1024 * 1024) {
        toast.error('ફોટો 15MB કરતાં નાનો હોવો જોઈએ (Photo must be under 15MB)');
        return;
      }
      setCouplePhoto(file);
      const reader = new FileReader();
      reader.onload = () => setPhotoPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanH = husbandName.trim();
    const cleanW = wifeName.trim();
    const cleanP = phoneNumber.trim().replace(/\D/g, '').slice(-10);

    if (!cleanH || !cleanW) {
      setErrorMessage('કૃપા કરીને વરરાજા અને કન્યા બંનેનું નામ દાખલ કરો! (Please enter both Husband & Wife names)');
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
        throw new Error(data.error || 'VIP pass request submission failed. Please try again.');
      }

      setSubmittedData({
        inquiryId: data.inquiryId,
        husbandName: data.husbandName || cleanH,
        wifeName: data.wifeName || cleanW,
        status: data.status || 'pending',
        programName: data.programName || 'Ek Duje Ke Liye Seminar',
        programDate: data.programDate || '2026-09-07',
        programTime: data.programTime || '8:30 PM',
        venue: data.venue || 'Sardar Patel Smruti Bhavan, Surat'
      });

      toast.success('VIP એન્ટ્રી વિનંતી સફળતાપૂર્વક નોંધાઈ ગઈ છે!');
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred while submitting VIP entry request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-stone-950 via-slate-900 to-black text-slate-100 flex flex-col justify-between py-8 px-4 sm:px-6 relative overflow-hidden font-sans">
      {/* Subtle Background Glows */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 -right-40 w-96 h-96 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-xl mx-auto relative z-10 space-y-6">
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-400/30 text-amber-300 text-xs font-bold tracking-wide uppercase shadow-inner">
            <SparklesIcon className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            <span>VIP &amp; Honorary Guest Entry</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            એક દુજે કે લિયે &bull; VIP પ્રવેશ ફોર્મ
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto">
            વિશેષ માનવંતા મહેમાનો માટે ડિજિટલ VIP પાસ રજીસ્ટ્રેશન પોર્ટલ
          </p>
        </div>

        {/* Event Info Card */}
        <div className="bg-white/5 border border-amber-500/20 backdrop-blur-md rounded-2xl p-4 sm:p-5 shadow-xl space-y-3">
          <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
            <div className="flex items-center gap-2 text-amber-400 font-extrabold text-sm">
              <TicketIcon className="w-4 h-4 text-amber-400" />
              <span>આજના સેમિનારની વિગત (Today&apos;s Seminar)</span>
            </div>
            <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-extrabold rounded-full uppercase">
              LIVE TODAY
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
            <div className="flex items-center gap-2 text-slate-300">
              <CalendarIcon className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
              <span>સોમવાર, ૦૭ સપ્ટેમ્બર ૨૦૨૬</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <ClockIcon className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
              <span>રાત્રે ૮:૩૦ વાગ્યે</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <MapPinIcon className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
              <span className="truncate">સરદાર સ્મૃતિ ભવન, સુરત</span>
            </div>
          </div>
        </div>

        {/* Main Content Card: Form or Success */}
        {submittedData ? (
          <div className="bg-white/10 border border-amber-400/40 backdrop-blur-xl rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-center animate-in fade-in zoom-in-95 duration-300">
            <div className="w-16 h-16 bg-amber-500/20 border border-amber-400/50 rounded-2xl mx-auto flex items-center justify-center text-amber-300 shadow-lg">
              <CheckCircleIcon className="w-10 h-10 text-amber-400" />
            </div>

            <div className="space-y-2">
              <span className="px-3 py-1 bg-amber-400/20 text-amber-300 border border-amber-400/40 text-xs font-black rounded-full uppercase tracking-wider inline-block">
                ⏳ મંજૂરી બાકી &bull; Awaiting Approval
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-white">
                VIP પાસ વિનંતી નોંધાઈ ગઈ છે!
              </h2>
              <p className="text-xs sm:text-sm text-slate-300">
                નમસ્તે <strong className="text-amber-300">{submittedData.husbandName} &amp; {submittedData.wifeName}</strong>, તમારી VIP એન્ટ્રી વિનંતી સફળતાપૂર્વક સિસ્ટમમાં સબમિટ થઈ ગઈ છે.
              </p>
            </div>

            {/* Pass ID Display */}
            <div className="bg-black/40 border border-amber-500/30 rounded-2xl p-4 space-y-1">
              <span className="text-[10px] uppercase font-extrabold tracking-widest text-slate-400">
                તમારો VIP નોંધણી નંબર (Inquiry ID)
              </span>
              <div className="text-2xl sm:text-3xl font-mono font-black text-amber-400 tracking-wider">
                {submittedData.inquiryId}
              </div>
              <p className="text-[11px] text-slate-400">
                આયોજક (Organizer) દ્વારા મંજૂરી મળતાં જ તમારો એન્ટ્રી પાસ સક્રિય થઈ જશે.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <Link
                href={`/pass/${submittedData.inquiryId}`}
                className="px-5 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black rounded-xl text-xs sm:text-sm transition-all shadow-lg hover:shadow-amber-500/25 flex items-center justify-center gap-2"
              >
                <span>ચેક પાસ સ્ટેટસ (View Pass)</span>
                <span>↗</span>
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
                className="px-5 py-3 bg-white/10 hover:bg-white/15 text-white font-bold rounded-xl text-xs sm:text-sm border border-white/15 transition-all"
              >
                બીજી VIP નોંધણી કરો (New Entry)
              </button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-3xl p-5 sm:p-7 shadow-2xl space-y-5"
          >
            {errorMessage && (
              <div className="p-3.5 bg-rose-500/20 border border-rose-500/40 rounded-xl flex items-start gap-3 text-rose-200 text-xs animate-shake">
                <AlertTriangleIcon className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Couple Names */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-300">
                  વરરાજા / પતિનું પૂરું નામ <span className="text-amber-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={husbandName}
                  onChange={(e) => setHusbandName(e.target.value)}
                  placeholder="દા.ત. સંજયભાઈ / Sanjay"
                  className="w-full px-3.5 py-2.5 bg-black/40 border border-white/15 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 rounded-xl text-sm text-white placeholder-slate-500 outline-hidden transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-300">
                  કન્યા / પત્નીનું પૂરું નામ <span className="text-amber-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={wifeName}
                  onChange={(e) => setWifeName(e.target.value)}
                  placeholder="દા.ત. કિરણબેન / Kiran"
                  className="w-full px-3.5 py-2.5 bg-black/40 border border-white/15 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 rounded-xl text-sm text-white placeholder-slate-500 outline-hidden transition-all"
                />
              </div>
            </div>

            {/* Surname & WhatsApp Number */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-300">
                  અટક (Surname)
                </label>
                <input
                  type="text"
                  value={surname}
                  onChange={(e) => setSurname(e.target.value)}
                  placeholder="દા.ત. પટેલ / Patel"
                  className="w-full px-3.5 py-2.5 bg-black/40 border border-white/15 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 rounded-xl text-sm text-white placeholder-slate-500 outline-hidden transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-300">
                  WhatsApp મોબાઇલ નંબર <span className="text-amber-400">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-sm text-slate-400 font-mono font-bold">+91</span>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                    placeholder="9876543210"
                    className="w-full pl-12 pr-3.5 py-2.5 bg-black/40 border border-white/15 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 rounded-xl text-sm font-mono text-white placeholder-slate-500 outline-hidden transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Couple Photo Upload */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">
                કપલ ફોટો અપલોડ કરો (Couple Photo) <span className="text-slate-400 text-[10px] font-normal">(પાસ અને ઇન્વિટેશન માટે)</span>
              </label>

              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-white/20 hover:border-amber-400/60 bg-black/30 rounded-2xl p-4 text-center cursor-pointer transition-all hover:bg-black/50 group"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoSelect}
                  className="hidden"
                />

                {photoPreview ? (
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <img
                      src={photoPreview}
                      alt="Couple Preview"
                      className="w-20 h-20 rounded-xl object-cover border border-amber-400/50 shadow-md"
                    />
                    <div className="text-left space-y-1">
                      <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                        <CheckCircleIcon className="w-4 h-4 text-emerald-400" />
                        <span>ફોટો પસંદ થઈ ગયો છે (Photo Selected)</span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        ક્લિક કરીને બીજો ફોટો પસંદ કરી શકો છો
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 py-2">
                    <div className="w-10 h-10 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                      <UploadIcon className="w-5 h-5" />
                    </div>
                    <div className="text-xs font-bold text-slate-200">
                      અહીં ક્લિક કરીને કપલ ફોટો અપલોડ કરો
                    </div>
                    <p className="text-[10px] text-slate-400">
                      JPG, PNG અથવા WEBP ફોર્મેટ (મહત્તમ 15MB)
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black text-sm rounded-xl transition-all shadow-lg hover:shadow-amber-500/25 active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>વિનંતી મોકલાઈ રહી છે... (Submitting...)</span>
                </>
              ) : (
                <>
                  <SparklesIcon className="w-4 h-4 text-slate-950" />
                  <span>VIP પાસ વિનંતી મોકલો (Submit VIP Pass Request)</span>
                </>
              )}
            </button>

            <p className="text-[11px] text-center text-slate-400">
              સબમિટ કર્યા પછી આયોજક (Organizer) તરફથી મંજૂરી મળતાં જ તમારો પાસ વ્હોટ્સએપ પર પ્રાપ્ત થશે.
            </p>
          </form>
        )}

        {/* Footer info */}
        <div className="text-center text-[11px] text-slate-500 space-y-1">
          <p>&copy; 2026 Ek Duje Ke Liye &bull; All Rights Reserved</p>
          <p>હેલ્પલાઇન સપોર્ટ: +91 99095 67904 / +91 93775 71161</p>
        </div>
      </div>
    </main>
  );
}
