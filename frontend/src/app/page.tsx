'use client';

import React, { useState, useRef, useEffect } from 'react';

interface SubmissionData {
  inquiryId: string;
  husbandName: string;
  wifeName: string;
  surname: string;
  phoneNumber: string;
  couplePhoto: string;
}

interface Program {
  id: string;
  name: string;
  date: string;
  capacity: number;
  bookingsCount: number;
}

const ADMIN_WHATSAPP_NUMBER = '919586979897'; // Configure Admin WhatsApp number here

export default function Home() {
  const [step, setStep] = useState(1);
  const [husbandName, setHusbandName] = useState('');
  const [wifeName, setWifeName] = useState('');
  const [surname, setSurname] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [couplePhoto, setCouplePhoto] = useState<File | null>(null);
  const [couplePhotoPreview, setCouplePhotoPreview] = useState<string>('');
  const [paymentScreenshot, setPaymentScreenshot] = useState<File | null>(null);
  const [paymentPreview, setPaymentPreview] = useState<string>('');
  
  const [inquiryId, setInquiryId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [programs, setPrograms] = useState<Program[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState('');
  const [searchInquiryId, setSearchInquiryId] = useState('');
  const [showStatusCheck, setShowStatusCheck] = useState(false);
  const [upiSettings, setUpiSettings] = useState({
    upiId: 'payee@upi',
    payeeName: 'Couple Pass',
    amount: '100'
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const fetchPrograms = async () => {
      try {
        const res = await fetch('http://localhost:5001/api/programs');
        if (res.ok) {
          const data = await res.json();
          setPrograms(data);
        }
      } catch (err) {
        console.error('Failed to fetch programs:', err);
      }
    };
    const fetchSettings = async () => {
      try {
        const res = await fetch('http://localhost:5001/api/settings');
        if (res.ok) {
          const data = await res.json();
          setUpiSettings(data);
        }
      } catch (err) {
        console.error('Failed to fetch settings:', err);
      }
    };
    fetchPrograms();
    fetchSettings();
  }, []);

  // Setup preview URLs
  useEffect(() => {
    if (!couplePhoto) {
      setCouplePhotoPreview('');
      return;
    }
    const objectUrl = URL.createObjectURL(couplePhoto);
    setCouplePhotoPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [couplePhoto]);

  useEffect(() => {
    if (!paymentScreenshot) {
      setPaymentPreview('');
      return;
    }
    const objectUrl = URL.createObjectURL(paymentScreenshot);
    setPaymentPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [paymentScreenshot]);

  // Heart mask drawing function
  const drawHeartMask = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => {
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y + h * 0.24); // Center top cleavage
    // Top left lobe
    ctx.bezierCurveTo(x + w * 0.28, y - h * 0.06, x - w * 0.06, y + h * 0.22, x + w * 0.01, y + h * 0.56);
    // Bottom left to tip
    ctx.bezierCurveTo(x + w * 0.06, y + h * 0.78, x + w * 0.32, y + h * 0.94, x + w / 2, y + h * 1.02);
    // Bottom right to tip
    ctx.bezierCurveTo(x + w * 0.68, y + h * 0.94, x + w * 0.94, y + h * 0.78, x + w * 0.99, y + h * 0.56);
    // Top right lobe
    ctx.bezierCurveTo(x + w * 1.06, y + h * 0.22, x + w * 0.72, y - h * 0.06, x + w / 2, y + h * 0.24);
    ctx.closePath();
  };

  // Draw the entire ticket card
  const drawCard = (inqNum: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set high-res dimensions matching template
    canvas.width = 576;
    canvas.height = 1024;

    const templateImg = new Image();
    templateImg.onload = () => {
      // Create a temporary canvas to process template transparency
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) return;

      // Draw template background on temp canvas
      tempCtx.drawImage(templateImg, 0, 0, canvas.width, canvas.height);

      // Retrieve pixels around the heart area to key out white pixels
      const scanX = 140;
      const scanY = 100;
      const scanW = 300;
      const scanH = 280;
      const imgData = tempCtx.getImageData(scanX, scanY, scanW, scanH);
      const data = imgData.data;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        // If the pixel is white/near-white, make it transparent
        if (r > 230 && g > 230 && b > 230) {
          data[i + 3] = 0; // alpha = 0
        }
      }
      tempCtx.putImageData(imgData, scanX, scanY);

      // Now render on the main canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (couplePhotoPreview) {
        const coupleImg = new Image();
        coupleImg.onload = () => {
          // Bounding box of the heart area where couple image goes
          const hX = 144;
          const hY = 112;
          const hW = 288;
          const hH = 260;

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

          // Apply 10% zoom to ensure full coverage
          const zoom = 1.1;
          const finalW = drawW * zoom;
          const finalH = drawH * zoom;
          const finalOffsetX = offsetX - (finalW - drawW) / 2;
          const finalOffsetY = offsetY - (finalH - drawH) / 2;

          // 1. Draw couple photo first
          ctx.drawImage(coupleImg, hX + finalOffsetX, hY + finalOffsetY, finalW, finalH);

          // 2. Overlay the processed template (with transparent heart window) on top
          ctx.drawImage(tempCanvas, 0, 0);

          // 3. Draw text details
          drawTextDetails(ctx, inqNum);
        };
        coupleImg.src = couplePhotoPreview;
      } else {
        // Fallback: draw template as-is and overlay details
        ctx.drawImage(templateImg, 0, 0);
        drawTextDetails(ctx, inqNum);
      }
    };
    templateImg.src = '/card_template.png';
  };

  const drawTextDetails = (ctx: CanvasRenderingContext2D, inqNum: string) => {
    // 1. Draw a stylish name and ID card covering the sunset couple photo on the right
    const sideX = 385;
    const sideY = 230;
    const sideW = 176;
    const sideH = 135;

    ctx.save();
    // Dark background matching the template theme
    ctx.fillStyle = 'rgba(26, 6, 6, 0.95)';
    ctx.strokeStyle = '#D4AF37';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(sideX, sideY, sideW, sideH, 8);
    ctx.fill();
    ctx.stroke();

    // Text header
    ctx.fillStyle = '#D4AF37';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('COUPLE ENTRY', sideX + sideW / 2, sideY + 20);

    // Couple Names (multi-line layout to fit nicely)
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px sans-serif';
    
    const nameLine1 = `${husbandName}`.toUpperCase();
    const nameLine2 = `& ${wifeName}`.toUpperCase();
    const nameLine3 = `${surname}`.toUpperCase();
    
    ctx.fillText(nameLine1, sideX + sideW / 2, sideY + 45);
    ctx.fillText(nameLine2, sideX + sideW / 2, sideY + 65);
    ctx.fillText(nameLine3, sideX + sideW / 2, sideY + 85);

    // Divider
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sideX + 15, sideY + 98);
    ctx.lineTo(sideX + sideW - 15, sideY + 98);
    ctx.stroke();

    // Token ID
    ctx.fillStyle = '#D4AF37';
    ctx.font = 'bold 12px monospace';
    ctx.fillText(`${inqNum || 'INQ-XXXX'}`, sideX + sideW / 2, sideY + 118);
    ctx.restore();

  };

  // Redraw whenever inputs change
  useEffect(() => {
    if (step === 3) {
      drawCard(inquiryId);
    }
  }, [step, husbandName, wifeName, surname, couplePhotoPreview, inquiryId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!husbandName || !wifeName || !surname || !phoneNumber || !couplePhoto || !selectedProgramId) {
      setError('Please fill in all details, select a program slot, and upload your photo.');
      return;
    }
    const selectedProgram = programs.find(p => p.id === selectedProgramId);
    if (selectedProgram && selectedProgram.bookingsCount + 2 > selectedProgram.capacity) {
      setError('The selected program slot is sold out (not enough seats left for a couple). Please select another slot.');
      return;
    }
    setError('');
    setStep(2); // Go to payment step
  };

  const handlePaymentSubmit = async () => {
    if (!paymentScreenshot) {
      setError('Please upload the payment screenshot to proceed.');
      return;
    }
    setError('');
    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('husbandName', husbandName);
      formData.append('wifeName', wifeName);
      formData.append('surname', surname);
      formData.append('phoneNumber', phoneNumber);
      formData.append('couplePhoto', couplePhoto!);
      formData.append('paymentScreenshot', paymentScreenshot!);
      formData.append('programId', selectedProgramId);

      const response = await fetch('http://localhost:5001/api/submit', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      if (response.ok && result.success) {
        setInquiryId(result.data.inquiryId);
        setStep(3); // Go to generated card step
      } else {
        setError(result.error || 'Something went wrong. Please try again.');
      }
    } catch (err) {
      setError('Connection failed. Make sure backend server is running on port 5001.');
    } finally {
      setSubmitting(false);
    }
  };

  const downloadCard = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `${surname}_${husbandName}_Invitation_Pass.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const selectedProgramName = programs.find(p => p.id === selectedProgramId)?.name || 'Couple Pass';

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between font-sans">
      {/* Header */}
      <header className="py-6 px-8 border-b border-slate-800 bg-slate-950/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center font-bold text-slate-950 text-xl tracking-tight">
              C
            </div>
            <span className="text-xl font-bold tracking-wider text-slate-100">COUPLE CARD GENERATOR</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <span className={step >= 1 ? 'text-amber-500 font-semibold' : ''}>1. Info</span>
            <span>&bull;</span>
            <span className={step >= 2 ? 'text-amber-500 font-semibold' : ''}>2. Payment</span>
            <span>&bull;</span>
            <span className={step >= 3 ? 'text-amber-500 font-semibold' : ''}>3. Card</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-xl bg-slate-950/70 border border-slate-800/80 rounded-3xl p-8 backdrop-blur-xl shadow-2xl relative overflow-hidden">
          {/* Ambient Glows */}
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* STEP 1: Capture Details */}
          {step === 1 && showStatusCheck && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold text-slate-100 tracking-tight">Check Pass Status</h2>
                  <p className="text-slate-400 text-sm mt-1">Enter your Inquiry ID to download your card.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowStatusCheck(false)}
                  className="text-xs text-amber-500 hover:underline font-semibold border border-amber-500/35 hover:bg-amber-500/10 px-3 py-1.5 rounded-xl transition-all"
                >
                  Back to Register
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Inquiry ID</label>
                <input
                  type="text"
                  required
                  value={searchInquiryId}
                  onChange={(e) => setSearchInquiryId(e.target.value)}
                  placeholder="Enter INQ-XXXX"
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors uppercase font-mono tracking-wider"
                />
              </div>

              <button
                type="button"
                onClick={() => {
                  if (searchInquiryId) {
                    window.location.href = `/pass/${searchInquiryId.toUpperCase()}`;
                  }
                }}
                className="w-full py-4 bg-amber-500 hover:bg-amber-600 active:scale-[0.99] text-slate-950 font-bold rounded-2xl transition-all shadow-lg shadow-amber-500/20"
              >
                Check Status & Download
              </button>
            </div>
          )}

          {step === 1 && !showStatusCheck && (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-100 tracking-tight">Couple Registration</h2>
                <p className="text-slate-400 text-sm mt-1">Please fill in your details to generate your token card.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Husband Name</label>
                  <input
                    type="text"
                    required
                    value={husbandName}
                    onChange={(e) => setHusbandName(e.target.value)}
                    placeholder="Enter Husband's Name"
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Wife Name</label>
                  <input
                    type="text"
                    required
                    value={wifeName}
                    onChange={(e) => setWifeName(e.target.value)}
                    placeholder="Enter Wife's Name"
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Surname</label>
                <input
                  type="text"
                  required
                  value={surname}
                  onChange={(e) => setSurname(e.target.value)}
                  placeholder="Enter Surname"
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Phone Number</label>
                <input
                  type="tel"
                  required
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="Enter Phone Number"
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Select Program Slot</label>
                <select
                  required
                  value={selectedProgramId}
                  onChange={(e) => setSelectedProgramId(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
                >
                  <option value="" className="text-slate-500">Choose an available slot</option>
                  {programs.map((prog) => {
                    const remainingSeats = prog.capacity - prog.bookingsCount;
                    const isSoldOut = remainingSeats < 2;
                    return (
                      <option 
                        key={prog.id} 
                        value={prog.id} 
                        disabled={isSoldOut}
                        className={isSoldOut ? "text-slate-600" : "text-slate-100"}
                      >
                        {prog.name} (📅 {prog.date}) {isSoldOut ? "[SOLD OUT]" : `(${Math.floor(remainingSeats / 2)} couples left)`}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Couple Photo</label>
                <div className="border-2 border-dashed border-slate-800 hover:border-amber-500/50 rounded-2xl p-6 text-center cursor-pointer transition-colors relative">
                  <input
                    type="file"
                    accept="image/*"
                    required
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setCouplePhoto(e.target.files[0]);
                      }
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  {couplePhotoPreview ? (
                    <div className="flex flex-col items-center gap-2">
                      <img src={couplePhotoPreview} alt="Couple Preview" className="w-24 h-24 object-cover rounded-xl border border-slate-700" />
                      <span className="text-xs text-slate-400 font-medium">{couplePhoto?.name}</span>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="text-3xl text-slate-500">&uarr;</div>
                      <p className="text-sm font-medium text-slate-300">Upload Couple Photo</p>
                      <p className="text-xs text-slate-500">Supports JPG, PNG, WEBP</p>
                    </div>
                  )}
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-4 bg-amber-500 hover:bg-amber-600 active:scale-[0.99] text-slate-950 font-bold rounded-2xl transition-all shadow-lg shadow-amber-500/20"
              >
                Proceed to Payment
              </button>
            </form>
          )}

          {/* STEP 2: UPI Payment QR Code */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-100 tracking-tight">Complete Payment</h2>
                <p className="text-slate-400 text-sm mt-1">Scan the UPI QR code below and upload a screenshot to verify.</p>
              </div>

              {/* Simulated UPI QR Code */}
              <div className="flex flex-col items-center justify-center p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
                <div className="w-48 h-48 bg-white p-2 rounded-xl flex items-center justify-center shadow-lg">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(`upi://pay?pa=${upiSettings.upiId}&pn=${upiSettings.payeeName}&am=${upiSettings.amount}&cu=INR`)}`}
                    alt="UPI Payment QR Code"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="text-center">
                  <p className="text-amber-500 font-bold text-lg">Amount: ₹{Number(upiSettings.amount).toFixed(2)}</p>
                  <p className="text-xs text-slate-500 mt-1">UPI ID: {upiSettings.upiId}</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Upload Payment Screenshot</label>
                <div className="border-2 border-dashed border-slate-800 hover:border-amber-500/50 rounded-2xl p-6 text-center cursor-pointer transition-colors relative">
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
                      <img src={paymentPreview} alt="Payment Preview" className="w-24 h-24 object-cover rounded-xl border border-slate-700" />
                      <span className="text-xs text-slate-400 font-medium">{paymentScreenshot?.name}</span>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="text-3xl text-slate-500">&uarr;</div>
                      <p className="text-sm font-medium text-slate-300">Upload Payment Screenshot</p>
                      <p className="text-xs text-slate-500">Supports JPG, PNG, WEBP</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 py-4 border border-slate-800 hover:bg-slate-900 active:scale-[0.99] text-slate-300 font-bold rounded-2xl transition-all"
                >
                  Back
                </button>
                <button
                  onClick={handlePaymentSubmit}
                  disabled={submitting}
                  className="flex-1 py-4 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 active:scale-[0.99] text-slate-950 font-bold rounded-2xl transition-all shadow-lg shadow-amber-500/20"
                >
                  {submitting ? 'Verifying...' : 'Submit & Generate'}
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Pass Result & Download (Pending Approval View) */}
          {step === 3 && (
            <div className="space-y-6 flex flex-col items-center py-4">
              <div className="w-16 h-16 rounded-full bg-amber-500/15 text-amber-500 flex items-center justify-center text-3xl animate-bounce">
                ⏳
              </div>
              
              <div className="text-center w-full">
                <h2 className="text-2xl font-bold text-slate-100 tracking-tight">Details Submitted!</h2>
                <p className="text-slate-400 text-sm mt-2 leading-relaxed">પાસ મેળવવા માટે પેમેન્ટ વેરિફિકેશન કરવું જરૂરી છે તે માટે નીચે આપેલા બટન પર ક્લિક કરો.</p>
              </div>

              <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xs text-center my-2">
                <span className="text-xs text-slate-500 uppercase tracking-wider block">Inquiry ID</span>
                <span className="text-2xl font-extrabold text-amber-500 tracking-wider font-mono">{inquiryId}</span>
              </div>

              <div className="w-full space-y-3">
                <a
                  href={`https://wa.me/${ADMIN_WHATSAPP_NUMBER}?text=${encodeURIComponent(`Hello! I have registered for the ${selectedProgramName}. My Inquiry ID is ${inquiryId}. My phone number is ${phoneNumber}. Please verify my payment screenshot.`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full py-4 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-bold rounded-2xl transition-all shadow-lg shadow-emerald-600/20 text-center"
                >
                  💬 Send Details to WhatsApp
                </a>



                <button
                  onClick={() => {
                    setStep(1);
                    setHusbandName('');
                    setWifeName('');
                    setSurname('');
                    setPhoneNumber('');
                    setCouplePhoto(null);
                    setPaymentScreenshot(null);
                    setInquiryId('');
                    setShowStatusCheck(false);
                  }}
                  className="w-full py-3 text-xs text-slate-500 hover:text-slate-400 hover:underline"
                >
                  Register Another Pass
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 px-8 border-t border-slate-800/80 bg-slate-950/20 text-center text-xs text-slate-500">
        &copy; {new Date().getFullYear()} Couple Card Generation System.
      </footer>
    </div>
  );
}
