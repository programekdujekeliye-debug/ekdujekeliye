'use client';

import React, { useState, useEffect } from 'react';
import JSZip from 'jszip';
import { useAdmin } from '../context/AdminContext';
import { registrationsApi } from '../../../services/admin/registrationsApi';
import { Submission } from '../../../types';
import { API_BASE_URL } from '../../../config';
import { DownloadIcon, CheckCircleIcon, SparklesIcon, XIcon, SearchIcon, CameraIcon } from '../../../components/Icons';
import { LuxurySelect } from '../../../components/LuxurySelect';
import toast from 'react-hot-toast';

interface BatchExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultProgramId?: string;
}

export const BatchExportModal: React.FC<BatchExportModalProps> = ({
  isOpen,
  onClose,
  defaultProgramId = ''
}) => {
  const { programs } = useAdmin();

  // Filter state
  const [selectedFormat, setSelectedFormat] = useState<'excel' | 'pdf' | 'framed_zip' | 'raw_zip'>('excel');
  const [exportProgramId, setExportProgramId] = useState(defaultProgramId || '');
  const [exportStatus, setExportStatus] = useState('all');
  const [exportPaymentStatus, setExportPaymentStatus] = useState('all');
  const [exportAttendance, setExportAttendance] = useState('all');
  const [exportType, setExportType] = useState<'all' | 'regular' | 'vip'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Loading & Preview state
  const [isExporting, setIsExporting] = useState(false);
  const [zipProgress, setZipProgress] = useState('');
  const [matchCount, setMatchCount] = useState<number | null>(null);
  const [countingMatches, setCountingMatches] = useState(false);

  // Sync defaultProgramId when modal opens
  useEffect(() => {
    if (isOpen) {
      if (defaultProgramId && defaultProgramId !== 'all') {
        setExportProgramId(defaultProgramId);
      }
    }
  }, [isOpen, defaultProgramId]);

  // Live Count Preview as user modifies filters
  useEffect(() => {
    if (!isOpen) return;

    const updatePreviewCount = async () => {
      try {
        setCountingMatches(true);
        const res = await registrationsApi.getSubmissions({
          programId: exportProgramId !== 'all' ? exportProgramId : undefined,
          status: exportStatus !== 'all' ? exportStatus : undefined,
          paymentStatus: exportPaymentStatus !== 'all' ? exportPaymentStatus : undefined,
          attendance: exportAttendance !== 'all' ? exportAttendance : undefined,
          search: searchQuery || undefined,
          limit: 5000
        });

        let list = res.submissions || [];
        if (exportType === 'vip') {
          list = list.filter((s) => s.inquiryId?.startsWith('IP') || Boolean((s as any).isVip));
        } else if (exportType === 'regular') {
          list = list.filter((s) => !s.inquiryId?.startsWith('IP') && !Boolean((s as any).isVip));
        }
        setMatchCount(list.length);
      } catch (_) {
        setMatchCount(null);
      } finally {
        setCountingMatches(false);
      }
    };

    const timer = setTimeout(updatePreviewCount, 300);
    return () => clearTimeout(timer);
  }, [
    isOpen,
    exportProgramId,
    exportStatus,
    exportPaymentStatus,
    exportAttendance,
    exportType,
    searchQuery
  ]);

  if (!isOpen) return null;

  const fetchFilteredRecords = async (): Promise<Submission[]> => {
    const res = await registrationsApi.getSubmissions({
      programId: exportProgramId !== 'all' ? exportProgramId : undefined,
      status: exportStatus !== 'all' ? exportStatus : undefined,
      paymentStatus: exportPaymentStatus !== 'all' ? exportPaymentStatus : undefined,
      attendance: exportAttendance !== 'all' ? exportAttendance : undefined,
      search: searchQuery || undefined,
      limit: 5000
    });

    let list = res.submissions || [];
    if (exportType === 'vip') {
      list = list.filter((s) => s.inquiryId?.startsWith('IP') || Boolean((s as any).isVip));
    } else if (exportType === 'regular') {
      list = list.filter((s) => !s.inquiryId?.startsWith('IP') && !Boolean((s as any).isVip));
    }
    return list;
  };

  /**
   * Resolves full image URL safely across public local assets and backend uploads
   */
  const resolvePhotoUrl = (photoPath: string): string => {
    if (!photoPath) return '';
    if (photoPath.startsWith('data:') || photoPath.startsWith('http://') || photoPath.startsWith('https://')) {
      return photoPath;
    }
    // Local public assets in frontend
    if (
      photoPath.startsWith('/sample_couple.png') ||
      photoPath.startsWith('/logo.png') ||
      photoPath.startsWith('/frame_template.png') ||
      photoPath.startsWith('/card_template.png')
    ) {
      return photoPath;
    }
    return `${API_BASE_URL}${photoPath.startsWith('/') ? photoPath : `/${photoPath}`}`;
  };

  /**
   * Safe image loader with CORS handling and graceful fallback
   */
  const loadImage = (src: string): Promise<HTMLImageElement | null> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => {
        // Second attempt: without crossOrigin
        const fallbackImg = new Image();
        fallbackImg.onload = () => resolve(fallbackImg);
        fallbackImg.onerror = () => {
          console.warn(`[Export Center] Unable to load image at: ${src}`);
          resolve(null);
        };
        fallbackImg.src = src;
      };
      img.src = src;
    });
  };

  // Original handleDownloadFramedZip with frame_template.png and auto-number
  const handleDownloadFramedZip = async (list: Submission[], progName: string) => {
    const photosList = list.filter((sub) => sub.couplePhoto);
    if (photosList.length === 0) {
      toast.error('No registrations with couple photos found for the selected filters.');
      return;
    }

    setZipProgress('Loading frame template...');
    const frameImg = await loadImage('/frame_template.png');

    const canvas = document.createElement('canvas');
    canvas.width = frameImg?.naturalWidth || 768;
    canvas.height = frameImg?.naturalHeight || 1024;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2D canvas context');

    // Define target frame bounding box inside template
    const startX = canvas.width * 0.08;
    const startY = canvas.height * 0.08;
    const drawWidth = canvas.width * 0.84;
    const drawHeight = canvas.height * 0.84;

    const zip = new JSZip();

    for (let i = 0; i < photosList.length; i++) {
      const sub = photosList[i];
      setZipProgress(`Framing photo ${i + 1} of ${photosList.length} (${sub.inquiryId})...`);

      try {
        const photoPath = sub.couplePhoto!;
        const fullPhotoUrl = resolvePhotoUrl(photoPath);
        const coupleImg = await loadImage(fullPhotoUrl);

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (coupleImg) {
          // Object-fit Cover calculation inside target box
          const targetRatio = drawWidth / drawHeight;
          const imgRatio = coupleImg.width / coupleImg.height;
          let sx = 0, sy = 0, sw = coupleImg.width, sh = coupleImg.height;

          if (imgRatio > targetRatio) {
            sh = coupleImg.height;
            sw = sh * targetRatio;
            sx = (coupleImg.width - sw) / 2;
            sy = 0;
          } else {
            sw = coupleImg.width;
            sh = sw / targetRatio;
            sx = 0;
            sy = (coupleImg.height - sh) / 2;
          }

          // Draw couple photo inside bounding box
          ctx.drawImage(coupleImg, sx, sy, sw, sh, startX, startY, drawWidth, drawHeight);
        } else {
          // Placeholder if image failed to load
          ctx.fillStyle = '#E2E8F0';
          ctx.fillRect(startX, startY, drawWidth, drawHeight);
          ctx.fillStyle = '#64748B';
          ctx.font = 'bold 24px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('Couple Photograph', canvas.width / 2, canvas.height / 2);
        }

        // Draw frame over it (if available)
        if (frameImg) {
          ctx.drawImage(frameImg, 0, 0, canvas.width, canvas.height);
        }

        // Draw inquiryId (Auto Number / Token ID) at the bottom
        ctx.save();
        ctx.fillStyle = '#7a0c0c'; // Premium dark red matching invitation theme
        ctx.font = 'bold 22px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(sub.inquiryId, canvas.width / 2, canvas.height * 0.95);
        ctx.restore();

        // Convert canvas to blob
        const dataUrl = canvas.toDataURL('image/png');
        const base64Data = dataUrl.split(',')[1];

        // Add to zip
        const filename = `${sub.surname || 'Couple'}_${sub.husbandName || 'H'}_${sub.wifeName || 'W'}_${sub.inquiryId}.png`.replace(/[^a-zA-Z0-9_.-]/g, '_');
        zip.file(filename, base64Data, { base64: true });
      } catch (err: any) {
        console.error('Error drawing framed photo for submission:', sub.inquiryId, err);
      }
    }

    setZipProgress('Generating ZIP file...');
    const content = await zip.generateAsync({ type: 'blob' });

    setZipProgress('Downloading...');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(content);
    a.download = `${progName}_framed_photos.zip`.replace(/\s+/g, '_');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    onClose();
  };

  // Original handleDownloadRawZip
  const handleDownloadRawZip = async (list: Submission[], progName: string) => {
    const photosList = list.filter((sub) => sub.couplePhoto);
    if (photosList.length === 0) {
      toast.error('No registrations with couple photos found for the selected filters.');
      return;
    }

    const zip = new JSZip();

    for (let i = 0; i < photosList.length; i++) {
      const sub = photosList[i];
      setZipProgress(`Fetching raw photo ${i + 1} of ${photosList.length}...`);

      try {
        const photoPath = sub.couplePhoto!;
        const fullPhotoUrl = resolvePhotoUrl(photoPath);

        const res = await fetch(fullPhotoUrl);
        if (!res.ok) throw new Error('Fetch failed');
        const blob = await res.blob();

        let ext = 'png';
        const contentType = res.headers.get('content-type');
        if (contentType) {
          if (contentType.includes('jpeg') || contentType.includes('jpg')) ext = 'jpg';
          else if (contentType.includes('png')) ext = 'png';
          else if (contentType.includes('webp')) ext = 'webp';
        }

        const filename = `${sub.inquiryId}.${ext}`;
        zip.file(filename, blob);
      } catch (err: any) {
        console.error('Error fetching raw photo for submission:', sub.inquiryId, err);
      }
    }

    setZipProgress('Generating ZIP file...');
    const content = await zip.generateAsync({ type: 'blob' });

    setZipProgress('Downloading...');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(content);
    a.download = `${progName}_raw_photos.zip`.replace(/\s+/g, '_');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    toast.success('Raw photos ZIP downloaded!');
    onClose();
  };

  const handleExport = async () => {
    try {
      setIsExporting(true);
      setZipProgress('Fetching records...');
      const list = await fetchFilteredRecords();

      if (list.length === 0) {
        toast.error('No registration records found for the selected filter combinations.');
        return;
      }

      const progName =
        exportProgramId && exportProgramId !== 'all'
          ? programs.find((p) => p.id === exportProgramId)?.name || exportProgramId
          : 'All_Batches';

      if (selectedFormat === 'excel') {
        generateExcelDownload(list);
      } else if (selectedFormat === 'pdf') {
        generatePdfPrintView(list);
      } else if (selectedFormat === 'framed_zip') {
        await handleDownloadFramedZip(list, progName);
      } else if (selectedFormat === 'raw_zip') {
        await handleDownloadRawZip(list, progName);
      }
    } catch (err: any) {
      toast.error('Export failed: ' + (err.message || 'Unknown error'));
    } finally {
      setIsExporting(false);
      setZipProgress('');
    }
  };

  const generateExcelDownload = (list: Submission[]) => {
    const rows = [
      [
        'Token ID / Pass ID',
        'Husband Name',
        'Wife Name',
        'Surname',
        'Phone Number',
        'Program Slot',
        'Program Date',
        'Amount (INR)',
        'Payment Status',
        'Payment ID / Method',
        'Gate Attendance',
        'Registration Type',
        'Created Date'
      ],
      ...list.map((s) => {
        const programObj = programs.find((p) => p.id === s.programId || p.slug === s.programId || p.date === s.programDate);
        const dynamicPrice = programObj?.price !== undefined ? programObj.price : 1500;
        const isVip = s.inquiryId?.startsWith('IP') || Boolean((s as any).isVip);
        const amt = s.payment?.amount !== undefined ? s.payment.amount : isVip ? 0 : dynamicPrice;

        return [
          s.inquiryId,
          `"${(s.husbandName || '').replace(/"/g, '""')}"`,
          `"${(s.wifeName || '').replace(/"/g, '""')}"`,
          `"${(s.surname || '').replace(/"/g, '""')}"`,
          `'${s.phoneNumber}`,
          `"${(s.programName || '').replace(/"/g, '""')}"`,
          s.programDate || '',
          amt,
          s.payment?.status || s.status || 'pending',
          s.payment?.razorpayPaymentId || s.payment?.provider || 'Online',
          s.attendance || 'unmarked',
          isVip ? 'VIP / Honorary Pass' : 'Online Couple Pass',
          s.createdAt ? new Date(s.createdAt).toLocaleDateString() : ''
        ];
      })
    ];

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + rows.map((r) => r.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `EDKL_Registrations_Export_${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onClose();
  };

  const generatePdfPrintView = (list: Submission[]) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Pop-up blocked. Please allow pop-ups for this site to generate the PDF report.');
      return;
    }

    const progName =
      exportProgramId && exportProgramId !== 'all'
        ? programs.find((p) => p.id === exportProgramId)?.name || exportProgramId
        : 'All Seminar Batches';

    const rowsHtml = list
      .map((s, idx) => {
        const programObj = programs.find((p) => p.id === s.programId || p.slug === s.programId || p.date === s.programDate);
        const dynamicPrice = programObj?.price !== undefined ? programObj.price : 1500;
        const isVip = s.inquiryId?.startsWith('IP') || Boolean((s as any).isVip);
        const amt = s.payment?.amount !== undefined ? s.payment.amount : isVip ? 0 : dynamicPrice;

        return `
      <tr style="border-bottom: 1px solid #e2e8f0; height: 22px;">
        <td style="padding: 4px 6px; text-align: center; border: 1px solid #cbd5e1; font-size: 10px;">${idx + 1}</td>
        <td style="padding: 4px 6px; font-weight: bold; border: 1px solid #cbd5e1; color: ${isVip ? '#d97706' : '#be123c'}; font-family: monospace; font-size: 10px;">${s.inquiryId}</td>
        <td style="padding: 4px 6px; border: 1px solid #cbd5e1; font-size: 11px;"><strong>${s.husbandName} & ${s.wifeName}</strong> ${s.surname}</td>
        <td style="padding: 4px 6px; text-align: center; border: 1px solid #cbd5e1; font-family: monospace; font-size: 10px;">${s.phoneNumber}</td>
        <td style="padding: 4px 6px; border: 1px solid #cbd5e1; font-size: 10px;">${s.programName || progName}</td>
        <td style="padding: 4px 6px; text-align: center; border: 1px solid #cbd5e1; font-weight: bold; font-size: 10px;">₹${amt}</td>
        <td style="padding: 4px 6px; text-align: center; border: 1px solid #cbd5e1; text-transform: uppercase; font-size: 9px; font-weight: bold;">${s.status}</td>
        <td style="padding: 4px 6px; text-align: center; border: 1px solid #cbd5e1; font-size: 10px; font-weight: bold; color: ${s.attendance === 'present' ? '#059669' : '#64748b'};">
          ${s.attendance === 'present' ? '✓ Present' : s.attendance === 'absent' ? 'Absent' : 'Unmarked'}
        </td>
      </tr>
    `;
      })
      .join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Ek Duje Ke Liye - Registrations Roster Report</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; font-size: 11px; margin: 20px; color: #0f172a; }
          table { width: 100%; border-collapse: collapse; margin-top: 14px; }
          th { background-color: #f8fafc; font-weight: bold; padding: 6px; border: 1px solid #94a3b8; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
          @media print { button { display: none; } }
        </style>
      </head>
      <body>
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #be123c; padding-bottom: 8px;">
          <div>
            <h2 style="margin: 0; color: #881337; font-size: 18px;">Ek Duje Ke Liye &bull; Registrations Master Roster</h2>
            <p style="margin: 3px 0 0 0; color: #475569; font-size: 11px;">
              Scope: <strong>${progName}</strong> &bull; Total Filtered Records: <strong>${list.length} couples</strong>
            </p>
          </div>
          <button onclick="window.print()" style="padding: 8px 16px; background-color: #be123c; color: white; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 12px;">
            Print / Save as PDF
          </button>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 30px;">#</th>
              <th style="width: 85px;">Token ID</th>
              <th>Couple Name</th>
              <th style="width: 100px;">Phone Number</th>
              <th style="width: 140px;">Program Slot</th>
              <th style="width: 65px;">Amount</th>
              <th style="width: 75px;">Status</th>
              <th style="width: 85px;">Gate Attendance</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </body>
      </html>
    `);
    printWindow.document.close();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-5 border border-slate-200 my-auto text-slate-800 animate-in fade-in-50 zoom-in-95">

        {/* Header */}
        <div className="flex justify-between items-center border-b border-slate-100 pb-3 sm:pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-rose-50 to-amber-50 border border-rose-200 text-rose-700 flex items-center justify-center shadow-xs">
              <DownloadIcon className="w-5 h-5 flex-shrink-0" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight">
                Export Center
              </h2>
              <p className="text-[11px] text-slate-500 font-medium">
                Choose format and customize categories to export verified records.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors cursor-pointer"
            aria-label="Close Modal"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        {/* 1. Format Choice Selector (4 original formats) */}
        <div className="space-y-1.5">
          <label className="block text-[10px] font-extrabold text-slate-600 uppercase tracking-wider">
            1. Select Export Format
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => setSelectedFormat('excel')}
              className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col gap-1.5 ${
                selectedFormat === 'excel'
                  ? 'bg-emerald-50/90 border-emerald-400 ring-2 ring-emerald-500/20 text-emerald-950 shadow-xs'
                  : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700'
              }`}
            >
              <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                selectedFormat === 'excel' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-200 text-slate-600'
              }`}>
                <DownloadIcon className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <span className="font-extrabold text-[11px] block truncate">Excel Sheet</span>
                <span className="text-[9px] text-slate-500 block truncate">.CSV Data</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setSelectedFormat('pdf')}
              className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col gap-1.5 ${
                selectedFormat === 'pdf'
                  ? 'bg-rose-50/90 border-rose-400 ring-2 ring-rose-500/20 text-rose-950 shadow-xs'
                  : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700'
              }`}
            >
              <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                selectedFormat === 'pdf' ? 'bg-rose-600 text-white shadow-xs' : 'bg-slate-200 text-slate-600'
              }`}>
                <DownloadIcon className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <span className="font-extrabold text-[11px] block truncate">PDF Report</span>
                <span className="text-[9px] text-slate-500 block truncate">.PDF Doc</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setSelectedFormat('framed_zip')}
              className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col gap-1.5 ${
                selectedFormat === 'framed_zip'
                  ? 'bg-amber-50/90 border-amber-400 ring-2 ring-amber-500/20 text-amber-950 shadow-xs'
                  : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700'
              }`}
            >
              <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                selectedFormat === 'framed_zip' ? 'bg-amber-600 text-white shadow-xs' : 'bg-slate-200 text-slate-600'
              }`}>
                <CameraIcon className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <span className="font-extrabold text-[11px] block truncate">Framed ZIP</span>
                <span className="text-[9px] text-slate-500 block truncate">Frame + Token</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setSelectedFormat('raw_zip')}
              className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col gap-1.5 ${
                selectedFormat === 'raw_zip'
                  ? 'bg-purple-50/90 border-purple-400 ring-2 ring-purple-500/20 text-purple-950 shadow-xs'
                  : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700'
              }`}
            >
              <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                selectedFormat === 'raw_zip' ? 'bg-purple-600 text-white shadow-xs' : 'bg-slate-200 text-slate-600'
              }`}>
                <CameraIcon className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <span className="font-extrabold text-[11px] block truncate">Raw Photos</span>
                <span className="text-[9px] text-slate-500 block truncate">Original ZIP</span>
              </div>
            </button>
          </div>
        </div>

        {/* 2. Dynamic Category Filters */}
        <div className="space-y-3 pt-1">
          <label className="block text-[10px] font-extrabold text-slate-600 uppercase tracking-wider">
            2. Customize Export Scope &amp; Categories
          </label>

          {/* Search Box */}
          <div className="relative">
            <SearchIcon className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by name, phone, or Token ID..."
              className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-rose-500 font-medium"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Program Slot Selector */}
            <LuxurySelect
              label="Seminar Event Batch"
              value={exportProgramId}
              onChange={(val) => setExportProgramId(val)}
              options={[
                { value: '', label: 'All Seminar Slots' },
                ...programs.map((p) => ({
                  value: p.id,
                  label: p.name,
                  sublabel: p.date
                }))
              ]}
            />

            {/* Registration Status */}
            <LuxurySelect
              label="Registration Status"
              value={exportStatus}
              onChange={(val) => setExportStatus(val)}
              options={[
                { value: 'all', label: 'All Registrations' },
                { value: 'approved', label: 'Approved Passes Only', badge: 'PASS' },
                { value: 'pending', label: 'Pending Verification', badge: 'REVIEW' },
                { value: 'rejected', label: 'Rejected Only' }
              ]}
            />

            {/* Payment Status */}
            <LuxurySelect
              label="Payment Status"
              value={exportPaymentStatus}
              onChange={(val) => setExportPaymentStatus(val)}
              options={[
                { value: 'all', label: 'All Payment States' },
                { value: 'paid', label: 'Paid (Captured)', badge: 'PAID' },
                { value: 'pending', label: 'Pending Payment', badge: 'DUE' },
                { value: 'failed', label: 'Failed / Cancelled' }
              ]}
            />

            {/* Gate Attendance */}
            <LuxurySelect
              label="Gate Attendance"
              value={exportAttendance}
              onChange={(val) => setExportAttendance(val)}
              options={[
                { value: 'all', label: 'All Attendance' },
                { value: 'present', label: 'Present (Checked In)', badge: 'IN' },
                { value: 'absent', label: 'Absent' },
                { value: 'unmarked', label: 'Unmarked' }
              ]}
            />

            {/* Pass Category / VIP Scope */}
            <div className="sm:col-span-2">
              <LuxurySelect
                label="Pass Category Scope"
                value={exportType}
                onChange={(val) => setExportType(val as any)}
                options={[
                  { value: 'all', label: 'All Passes (Public Online + VIP Guests)' },
                  { value: 'regular', label: 'Online Paid Couples Only', badge: 'PUBLIC' },
                  { value: 'vip', label: 'VIP Honorary Guests Only (IP-)', badge: 'VIP' }
                ]}
              />
            </div>
          </div>
        </div>

        {/* Live ZIP Progress Display */}
        {zipProgress && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-xs flex items-center gap-2 text-amber-900 font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
            <span className="truncate">{zipProgress}</span>
          </div>
        )}

        {/* 3. Live Matching Preview Ribbon */}
        <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-3 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-bold text-slate-700">Estimated Match:</span>
          </div>
          <span className="font-extrabold font-mono text-slate-900">
            {countingMatches ? 'Calculating...' : matchCount !== null ? `${matchCount} Couple Records` : 'Ready'}
          </span>
        </div>

        {/* 4. Action Buttons with luxury styling */}
        <div className="flex gap-2.5 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl text-xs transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={isExporting || matchCount === 0}
            className={`flex-2 py-3 text-white font-extrabold rounded-2xl text-xs transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 ${
              selectedFormat === 'excel'
                ? 'bg-emerald-700 hover:bg-emerald-800'
                : selectedFormat === 'pdf'
                ? 'bg-rose-700 hover:bg-rose-800'
                : selectedFormat === 'framed_zip'
                ? 'bg-amber-600 hover:bg-amber-700'
                : 'bg-purple-700 hover:bg-purple-800'
            }`}
          >
            <DownloadIcon className="w-4 h-4 flex-shrink-0" />
            <span>
              {isExporting
                ? zipProgress || 'Processing...'
                : selectedFormat === 'excel'
                ? `Export ${matchCount !== null ? `(${matchCount}) ` : ''}Excel Sheet`
                : selectedFormat === 'pdf'
                ? `Export ${matchCount !== null ? `(${matchCount}) ` : ''}PDF Report`
                : selectedFormat === 'framed_zip'
                ? `Export ${matchCount !== null ? `(${matchCount}) ` : ''}Framed Photos ZIP`
                : `Export ${matchCount !== null ? `(${matchCount}) ` : ''}Raw Photos ZIP`}
            </span>
          </button>
        </div>

      </div>
    </div>
  );
};
