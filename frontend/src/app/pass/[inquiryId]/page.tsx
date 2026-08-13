'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { API_BASE_URL } from '../../../config';

interface Submission {
  inquiryId: string;
  husbandName: string;
  wifeName: string;
  surname: string;
  phoneNumber: string;
  programId: string;
  programName: string;
  programDate: string;
  programTime?: string;
  couplePhoto: string;
  status: string;
  rejectionReason?: string;
  isDateFinal?: boolean;
  upiId?: string;
  payeeName?: string;
  amount?: string;
  cardTemplate?: string;
  heartX?: number;
  heartY?: number;
  heartWidth?: number;
  heartHeight?: number;
  photoZoom?: number;
  photoOffsetY?: number;
}

export default function PassDownloadPage() {
  const params = useParams();
  const inquiryId = params.inquiryId as string;

  const [submission, setSubmission] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);
  const [cardReady, setCardReady] = useState(false);
  const [canvasDataUrl, setCanvasDataUrl] = useState<string>('');
  const [useCanvasDirectly, setUseCanvasDirectly] = useState(false);
  const [error, setError] = useState('');
  const [userZoom, setUserZoom] = useState<number>(1.0);
  const [userOffsetY, setUserOffsetY] = useState<number>(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [paymentScreenshot, setPaymentScreenshot] = useState<File | null>(null);
  const [paymentPreview, setPaymentPreview] = useState<string>('');
  const [uploadingPayment, setUploadingPayment] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const [programs, setPrograms] = useState<any[]>([]);
  const [selectedSlotId, setSelectedSlotId] = useState<string>('');
  const [updatingSlot, setUpdatingSlot] = useState(false);
  const [slotError, setSlotError] = useState('');

  useEffect(() => {
    const fetchPrograms = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/programs`);
        if (res.ok) {
          const data = await res.json();
          setPrograms(data);
        }
      } catch (err) {
        console.error('Failed to fetch programs:', err);
      }
    };
    fetchPrograms();
  }, []);

  const handleChangeSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlotId) {
      setSlotError('કૃપા કરીને એક પ્રોગ્રામ સ્લોટ પસંદ કરો.');
      return;
    }
    setSlotError('');
    setUpdatingSlot(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/submissions/${inquiryId}/change-slot`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ targetProgramId: selectedSlotId })
      });
      const data = await res.json();
      if (res.ok) {
        window.location.reload();
      } else {
        setSlotError(data.error || 'સ્લોટ બદલવામાં ભૂલ થઈ.');
      }
    } catch (err) {
      setSlotError('નેટવર્ક ભૂલ: સ્લોટ બદલી શકાયો નથી.');
    } finally {
      setUpdatingSlot(false);
    }
  };

  useEffect(() => {
    if (paymentScreenshot) {
      const objectUrl = URL.createObjectURL(paymentScreenshot);
      setPaymentPreview(objectUrl);
      return () => URL.revokeObjectURL(objectUrl);
    } else {
      setPaymentPreview('');
    }
  }, [paymentScreenshot]);

  const handleUploadPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentScreenshot) {
      setUploadError('કૃપા કરીને પેમેન્ટ સ્ક્રીનશોટ અપલોડ કરો!');
      return;
    }
    setUploadError('');
    setUploadingPayment(true);

    try {
      const formData = new FormData();
      formData.append('paymentScreenshot', paymentScreenshot);

      const res = await fetch(`${API_BASE_URL}/api/submissions/${inquiryId}/pay`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        window.location.reload();
      } else {
        setUploadError(data.error || 'અપલોડ કરવામાં ભૂલ થઈ. કૃપા કરીને ફરી પ્રયાસ કરો.');
      }
    } catch (err) {
      setUploadError('સર્વર સાથે કનેક્ટ થઈ શક્યું નથી.');
    } finally {
      setUploadingPayment(false);
    }
  };

  useEffect(() => {
    if (!inquiryId) return;

    const fetchStatus = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/submissions/status/${inquiryId}`);
        if (res.ok) {
          const data = await res.json();
          setSubmission(data);
        } else {
          setError('Inquiry ID not found or invalid.');
        }
      } catch (err) {
        setError('Connection failed. Make sure backend server is running.');
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
  }, [inquiryId]);

  // Canvas drawing functions
  const drawHeartMask = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => {
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y + h * 0.24);
    ctx.bezierCurveTo(x + w * 0.28, y - h * 0.06, x - w * 0.06, y + h * 0.22, x + w * 0.01, y + h * 0.56);
    ctx.bezierCurveTo(x + w * 0.06, y + h * 0.78, x + w * 0.32, y + h * 0.94, x + w / 2, y + h * 1.02);
    ctx.bezierCurveTo(x + w * 0.68, y + h * 0.94, x + w * 0.94, y + h * 0.78, x + w * 0.99, y + h * 0.56);
    ctx.bezierCurveTo(x + w * 1.06, y + h * 0.22, x + w * 0.72, y - h * 0.06, x + w / 2, y + h * 0.24);
    ctx.closePath();
  };

  const drawTextDetails = (ctx: CanvasRenderingContext2D, sub: Submission) => {
    ctx.save();
    const hX = sub.heartX ?? 144;
    const hY = sub.heartY ?? 112;
    const hW = sub.heartWidth ?? 288;
    const hH = sub.heartHeight ?? 260;

    const textX = hX + hW / 2;
    const textY = hY - 20;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Draw a dark outline for high contrast readability
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 6;
    ctx.lineJoin = 'round';
    ctx.font = 'bold 30px "Oswald", "Impact", "Arial Narrow", sans-serif';
    ctx.strokeText(sub.inquiryId, textX, textY);
    
    // Draw the CPL text in gold
    ctx.fillStyle = '#D4AF37';
    ctx.fillText(sub.inquiryId, textX, textY);
    ctx.restore();
  };

  const drawCard = (sub: Submission) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 576;
    canvas.height = 1024;

    const templateImg = new Image();
    const templatePath = sub.cardTemplate || '/card_template.png';
    const templateImgSrc = (templatePath.startsWith('data:') || templatePath.startsWith('http://') || templatePath.startsWith('https://') || templatePath === '/card_template.png')
      ? templatePath
      : `${API_BASE_URL}${templatePath}`;
    const isTemplateRemote = templateImgSrc.startsWith('http://') || templateImgSrc.startsWith('https://');
    if (isTemplateRemote) {
      templateImg.crossOrigin = 'anonymous';
    }

    templateImg.onload = () => {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) return;

      tempCtx.drawImage(templateImg, 0, 0, canvas.width, canvas.height);

      const hX = sub.heartX ?? 144;
      const hY = sub.heartY ?? 112;
      const hW = sub.heartWidth ?? 288;
      const hH = sub.heartHeight ?? 260;

      // Make white area transparent strictly inside the heart bounding box coordinates
      try {
        const imgData = tempCtx.getImageData(hX, hY, hW, hH);
        const data = imgData.data;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          if (r > 220 && g > 220 && b > 220) {
            data[i + 3] = 0; // Make transparent
          }
        }
        tempCtx.putImageData(imgData, hX, hY);
      } catch (e) {
        console.error("Error doing transparency scan: ", e);
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const coupleImg = new Image();
      const photoPath = sub.couplePhoto;
      const coupleImgSrc = (photoPath.startsWith('data:') || photoPath.startsWith('http://') || photoPath.startsWith('https://')) ? photoPath : `${API_BASE_URL}${photoPath}`;
      const isCoupleRemote = coupleImgSrc.startsWith('http://') || coupleImgSrc.startsWith('https://');
      if (isCoupleRemote) {
        coupleImg.crossOrigin = 'anonymous';
      }

      const drawFinalCard = () => {
        const imgAspect = coupleImg.width / coupleImg.height;
        const heartAspect = hW / hH;
        let drawW = hW;
        let drawH = hH;
        let offsetX = 0;
        let offsetY = 0;

        if (imgAspect > heartAspect) {
          drawW = hH * imgAspect;
          offsetX = -(drawW - hW) / 2;
        } else {
          drawH = hW / imgAspect;
          offsetY = -(drawH - hH) / 2;
        }

        const zoom = (sub.photoZoom ?? 1.0) * userZoom;
        const finalW = drawW * zoom;
        const finalH = drawH * zoom;
        const finalOffsetX = offsetX - (finalW - drawW) / 2;
        const finalOffsetY = (offsetY - (finalH - drawH) / 2) + (sub.photoOffsetY ?? 0) + userOffsetY;

        ctx.save();
        ctx.beginPath();
        ctx.rect(hX, hY, hW, hH);
        ctx.clip();
        ctx.drawImage(coupleImg, hX + finalOffsetX, hY + finalOffsetY, finalW, finalH);
        ctx.restore();
        ctx.drawImage(tempCanvas, 0, 0);
        drawTextDetails(ctx, sub);
        try {
          setCanvasDataUrl(canvas.toDataURL('image/png'));
        } catch (e) {
          console.error("Canvas export failed:", e);
          setUseCanvasDirectly(true);
        }
        setCardReady(true);
      };

      coupleImg.onload = drawFinalCard;

      let coupleRetried = false;
      coupleImg.onerror = (err) => {
        console.error("Error loading coupleImg:", err);
        if (!coupleRetried && isCoupleRemote) {
          console.warn("CORS couple image load failed, retrying without credentials/anonymous...");
          coupleRetried = true;
          coupleImg.removeAttribute('crossOrigin');
          coupleImg.src = coupleImgSrc + (coupleImgSrc.includes('?') ? '&' : '?') + 'nocache=' + Date.now();
        } else {
          drawTextDetails(ctx, sub);
          try {
            setCanvasDataUrl(canvas.toDataURL('image/png'));
          } catch (e) {
            console.error("Canvas export failed on couple error fallback:", e);
            setUseCanvasDirectly(true);
          }
          setCardReady(true);
        }
      };

      coupleImg.src = coupleImgSrc;
    };

    let templateRetried = false;
    templateImg.onerror = (err) => {
      console.error("Error loading templateImg:", err);
      if (!templateRetried && isTemplateRemote) {
        console.warn("CORS template image load failed, retrying without CORS...");
        templateRetried = true;
        templateImg.removeAttribute('crossOrigin');
        templateImg.src = templateImgSrc + (templateImgSrc.includes('?') ? '&' : '?') + 'nocache=' + Date.now();
      } else {
        try {
          setCanvasDataUrl(canvas.toDataURL('image/png'));
        } catch (e) {
          console.error("Canvas export failed on template error fallback:", e);
          setUseCanvasDirectly(true);
        }
        setCardReady(true);
      }
    };

    templateImg.src = templateImgSrc;
  };

  useEffect(() => {
    if (submission && submission.status === 'approved') {
      drawCard(submission);
    }
  }, [submission, userZoom, userOffsetY]);

  const downloadCard = () => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (isIOS) {
      alert("iPhone પર ડાઉનલોડ કરવા માટે કાર્ડ પર લાંબો સમય ટચ (press and hold) કરી રાખીને 'Save to Photos' અથવા 'Add to Photos' કરો, અથવા આ સ્ક્રીનનો સ્ક્રીનશોટ (Screenshot) પાડી લો.");
      return;
    }
    
    try {
      const link = document.createElement('a');
      link.download = `${submission?.surname}_${submission?.husbandName}_Invitation_Pass.png`;
      link.href = canvasDataUrl || (canvasRef.current ? canvasRef.current.toDataURL('image/png') : '');
      link.click();
    } catch (err) {
      console.error("Failed to download canvas via data URL:", err);
      alert("કાર્ડ તૈયાર છે. ડાઉનલોડ કરવા માટે લાંબા સમય સુધી કાર્ડ પર ટચ કરી રાખીને સેવ (Save Image) કરો અથવા આ સ્ક્રીનનો સ્ક્રીનશોટ (Screenshot) પાડી લો.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center font-sans p-6 text-center space-y-4">
        <div className="w-12 h-12 rounded-full border-4 border-amber-500/20 border-t-amber-500 animate-spin" />
        <div>
          <p className="text-lg font-semibold text-slate-200">Loading your invitation pass details...</p>
          <p className="text-xs text-slate-450 mt-1">
            કૃપા કરીને પ્રતીક્ષા કરો...
          </p>
        </div>
      </div>
    );
  }

  if (error || !submission) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center font-sans p-6">
        <div className="max-w-md w-full bg-slate-950/70 border border-slate-800/80 rounded-3xl p-8 text-center backdrop-blur-xl shadow-2xl">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-slate-200">Error</h2>
          <p className="text-slate-400 text-sm mt-2">{error || 'Inquiry not found.'}</p>
          <a href="/" className="mt-6 inline-block w-full py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-sm transition-all">
            Back to Home
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between font-sans">
      <header className="py-6 px-8 border-b border-slate-800 bg-slate-950/50 backdrop-blur-md">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Ek Duje Ke Liye Logo" className="h-10 w-auto object-contain" />
            <span className="text-xl font-bold tracking-wider text-slate-100 uppercase">Ek Duje Ke Liye</span>
          </div>
        </div>
      </header>

      <main className="flex-grow flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-xl bg-slate-950/70 border border-slate-800/80 rounded-3xl p-8 backdrop-blur-xl shadow-2xl relative overflow-hidden text-center">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

          {submission.status === 'inquiry' && (
            <div className="space-y-6 py-6">
              <div className="w-16 h-16 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto text-3xl">
                {submission.isDateFinal ? '🎉' : '📝'}
              </div>

              {/* Slot Selection / Change Option */}
              {programs.length > 1 && !submission.isDateFinal && (
                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 text-left max-w-md mx-auto space-y-3">
                  <span className="block text-[10px] font-bold text-amber-500 uppercase tracking-wider">
                    પ્રોગ્રામ સ્લોટ બદલો (Change Program Slot)
                  </span>
                  <p className="text-[11px] text-slate-450 leading-relaxed">
                    જો તમને ફાળવેલ તારીખ અનુકૂળ ન હોય, તો તમે નીચેથી અન્ય કોઈ ઉપલબ્ધ તારીખ પસંદ કરીને "સ્લોટ બદલો" પર ક્લિક કરી શકો છો.
                  </p>
                  <form onSubmit={handleChangeSlot} className="flex gap-2 items-end">
                    <div className="flex-grow">
                      <select
                        value={selectedSlotId}
                        onChange={(e) => setSelectedSlotId(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-amber-500 transition-colors font-medium cursor-pointer"
                      >
                        <option value="" disabled>પ્રોગ્રામ સ્લોટ પસંદ કરો...</option>
                        {programs
                          .filter((p) => {
                            const isCurrent = p.id === submission.programId;
                            const isSoldOut = p.bookingsCount + 2 > p.capacity;
                            return isCurrent || !isSoldOut;
                          })
                          .map((p) => {
                            const isCurrent = p.id === submission.programId;
                            const remainingSeats = p.capacity - p.bookingsCount;
                            return (
                              <option key={p.id} value={p.id}>
                                {p.name} ({p.date}) {isCurrent ? "[વર્તમાન]" : `(${Math.floor(remainingSeats / 2)} left)`}
                              </option>
                            );
                          })}
                      </select>
                    </div>
                    <button
                      type="submit"
                      disabled={updatingSlot || !selectedSlotId || selectedSlotId === submission.programId}
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 active:scale-[0.98] text-slate-950 font-bold rounded-xl text-xs transition-all cursor-pointer whitespace-nowrap"
                    >
                      {updatingSlot ? 'બદલાઈ રહ્યું છે...' : 'સ્લોટ બદલો'}
                    </button>
                  </form>
                  {slotError && (
                    <p className="text-[10px] text-rose-450 bg-rose-500/10 border border-rose-500/20 py-1.5 px-3.5 rounded-lg text-center font-medium">
                      {slotError}
                    </p>
                  )}
                </div>
              )}

              {submission.isDateFinal ? (
                <>
                  <h2 className="text-2xl font-bold text-slate-100">પ્રોગ્રામની તારીખ નક્કી થઈ ગઈ છે!</h2>
                  <p className="text-slate-300 text-sm max-w-md mx-auto leading-relaxed">
                    આ પ્રોગ્રામની તારીખ **{submission.programDate}** ({submission.programTime}) નક્કી થયેલ છે. તમારી સીટ કન્ફર્મ કરવા માટે કૃપા કરીને નીચે આપેલા QR કોડ પર ₹{submission.amount || '100'} પેમેન્ટ કરો અને તેનો સ્ક્રીનશોટ અપલોડ કરો.
                  </p>
                  
                  {/* QR Code and Payee Details */}
                  <div className="flex flex-col items-center justify-center p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-4 max-w-xs mx-auto">
                    <div className="w-40 h-40 bg-white p-2 rounded-xl flex items-center justify-center shadow-lg">
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`upi://pay?pa=${submission.upiId}&pn=${submission.payeeName}&am=${submission.amount}&cu=INR`)}`}
                        alt="UPI QR Code"
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div className="text-center space-y-1">
                      <span className="text-[10px] text-slate-500 uppercase tracking-widest block font-semibold">Scan to Pay</span>
                      <span className="text-xs text-rose-400 font-bold block">{submission.upiId}</span>
                      <span className="text-[11px] text-slate-400 block font-medium">Name: {submission.payeeName}</span>
                      <span className="text-sm text-slate-200 font-extrabold block mt-1">Amount: ₹{submission.amount}</span>
                    </div>
                  </div>

                  <form onSubmit={handleUploadPayment} className="space-y-4 max-w-md mx-auto">
                    <div className="border-2 border-dashed border-rose-950/40 hover:border-rose-500/50 rounded-2xl p-4 text-center cursor-pointer transition-colors relative bg-slate-900/50">
                      <input
                        type="file"
                        accept="image/*"
                        required
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            setPaymentScreenshot(e.target.files[0]);
                          }
                        }}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      {paymentPreview ? (
                        <div className="flex flex-col items-center gap-2">
                          <img src={paymentPreview} alt="Screenshot Preview" className="w-20 h-20 object-cover rounded-lg border border-slate-700" />
                          <span className="text-xs text-slate-400 font-medium">{paymentScreenshot?.name}</span>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <div className="text-2xl text-slate-500">&uarr;</div>
                          <p className="text-xs font-medium text-slate-300">Upload Payment Screenshot</p>
                          <p className="text-[10px] text-slate-500 font-normal">Supports JPG, PNG, WEBP</p>
                        </div>
                      )}
                    </div>

                    {uploadError && (
                      <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 py-2 px-3 rounded-lg text-center font-medium">
                        {uploadError}
                      </p>
                    )}

                    <button
                      type="submit"
                      disabled={uploadingPayment}
                      className="w-full py-3 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 active:scale-[0.99] text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-rose-500/20"
                    >
                      {uploadingPayment ? 'સબમિટ થઈ રહ્યું છે...' : 'પેમેન્ટ કન્ફર્મ કરો'}
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <h2 className="text-2xl font-bold text-slate-100">ઇન્ક્વાયરી રજીસ્ટ્રેશન સફળ!</h2>
                  <p className="text-slate-300 text-sm max-w-sm mx-auto leading-relaxed">
                    નમસ્તે <strong>{submission.husbandName} & {submission.wifeName}</strong>, આ પ્રોગ્રામની તારીખ હજી નક્કી થઈ નથી.
                  </p>
                  <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl max-w-xs mx-auto">
                    <span className="text-xs text-slate-500 uppercase tracking-wider block">Inquiry ID</span>
                    <span className="text-xl font-extrabold text-amber-500 tracking-wider font-mono">{submission.inquiryId}</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed max-w-xs mx-auto">
                    જ્યારે પણ આ પ્રોગ્રામની તારીખ નક્કી થશે ત્યારે અમે તમને વૉટ્સએપ/ફોન દ્વારા જાણ કરીશું. તારીખ નક્કી થયા પછી તમે અહીંથી જ પેમેન્ટ સબમિટ કરી શકશો.
                  </p>
                  <button
                    onClick={() => window.location.reload()}
                    className="w-full py-3 border border-slate-800 hover:bg-slate-900 active:scale-[0.99] text-slate-300 font-bold rounded-xl transition-all"
                  >
                    Refresh Status
                  </button>
                </>
              )}
            </div>
          )}

          {submission.status === 'pending' && (
            <div className="space-y-6 py-6">
              <div className="w-16 h-16 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto text-3xl animate-bounce">
                ⏳
              </div>
              <h2 className="text-2xl font-bold text-slate-100">પેમેન્ટ વેરિફિકેશન ચાલુ છે</h2>
              <p className="text-slate-300 text-sm max-w-sm mx-auto leading-relaxed">
                નમસ્તે <strong>{submission.husbandName} & {submission.wifeName}</strong>, તમારું પેમેન્ટ સફળતાપૂર્વક અપલોડ થઈ ગયું છે. અમે વેરિફાય કરીને ટૂંક સમયમાં તમારો પાસ કન્ફર્મ કરી દઈશું.
              </p>
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl max-w-xs mx-auto">
                <span className="text-xs text-slate-500 uppercase tracking-wider block">Inquiry ID</span>
                <span className="text-xl font-extrabold text-amber-500 tracking-wider font-mono">{submission.inquiryId}</span>
              </div>
              <p className="text-xs text-slate-500">
                કૃપા કરીને એડમિનિસ્ટ્રેટર દ્વારા પેમેન્ટ મંજૂર કરવાની પ્રતીક્ષા કરો. મંજૂર થયા પછી પાસ ડાઉનલોડ કરવા આ પેજને રીફ્રેશ કરો.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="w-full py-3 border border-slate-800 hover:bg-slate-900 active:scale-[0.99] text-slate-300 font-bold rounded-xl transition-all"
              >
                Refresh Status
              </button>
            </div>
          )}

          {submission.status === 'rejected' && (
            <div className="space-y-6 py-6">
              <div className="w-16 h-16 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mx-auto text-3xl">
                ❌
              </div>
              <h2 className="text-2xl font-bold text-slate-100">Verification Rejected</h2>
              <p className="text-slate-300 text-sm leading-relaxed">
                Your card request was rejected by the administrator.
              </p>
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl max-w-md mx-auto text-red-400 text-sm">
                <strong>Reason:</strong> {submission.rejectionReason || 'No reason provided.'}
              </div>
              <p className="text-xs text-slate-500">
                Please register again or contact support to resolve the issue.
              </p>
              <a href="/" className="inline-block w-full py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-sm transition-all">
                Try Again / Register New
              </a>
            </div>
          )}

          {submission.status === 'approved' && (
            <div className="space-y-6 flex flex-col items-center">
              <div className="text-center w-full">
                <div className="w-12 h-12 rounded-full bg-emerald-500/15 text-emerald-500 flex items-center justify-center mx-auto mb-2 text-xl">
                  ✓
                </div>
                <h2 className="text-2xl font-bold text-slate-100 tracking-tight">Your Invitation Card is Approved!</h2>
                <p className="text-slate-400 text-sm mt-1">Your payment was verified. Use the button below to download the invitation pass.</p>
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-800 shadow-xl max-w-full my-2 relative" style={{ width: '300px', height: '533px' }}>
                <canvas
                  ref={canvasRef}
                  style={{ width: '300px', height: '533px' }}
                  className={useCanvasDirectly ? "mx-auto block bg-slate-950" : "hidden"}
                />
                {!useCanvasDirectly && (
                  canvasDataUrl ? (
                    <img
                      src={canvasDataUrl}
                      alt="Invitation Card"
                      style={{ width: '300px', height: '533px' }}
                      className="mx-auto block bg-slate-950"
                    />
                  ) : (
                    <div style={{ width: '300px', height: '533px' }} className="animate-pulse bg-slate-950 flex items-center justify-center text-xs text-slate-500">
                      Preparing pass card...
                    </div>
                  )
                )}
              </div>

              {/* User Image Adjustment Sliders */}
              <div className="w-full bg-slate-900/60 border border-slate-800 rounded-2xl p-4 my-2 space-y-4 max-w-sm">
                <span className="block text-[10px] font-bold text-amber-500 uppercase tracking-wider text-left">Adjust Your Photo / ફોટો સરખો કરો</span>

                <div className="space-y-3 text-left">
                  <div>
                    <label className="block text-[9px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Zoom (મોટો/નાનો કરો)</label>
                    <input
                      type="range"
                      min="0.5"
                      max="2.0"
                      step="0.05"
                      value={userZoom}
                      onChange={(e) => setUserZoom(Number(e.target.value))}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Position (ઉપર/નીચે કરો)</label>
                    <input
                      type="range"
                      min="-150"
                      max="150"
                      value={userOffsetY}
                      onChange={(e) => setUserOffsetY(Number(e.target.value))}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                    />
                  </div>
                </div>
              </div>

              <button
                onClick={downloadCard}
                className="w-full py-4 bg-amber-500 hover:bg-amber-600 active:scale-[0.99] text-slate-950 font-bold rounded-2xl transition-all shadow-lg shadow-amber-500/20"
              >
                Download Pass
              </button>
            </div>
          )}
        </div>
      </main>

      <footer className="py-6 px-8 border-t border-slate-800/80 bg-slate-950/20 text-center text-xs text-slate-500">
        &copy; {new Date().getFullYear()} Couple Card Generation System.
      </footer>
    </div>
  );
}
