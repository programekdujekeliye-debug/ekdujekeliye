import React, { useState } from 'react';
import { Program, Submission } from '../../../types';
import { registrationsApi } from '../../../services/admin/registrationsApi';
import {
  XIcon,
  CheckCircleIcon,
  PhoneIcon,
  WhatsappIcon,
  SparklesIcon,
  TicketIcon,
  AlertTriangleIcon
} from '../../../components/Icons';
import toast from 'react-hot-toast';

interface AddRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  programs: Program[];
  defaultProgramId?: string;
  onSuccess: (newRegistration: Submission) => void;
}

export const AddRegistrationModal: React.FC<AddRegistrationModalProps> = ({
  isOpen,
  onClose,
  programs,
  defaultProgramId,
  onSuccess
}) => {
  if (!isOpen) return null;

  // Form states
  const [husbandName, setHusbandName] = useState('');
  const [wifeName, setWifeName] = useState('');
  const [surname, setSurname] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [programId, setProgramId] = useState(
    defaultProgramId || (programs.length > 0 ? programs[0].id : 'prog-2026-09-07')
  );
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'captured'>('pending');
  const [paymentAmount, setPaymentAmount] = useState<number>(1500);
  const [couplePhoto, setCouplePhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  // Submission & Result states
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdResult, setCreatedResult] = useState<{
    inquiryId: string;
    paymentUrl: string;
    submission: Submission;
  } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const cleanPhone = phoneNumber.replace(/\D/g, '').slice(-10);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setCouplePhoto(file);
      const reader = new FileReader();
      reader.onload = () => setPhotoPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const removePhoto = () => {
    setCouplePhoto(null);
    setPhotoPreview(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!husbandName.trim() || !wifeName.trim() || !surname.trim()) {
      setError('Please fill in husband name, wife name, and surname.');
      return;
    }

    if (cleanPhone.length !== 10) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }

    if (!programId) {
      setError('Please select an event program slot.');
      return;
    }

    try {
      setSubmitting(true);

      const formData = new FormData();
      formData.append('husbandName', husbandName.trim());
      formData.append('wifeName', wifeName.trim());
      formData.append('surname', surname.trim());
      formData.append('phoneNumber', cleanPhone);
      formData.append('programId', programId);
      formData.append('status', paymentStatus === 'captured' ? 'approved' : 'pending');
      formData.append('paymentStatus', paymentStatus);
      formData.append('paymentAmount', String(paymentAmount || 1500));
      formData.append('paymentProvider', 'manual');
      formData.append('whatsappOptIn', 'true');

      if (couplePhoto) {
        formData.append('couplePhoto', couplePhoto);
      }

      const res = await registrationsApi.createAdminRegistration(formData);

      if (res && res.success && res.data) {
        toast.success(`Registration ${res.inquiryId} created successfully!`);
        setCreatedResult({
          inquiryId: res.inquiryId,
          paymentUrl: res.paymentUrl || `https://www.ekdujekeliye.in/payment/${res.inquiryId}`,
          submission: res.data
        });
        onSuccess(res.data);
      } else {
        throw new Error('Failed to create registration.');
      }
    } catch (err: any) {
      console.error('[AddRegistrationModal] Error:', err);
      setError(err.message || 'An error occurred while creating registration.');
      toast.error(err.message || 'Failed to create registration.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyPaymentLink = () => {
    if (!createdResult) return;
    navigator.clipboard.writeText(createdResult.paymentUrl);
    setCopiedLink(true);
    toast.success('Payment link copied to clipboard!');
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const getWhatsAppShareUrl = () => {
    if (!createdResult) return '#';
    const sub = createdResult.submission;
    const isPaid = paymentStatus === 'captured';
    const text = isPaid
      ? `નમસ્તે ${sub.husbandName} & ${sub.wifeName},\nએક દુજે કે લિયે સેમિનાર (${createdResult.inquiryId}) માટે તમારું કપલ રજીસ્ટ્રેશન કન્ફર્મ થયેલ છે.\n\nતમારો ડિજિટલ એન્ટ્રી પાસ: https://www.ekdujekeliye.in/pass/${createdResult.inquiryId}\nઇન્વિટેશન કાર્ડ: https://www.ekdujekeliye.in/invitation/${createdResult.inquiryId}`
      : `નમસ્તે ${sub.husbandName} & ${sub.wifeName},\nએક દુજે કે લિયે સેમિનાર (${createdResult.inquiryId}) માટે તમારું રજીસ્ટ્રેશન નોંધાયેલ છે.\n\nપેમેન્ટ પૂર્ણ કરવા માટે કૃપા કરીને આ લિંક પર ક્લિક કરો:\n${createdResult.paymentUrl}`;
    return `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(text)}`;
  };

  const resetFormForNext = () => {
    setHusbandName('');
    setWifeName('');
    setSurname('');
    setPhoneNumber('');
    setPaymentStatus('pending');
    setPaymentAmount(1500);
    setCouplePhoto(null);
    setPhotoPreview(null);
    setError(null);
    setCreatedResult(null);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="relative bg-white rounded-2xl sm:rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 transition-all">
        {/* Header */}
        <div className="px-5 py-4 sm:px-6 sm:py-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 via-rose-50/30 to-amber-50/20 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-700 text-white flex items-center justify-center shadow-xs">
              <SparklesIcon className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                Add Couple Registration
              </h2>
              <p className="text-[11px] font-semibold text-slate-500">
                નવું કપલ રજીસ્ટ્રેશન ઉમેરો (Uncaptured / Payment Link)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-all cursor-pointer"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 max-h-[75vh] overflow-y-auto">
          {createdResult ? (
            /* Success & Payment Sharing View */
            <div className="text-center py-3 space-y-4">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <CheckCircleIcon className="w-8 h-8" />
              </div>

              <div>
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                  Assigned Token ID
                </span>
                <span className="text-2xl sm:text-3xl font-black text-rose-700 font-mono tracking-tight bg-rose-50 px-4 py-1.5 rounded-xl border border-rose-200 inline-block">
                  {createdResult.inquiryId}
                </span>
                <p className="text-xs font-bold text-slate-700 mt-2">
                  {husbandName} & {wifeName} {surname} ({cleanPhone})
                </p>
                <div className="mt-1">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                      paymentStatus === 'captured'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : 'bg-amber-100 text-amber-800 border border-amber-200'
                    }`}
                  >
                    {paymentStatus === 'captured' ? '● Paid / Captured' : '● Unpaid / Uncaptured (₹1,500 to collect)'}
                  </span>
                </div>
              </div>

              {/* Direct Payment Link Card */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-left space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                    <TicketIcon className="w-3.5 h-3.5 text-rose-600" />
                    <span>Customer Direct Payment Link</span>
                  </label>
                  <span className="text-[10px] font-bold text-slate-500">Razorpay / UPI Ready</span>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={createdResult.paymentUrl}
                    className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-700 select-all focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleCopyPaymentLink}
                    className={`px-3 py-2 text-xs font-black rounded-xl cursor-pointer transition-all flex items-center gap-1 shrink-0 ${
                      copiedLink
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-rose-700 hover:bg-rose-800 text-white shadow-xs'
                    }`}
                  >
                    {copiedLink ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 font-medium">
                  The couple can open this link to pay ₹{paymentAmount || 1500} via UPI or Card online. Once paid, their pass will be confirmed automatically!
                </p>
              </div>

              {/* Share on WhatsApp Button */}
              <a
                href={getWhatsAppShareUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-sm rounded-xl flex items-center justify-center gap-2 shadow-xs transition-all active:scale-98"
              >
                <WhatsappIcon className="w-4 h-4" />
                <span>Send Payment Link on WhatsApp</span>
              </a>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={resetFormForNext}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl cursor-pointer transition-all"
                >
                  + Add Another Couple
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs rounded-xl cursor-pointer transition-all shadow-xs"
                >
                  Done & View Table
                </button>
              </div>
            </div>
          ) : (
            /* Creation Form */
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-xs font-bold">
                  <AlertTriangleIcon className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{error}</span>
                </div>
              )}

              {/* Program / Event Slot Selection */}
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">
                  Event Program Slot *
                </label>
                <select
                  value={programId}
                  onChange={(e) => {
                    setProgramId(e.target.value);
                    const selected = programs.find((p) => p.id === e.target.value);
                    if (selected && selected.price !== undefined) {
                      setPaymentAmount(selected.price);
                    }
                  }}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:border-rose-500 cursor-pointer"
                >
                  {programs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.date || 'TBD'}) — ₹{p.price || 1500}
                    </option>
                  ))}
                </select>
              </div>

              {/* Couple Names */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">
                    Husband's First Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sunny"
                    value={husbandName}
                    onChange={(e) => setHusbandName(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:border-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">
                    Wife's First Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dhruvi"
                    value={wifeName}
                    onChange={(e) => setWifeName(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              {/* Surname & Mobile */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">
                    Family Surname *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dankhara"
                    value={surname}
                    onChange={(e) => setSurname(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">
                    Mobile Number *
                  </label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3 text-xs font-black text-slate-400">
                      +91
                    </span>
                    <input
                      type="tel"
                      required
                      placeholder="9624030012"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      className="w-full pl-10 pr-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:border-rose-500"
                    />
                  </div>
                  {cleanPhone.length > 0 && cleanPhone.length < 10 && (
                    <span className="text-[10px] text-amber-600 font-bold mt-0.5 block">
                      {10 - cleanPhone.length} more digits needed
                    </span>
                  )}
                </div>
              </div>

              {/* Payment Collection Type Selector */}
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1.5">
                  Payment Collection Status *
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setPaymentStatus('pending')}
                    className={`p-3 rounded-2xl border text-left cursor-pointer transition-all ${
                      paymentStatus === 'pending'
                        ? 'border-amber-500 bg-amber-50/70 shadow-xs ring-2 ring-amber-500/20'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-black text-amber-900">
                        Pending / Uncaptured
                      </span>
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    </div>
                    <p className="text-[10px] text-amber-800 leading-tight">
                      To collect amount. Gives link so couple can pay via online UPI/Card or cash.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentStatus('captured')}
                    className={`p-3 rounded-2xl border text-left cursor-pointer transition-all ${
                      paymentStatus === 'captured'
                        ? 'border-emerald-500 bg-emerald-50/70 shadow-xs ring-2 ring-emerald-500/20'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-black text-emerald-900">
                        Paid / Captured
                      </span>
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    </div>
                    <p className="text-[10px] text-emerald-800 leading-tight">
                      Amount already collected. Pass will be confirmed immediately.
                    </p>
                  </button>
                </div>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">
                  Registration Fee Amount (₹)
                </label>
                <input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(Number(e.target.value))}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:border-rose-500"
                />
              </div>

              {/* Optional Couple Photo Upload */}
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">
                  Couple Photo (Optional — can also be uploaded later)
                </label>
                {photoPreview ? (
                  <div className="flex items-center gap-3 p-2 bg-slate-50 border border-slate-200 rounded-xl">
                    <img
                      src={photoPreview}
                      alt="Preview"
                      className="w-12 h-12 rounded-lg object-cover border border-slate-300"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate">
                        {couplePhoto?.name || 'Selected photo'}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {couplePhoto ? `${(couplePhoto.size / 1024).toFixed(0)} KB` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={removePhoto}
                      className="text-xs text-rose-600 hover:text-rose-800 font-bold px-2 py-1 cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3.5 file:rounded-xl file:border-0 file:text-xs file:font-black file:bg-rose-50 file:text-rose-700 hover:file:bg-rose-100 cursor-pointer"
                  />
                )}
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting || cleanPhone.length !== 10}
                  className="w-full py-3 bg-rose-700 hover:bg-rose-800 disabled:opacity-50 text-white font-black text-xs sm:text-sm rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                >
                  {submitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Creating Registration...</span>
                    </>
                  ) : (
                    <span>+ Add Registration</span>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
