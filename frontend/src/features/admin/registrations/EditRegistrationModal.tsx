import React, { useState } from 'react';
import { Submission, Program } from '../../../types';
import { registrationsApi } from '../../../services/admin/registrationsApi';
import { API_BASE_URL } from '../../../config';
import {
  XIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  PhoneIcon,
  WhatsappIcon,
  SparklesIcon,
  QrCodeIcon
} from '../../../components/Icons';
import toast from 'react-hot-toast';

interface EditRegistrationModalProps {
  submission: Submission | null;
  programs: Program[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedSub: Submission) => void;
}

export const EditRegistrationModal: React.FC<EditRegistrationModalProps> = ({
  submission,
  programs,
  isOpen,
  onClose,
  onSuccess
}) => {
  if (!isOpen || !submission) return null;

  const [husbandName, setHusbandName] = useState(submission.husbandName || '');
  const [wifeName, setWifeName] = useState(submission.wifeName || '');
  const [surname, setSurname] = useState(submission.surname || '');
  const [phoneNumber, setPhoneNumber] = useState(submission.phoneNumber || '');
  const [programId, setProgramId] = useState(submission.programId || '');
  const [status, setStatus] = useState<'approved' | 'pending' | 'rejected'>(
    (submission.status as any) || 'pending'
  );
  const [paymentStatus, setPaymentStatus] = useState<string>(
    submission.payment?.status || (submission.status === 'approved' ? 'captured' : 'pending')
  );
  const isVip = Boolean(
    submission.isVip ||
    submission.inquiryId?.startsWith('IP-') ||
    submission.inquiryId?.includes('-IP-') ||
    submission.payment?.provider === 'manual_invite'
  );

  const [paymentAmount, setPaymentAmount] = useState<number>(
    submission.payment?.amount !== undefined && submission.payment?.amount !== null
      ? submission.payment.amount
      : isVip
      ? 0
      : 1500
  );
  
  // Photo edit states
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(
    submission.photoThumbnailUrl || submission.couplePhoto || null
  );

  const [saving, setSaving] = useState(false);

  const cleanDigits = phoneNumber.replace(/\D/g, '').slice(-10);

  const getWhatsAppMessageUrl = () => {
    if (!cleanDigits) return '#';
    const isPaid = paymentStatus === 'captured' || status === 'approved' || isVip;
    const text = isVip
      ? `નમસ્તે ${husbandName} & ${wifeName}, એક દુજે કે લિયે સેમિનાર (${submission.inquiryId}) માટે તમારો VIP પાસ તૈયાર છે.\n\nતમારો ડિજિટલ એન્ટ્રી પાસ: https://www.ekdujekeliye.in/pass/${submission.inquiryId}\n\nતમારું પર્સનલાઇઝ્ડ ઇન્વિટેશન કાર્ડ: https://www.ekdujekeliye.in/invitation/${submission.inquiryId}`
      : isPaid
      ? `નમસ્તે ${husbandName} & ${wifeName}, એક દુજે કે લિયે સેમિનાર (${submission.inquiryId}) માટે તમારું કપલ રજીસ્ટ્રેશન કન્ફર્મ થયેલ છે.\n\nતમારો ડિજિટલ એન્ટ્રી પાસ: https://www.ekdujekeliye.in/pass/${submission.inquiryId}\n\nતમારું પર્સનલાઇઝ્ડ ઇન્વિટેશન કાર્ડ: https://www.ekdujekeliye.in/invitation/${submission.inquiryId}`
      : `નમસ્તે ${husbandName} & ${wifeName}, એક દુજે કે લિયે સેમિનાર (${submission.inquiryId}) માટે તમારું રજીસ્ટ્રેશન પેન્ડિંગ છે. પેમેન્ટ પૂર્ણ કરવા માટે કૃપા કરીને આ લિંક પર ક્લિક કરો: https://www.ekdujekeliye.in/payment/${submission.inquiryId}`;
    return `https://wa.me/91${cleanDigits}?text=${encodeURIComponent(text)}`;
  };


  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 15 * 1024 * 1024) {
        toast.error('Image is too large. Please select a photo under 15MB.');
        return;
      }
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleRemoveNewPhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(submission.photoThumbnailUrl || submission.couplePhoto || null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!husbandName.trim() || !wifeName.trim() || !surname.trim()) {
      toast.error('Please enter all couple names and surname.');
      return;
    }
    if (!phoneNumber.trim() || cleanDigits.length < 10) {
      toast.error('Please enter a valid 10-digit mobile number.');
      return;
    }

    try {
      setSaving(true);
      const updatePayload: any = {
        husbandName: husbandName.trim(),
        wifeName: wifeName.trim(),
        surname: surname.trim(),
        phoneNumber: cleanDigits,
        programId: programId || submission.programId,
        status,
        ...(paymentStatus ? { paymentStatus } : {}),
        ...(paymentAmount ? { paymentAmount } : {})
      };

      const res = await registrationsApi.updateSubmission(submission.inquiryId, updatePayload, photoFile);

      if (res && res.submission) {
        toast.success(`Registration ${submission.inquiryId} updated successfully!`);
        onSuccess(res.submission);
        onClose();
      } else {
        toast.success(`Registration ${submission.inquiryId} updated!`);
        onSuccess({
          ...submission,
          husbandName: husbandName.trim(),
          wifeName: wifeName.trim(),
          surname: surname.trim(),
          phoneNumber: cleanDigits,
          programId: programId || submission.programId,
          status,
          couplePhoto: photoPreview || submission.couplePhoto,
          payment: {
            ...submission.payment,
            status: paymentStatus as any,
            amount: paymentAmount
          } as any
        });
        onClose();
      }
    } catch (err: any) {
      console.error('Failed to update registration:', err);
      toast.error(err.message || 'Failed to update registration.');
    } finally {
      setSaving(false);
    }
  };

  const getFullImageUrl = (url?: string | null) => {
    if (!url) return '';
    if (url.startsWith('http') || url.startsWith('data:') || url.startsWith('blob:')) return url;
    return `${API_BASE_URL}${url}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white text-stone-900 rounded-3xl shadow-2xl border border-stone-200/90 max-w-xl w-full overflow-hidden flex flex-col my-auto max-h-[92vh]">
        
        {/* Top Accent Line */}
        <div className="h-1.5 w-full bg-gradient-to-r from-rose-600 via-amber-500 to-rose-600" />

        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-[#FAF9F6] border-b border-stone-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 rounded-xl bg-rose-700 text-white font-mono font-black text-xs tracking-wider shadow-xs">
              {submission.inquiryId}
            </span>
            <div>
              <h3 className="font-extrabold text-stone-900 text-base leading-tight">Edit Registration &amp; Slot Transfer</h3>
              <p className="text-[11px] text-stone-500 font-medium">Update couple details, photo, assign program event, or adjust payment</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-stone-200/70 hover:bg-stone-300 text-stone-700 hover:text-stone-900 transition-colors cursor-pointer"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Links Strip */}
        <div className="bg-stone-100/70 px-4 sm:px-5 py-2.5 border-b border-stone-200 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider mr-1">Direct Links:</span>
          
          <a
            href={`/pass/${submission.inquiryId}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300/80 rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
          >
            <QrCodeIcon className="w-3.5 h-3.5 text-amber-700" />
            <span>Gate QR Pass ↗</span>
          </a>

          <a
            href={`/invitation/${submission.inquiryId}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
          >
            <SparklesIcon className="w-3.5 h-3.5 text-rose-600" />
            <span>Invitation Card ↗</span>
          </a>

          <a
            href={getWhatsAppMessageUrl()}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold shadow-xs transition-colors cursor-pointer ml-auto"
          >
            <WhatsappIcon className="w-3.5 h-3.5 text-white" />
            <span>Send on WhatsApp</span>
          </a>
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs text-stone-700">
          
          {/* Couple Photo Upload Section */}
          <div className="bg-stone-50/80 border border-stone-200 rounded-2xl p-3.5 flex items-center gap-3.5">
            <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-stone-300 bg-white flex-shrink-0 shadow-xs">
              {photoPreview ? (
                <img
                  src={getFullImageUrl(photoPreview)}
                  alt="Couple Preview"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-stone-200 flex items-center justify-center text-stone-400 font-bold text-[10px]">
                  No Photo
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-stone-800 uppercase tracking-wider">
                  Couple Photo
                </span>
                {photoFile && (
                  <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                    New File Selected
                  </span>
                )}
              </div>
              <p className="text-[10px] text-stone-500">
                Uploaded photo appears on the personalized invitation card and pass.
              </p>
              
              <div className="flex items-center gap-2 pt-1">
                <label className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[11px] font-bold cursor-pointer transition-colors inline-block">
                  <span>{photoFile ? 'Change Selected' : 'Upload / Replace Photo'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoSelect}
                    className="hidden"
                  />
                </label>

                {photoFile && (
                  <button
                    type="button"
                    onClick={handleRemoveNewPhoto}
                    className="px-2.5 py-1.5 bg-stone-200 hover:bg-stone-300 text-stone-700 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer"
                  >
                    Revert
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Couple Names Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-1">
                Partner 1 / Husband Name *
              </label>
              <input
                type="text"
                value={husbandName}
                onChange={(e) => setHusbandName(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 focus:bg-white rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-rose-500 text-sm font-semibold text-stone-900 transition-all"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-1">
                Partner 2 / Wife Name *
              </label>
              <input
                type="text"
                value={wifeName}
                onChange={(e) => setWifeName(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 focus:bg-white rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-rose-500 text-sm font-semibold text-stone-900 transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-1">
                Surname / અટક *
              </label>
              <input
                type="text"
                value={surname}
                onChange={(e) => setSurname(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 focus:bg-white rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-rose-500 text-sm font-semibold text-stone-900 transition-all"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-1">
                WhatsApp / Mobile Number *
              </label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                required
                placeholder="10 digit mobile"
                className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 focus:bg-white rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-rose-500 text-sm font-mono font-bold text-stone-900 transition-all"
              />
            </div>
          </div>

          {/* Event Slot Transfer Box */}
          <div className="bg-amber-50/60 border border-amber-300/80 rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-[11px] font-extrabold text-amber-950 uppercase tracking-wider">
                Event / Program Slot (Transfer Event)
              </label>
              <span className="text-[10px] text-amber-800 font-semibold">
                Auto-updates digital pass &amp; sends WhatsApp invitation
              </span>
            </div>
            <select
              value={programId}
              onChange={(e) => setProgramId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-amber-300 rounded-xl font-bold text-stone-900 text-xs focus:ring-2 focus:ring-amber-500 focus:border-amber-500 cursor-pointer shadow-xs"
            >
              {programs.map((p) => (
                <option key={p.id || p.slug} value={p.id || p.slug}>
                  {p.name} ({p.date} • {p.time || '8:30 PM'})
                </option>
              ))}
            </select>
          </div>

          {/* Status & Payment Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-1">
            <div>
              <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-1">
                Registration Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full px-3 py-2.5 border border-stone-300 rounded-xl font-bold text-xs bg-stone-50 focus:bg-white text-stone-900 focus:ring-2 focus:ring-rose-500 cursor-pointer"
              >
                <option value="approved">Approved (Active Pass)</option>
                <option value="pending">Pending (Review)</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-1">
                Payment Status
              </label>
              <select
                value={paymentStatus}
                onChange={(e) => setPaymentStatus(e.target.value)}
                className="w-full px-3 py-2.5 border border-stone-300 rounded-xl font-bold text-xs bg-stone-50 focus:bg-white text-stone-900 focus:ring-2 focus:ring-rose-500 cursor-pointer"
              >
                <option value="captured">Paid / Captured</option>
                <option value="pending">Pending / Unpaid</option>
                <option value="failed">Failed</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-1">
                Amount (₹)
              </label>
              <input
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(Number(e.target.value))}
                className="w-full px-3 py-2.5 border border-stone-300 rounded-xl font-mono font-bold text-xs bg-stone-50 focus:bg-white text-stone-900 focus:ring-2 focus:ring-rose-500"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-stone-200">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 bg-rose-700 hover:bg-rose-800 active:bg-rose-900 text-white font-extrabold rounded-xl text-xs shadow-md shadow-rose-700/20 transition-all cursor-pointer flex items-center gap-1.5"
            >
              {saving ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Changes</span>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
