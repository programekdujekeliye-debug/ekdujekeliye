'use client';

import React, { useEffect, useState, useRef } from 'react';
import JSZip from 'jszip';
import { API_BASE_URL } from '../../config';
import {
  LayoutDashboardIcon,
  TicketIcon,
  UsersIcon,
  SettingsIcon,
  LogOutIcon,
  SearchIcon,
  DownloadIcon,
  RefreshCwIcon,
  CheckCircleIcon,
  ShieldCheckIcon
} from '../../components/Icons';

interface Submission {
  inquiryId: string;
  husbandName: string;
  wifeName: string;
  surname: string;
  phoneNumber: string;
  couplePhoto: string;
  paymentScreenshot: string | null;
  createdAt: string;
  programId?: string;
  programName?: string;
  programDate?: string;
  status?: string;
  rejectionReason?: string;
  refundReason?: string;
  payeeNameFromReceipt?: string;
  photoZoom?: number;
  photoOffsetY?: number;
  attendance?: 'unmarked' | 'present' | 'absent';
  payment?: {
    provider?: 'razorpay' | 'manual' | 'legacy_upi' | null;
    status?: 'not_required' | 'pending' | 'created' | 'authorized' | 'captured' | 'failed' | 'expired' | 'refunded';
    amount?: number;
    currency?: string;
    razorpayOrderId?: string;
    razorpayPaymentId?: string;
    paidAt?: string;
    failedAt?: string;
  };
}

interface DuplicateGroup {
  id: string;
  type: 'phone' | 'name' | 'both';
  conflictValue: string;
  label: string;
  submissions: Submission[];
}


const compressImage = (file: File, maxWidth = 1000, maxHeight = 1000, quality = 0.7): Promise<File> => {
  return new Promise((resolve) => {
    // 3-second safety timeout: if compression hangs or fails, return the original file
    const timeoutId = setTimeout(() => {
      console.warn('Image compression timed out, using original file');
      resolve(file);
    }, 3000);

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
            resolve(file);
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob(
            (blob) => {
              clearTimeout(timeoutId);
              if (blob) {
                const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
                  type: 'image/jpeg',
                  lastModified: Date.now(),
                });
                resolve(compressedFile);
              } else {
                resolve(file);
              }
            },
            'image/jpeg',
            quality
          );
        } catch (e) {
          console.error('Error in img.onload:', e);
          clearTimeout(timeoutId);
          resolve(file);
        }
      };
      img.onerror = (err) => {
        console.error('img.onerror:', err);
        clearTimeout(timeoutId);
        resolve(file);
      };
    };
    reader.onerror = (err) => {
      console.error('reader.onerror:', err);
      clearTimeout(timeoutId);
      resolve(file);
    };
  });
};

const detectHeartCutout = (base64Image: string): Promise<{ x: number, y: number, w: number, h: number } | null> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 576; // Match standard card width
      canvas.height = 1024; // Match standard card height
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(null);
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      let minX = canvas.width;
      let maxX = 0;
      let minY = canvas.height;
      let maxY = 0;

      const scanXStart = 20;
      const scanYStart = 50;
      const scanWidth = canvas.width - 40;
      const scanHeight = 500;

      const templateData = ctx.getImageData(scanXStart, scanYStart, scanWidth, scanHeight);
      const pixels = templateData.data;

      for (let y = 0; y < scanHeight; y++) {
        for (let x = 0; x < scanWidth; x++) {
          const idx = (y * scanWidth + x) * 4;
          const r = pixels[idx];
          const g = pixels[idx + 1];
          const b = pixels[idx + 2];
          const a = pixels[idx + 3];

          const isTransparent = a < 50;

          if (isTransparent) {
            const actualX = scanXStart + x;
            const actualY = scanYStart + y;
            if (actualX < minX) minX = actualX;
            if (actualX > maxX) maxX = actualX;
            if (actualY < minY) minY = actualY;
            if (actualY > maxY) maxY = actualY;
          }
        }
      }

      if (maxX > minX && maxY > minY) {
        resolve({
          x: minX,
          y: minY,
          w: maxX - minX,
          h: maxY - minY
        });
      } else {
        resolve(null);
      }
    };
    img.src = base64Image;
  });
};

interface Program {
  id: string;
  sequenceNumber?: number;
  name: string;
  slug?: string;
  city?: string;
  venue?: string;
  mapUrl?: string;
  description?: string;
  heroImage?: string;
  price?: number;
  status?: string;
  featured?: boolean;
  registrationMode?: string;
  externalRegistrationUrl?: string;
  sortOrder?: number;
  date: string;
  time?: string;
  capacity: number;
  bookingsCount: number;
  isDateFinal?: boolean;
  cardTemplate?: string;
  heartX?: number;
  heartY?: number;
  heartWidth?: number;
  heartHeight?: number;
  photoZoom?: number;
  photoOffsetY?: number;
  photoLink?: string;
  isInquiryClosed?: boolean;
  inquiryCount?: number;
  pendingCount?: number;
  approvedCount?: number;
  rejectedCount?: number;
  cplApproved?: number;
  cplPending?: number;
  cplInquiry?: number;
  cplRejected?: number;
  ipApproved?: number;
  ipPending?: number;
  ipInquiry?: number;
  ipRejected?: number;
}

const LivePreviewCanvas = ({ sub, frameImg }: { sub: Submission; frameImg: HTMLImageElement | null }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [coupleImg, setCoupleImg] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    const photoPath = sub.couplePhoto;
    const fullPhotoUrl = (photoPath.startsWith('data:') || photoPath.startsWith('http://') || photoPath.startsWith('https://')) ? photoPath : `${API_BASE_URL}${photoPath}`;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setCoupleImg(img);
    };
    img.src = fullPhotoUrl;
  }, [sub.couplePhoto]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !coupleImg || !frameImg) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 384; 
    canvas.height = 512; 

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const startX = canvas.width * 0.08;
    const startY = canvas.height * 0.08;
    const drawWidth = canvas.width * 0.84;
    const drawHeight = canvas.height * 0.84;

    const imgAspect = coupleImg.width / coupleImg.height;
    const targetAspect = drawWidth / drawHeight;
    let tempW = drawWidth;
    let tempH = drawHeight;
    let offsetX = 0;
    let offsetY = 0;

    if (imgAspect > targetAspect) {
      tempW = drawHeight * imgAspect;
      offsetX = -(tempW - drawWidth) / 2;
    } else {
      tempH = drawWidth / imgAspect;
      offsetY = -(tempH - drawHeight) / 2;
    }

    const zoom = sub.photoZoom ?? 1.0;
    const w = tempW * zoom;
    const h = tempH * zoom;
    const ox = offsetX - (w - tempW) / 2;
    const oy = (offsetY - (h - tempH) / 2) + (sub.photoOffsetY ?? 0) / 2; 

    ctx.save();
    ctx.beginPath();
    ctx.rect(startX, startY, drawWidth, drawHeight);
    ctx.clip();
    ctx.drawImage(coupleImg, startX + ox, startY + oy, w, h);
    ctx.restore();

    ctx.drawImage(frameImg, 0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.fillStyle = '#7a0c0c';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(sub.inquiryId, canvas.width / 2, canvas.height * 0.95);
    ctx.restore();
  }, [coupleImg, frameImg, sub.photoZoom, sub.photoOffsetY, sub.inquiryId]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '120px', height: '160px' }}
      className="bg-slate-950 shadow-inner"
    />
  );
};

const matchCplToken = (inquiryId: string, searchToken: string, isBulk: boolean) => {
  const id = inquiryId.trim().toUpperCase();
  const token = searchToken.trim().toUpperCase();
  
  if (id === token) return true;
  
  // If it's a full CPL ID, IP ID or EK ID, match exactly
  if (token.startsWith('CPL-') || token.startsWith('IP-') || /^EK\d+-\d+$/.test(token)) {
    return id === token;
  }
  
  // If token is just a number (e.g. "8" or "0101")
  if (/^\d+$/.test(token)) {
    return id.endsWith(`-${token}`) || id.endsWith(token);
  }
  
  if (isBulk) return false;
  
  // Otherwise fallback to includes
  return id.includes(token);
};

export default function AdminDashboard() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittingAction, setSubmittingAction] = useState<Record<string, 'approve' | 'reject' | 'delete' | 'restore'>>({});
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [programFilter, setProgramFilter] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  
  // Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalSubmissions, setTotalSubmissions] = useState(0);
  const [latestTokenId, setLatestTokenId] = useState('N/A');
  const [goToPageInput, setGoToPageInput] = useState('1');

  // Security States
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [role, setRole] = useState<'admin' | 'superadmin' | null>(null);

  // Programs Management States
  const [programs, setPrograms] = useState<Program[]>([]);
  const [newProgramName, setNewProgramName] = useState('');
  const [newProgramDate, setNewProgramDate] = useState('');
  const [newProgramTime, setNewProgramTime] = useState('8:30 PM');
  const [newProgramPrice, setNewProgramPrice] = useState<number | ''>(1000);
  const [newProgramCity, setNewProgramCity] = useState('Surat');
  const [newProgramVenue, setNewProgramVenue] = useState('Sardar Patel Smruti Bhavan, Varachha, Surat');
  const [newProgramMapUrl, setNewProgramMapUrl] = useState('https://share.google/y1jtFAZXuKusYTiUD');
  const [newProgramStatus, setNewProgramStatus] = useState('upcoming');
  const [newProgramSlug, setNewProgramSlug] = useState('');
  const [newProgramRegistrationMode, setNewProgramRegistrationMode] = useState<'internal' | 'external'>('internal');
  const [newProgramExternalUrl, setNewProgramExternalUrl] = useState('');
  const [newProgramCapacity, setNewProgramCapacity] = useState<number | ''>('');
  const [newProgramIsDateFinal, setNewProgramIsDateFinal] = useState<boolean>(true);
  const [newProgramIsInquiryClosed, setNewProgramIsInquiryClosed] = useState<boolean>(false);
  const [newProgramCardTemplate, setNewProgramCardTemplate] = useState<string | null>(null);
  const [newProgramHeartX, setNewProgramHeartX] = useState<number>(144);
  const [newProgramHeartY, setNewProgramHeartY] = useState<number>(112);
  const [newProgramHeartWidth, setNewProgramHeartWidth] = useState<number>(288);
  const [newProgramHeartHeight, setNewProgramHeartHeight] = useState<number>(260);
  const [newProgramPhotoZoom, setNewProgramPhotoZoom] = useState<number>(1.0);
  const [newProgramPhotoOffsetY, setNewProgramPhotoOffsetY] = useState<number>(0);
  const [newProgramPhotoLink, setNewProgramPhotoLink] = useState('');
  const [programError, setProgramError] = useState('');
  const [programSuccess, setProgramSuccess] = useState('');
  // Frame Zipping states
  const [selectedProgramIdForFrames, setSelectedProgramIdForFrames] = useState<string>('');
  const [zipping, setZipping] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [zipProgress, setZipProgress] = useState('');
  const [sentPassIds, setSentPassIds] = useState<string[]>([]);
  const [sentPhotoIds, setSentPhotoIds] = useState<string[]>([]);

  // Editing States
  const [editingProgram, setEditingProgram] = useState<Program | null>(null);
  const [editProgramName, setEditProgramName] = useState('');
  const [editProgramDate, setEditProgramDate] = useState('');
  const [editProgramTime, setEditProgramTime] = useState('8:30 PM');
  const [editProgramPrice, setEditProgramPrice] = useState<number | ''>(1000);
  const [editProgramCity, setEditProgramCity] = useState('');
  const [editProgramVenue, setEditProgramVenue] = useState('');
  const [editProgramMapUrl, setEditProgramMapUrl] = useState('');
  const [editProgramStatus, setEditProgramStatus] = useState('upcoming');
  const [editProgramSlug, setEditProgramSlug] = useState('');
  const [editProgramRegistrationMode, setEditProgramRegistrationMode] = useState<'internal' | 'external'>('internal');
  const [editProgramExternalUrl, setEditProgramExternalUrl] = useState('');
  const [editProgramCapacity, setEditProgramCapacity] = useState<number | ''>('');
  const [editProgramIsDateFinal, setEditProgramIsDateFinal] = useState<boolean>(true);
  const [editProgramIsInquiryClosed, setEditProgramIsInquiryClosed] = useState<boolean>(false);
  const [editProgramCardTemplate, setEditProgramCardTemplate] = useState<string | null>(null);
  const [editProgramHeartX, setEditProgramHeartX] = useState<number>(144);
  const [editProgramHeartY, setEditProgramHeartY] = useState<number>(112);
  const [editProgramHeartWidth, setEditProgramHeartWidth] = useState<number>(288);
  const [editProgramHeartHeight, setEditProgramHeartHeight] = useState<number>(260);
  const [editProgramPhotoZoom, setEditProgramPhotoZoom] = useState<number>(1.0);
  const [editProgramPhotoOffsetY, setEditProgramPhotoOffsetY] = useState<number>(0);
  const [editProgramPhotoLink, setEditProgramPhotoLink] = useState('');
  const [editProgramError, setEditProgramError] = useState('');
  const [editProgramSuccess, setEditProgramSuccess] = useState('');

  // Duplicate Inquiries States
  const [viewMode, setViewMode] = useState<'all' | 'duplicates' | 'inquiries' | 'trash'>('all');
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [loadingDuplicates, setLoadingDuplicates] = useState(false);
  const [selectedInquiryIds, setSelectedInquiryIds] = useState<string[]>([]);
  const [selectedAttendanceIds, setSelectedAttendanceIds] = useState<string[]>([]);
  const [selectTopCount, setSelectTopCount] = useState<number>(200);
  const [pageSize, setPageSize] = useState<number>(10);
  const [attendanceFilter, setAttendanceFilter] = useState<'all' | 'unmarked' | 'present' | 'absent'>('all');
  const [absentInput, setAbsentInput] = useState('');
  const [activeSection, setActiveSection] = useState<'dashboard' | 'programs' | 'registrations' | 'settings'>('dashboard');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Bulk Review States
  const [reviewingProgramForFrames, setReviewingProgramForFrames] = useState<Program | null>(null);
  const [approvedSubmissionsForFrames, setApprovedSubmissionsForFrames] = useState<Submission[]>([]);
  const [cplSearchQuery, setCplSearchQuery] = useState('');
  const [selectedFrameInquiryIds, setSelectedFrameInquiryIds] = useState<string[]>([]);
  const [globalFrameImg, setGlobalFrameImg] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (reviewingProgramForFrames) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => setGlobalFrameImg(img);
      img.src = '/frame_template.png';
    } else {
      setGlobalFrameImg(null);
    }
  }, [reviewingProgramForFrames]);

  const updateSubmissionCoordInState = (inquiryId: string, field: 'photoZoom' | 'photoOffsetY', value: number) => {
    setSubmissions(prev => prev.map(sub => {
      if (sub.inquiryId === inquiryId) {
        return { ...sub, [field]: value };
      }
      return sub;
    }));
    setApprovedSubmissionsForFrames(prev => prev.map(sub => {
      if (sub.inquiryId === inquiryId) {
        return { ...sub, [field]: value };
      }
      return sub;
    }));
  };

  useEffect(() => {
    const savedPassword = typeof window !== 'undefined' ? sessionStorage.getItem('adminPassword') : null;
    if (savedPassword) {
      setPassword(savedPassword);
      setIsAuthenticated(true);
      fetchSubmissions({ password: savedPassword, page: 1, fetchMetadata: true, showSpinner: false });
    } else {
      setLoading(false);
    }
  }, []);

  const [dbStats, setDbStats] = useState<{ dataSizeMB: number, storageSizeMB: number, totalLimitMB: number } | null>(null);

  const fetchDbStats = async (passVal?: string) => {
    const activePassword = passVal || password || (typeof window !== 'undefined' ? sessionStorage.getItem('adminPassword') : '') || '';
    if (!activePassword) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/db-status`, {
        headers: { 'Authorization': activePassword }
      });
      if (res.ok) {
        const data = await res.json();
        if (data && typeof data.storageSizeMB === 'number') {
          setDbStats(data);
        }
      }
    } catch (err) {
      console.error('Failed to fetch database statistics:', err);
    }
  };

  const [editingSubmission, setEditingSubmission] = useState<Submission | null>(null);
  const [editHusbandName, setEditHusbandName] = useState('');
  const [editWifeName, setEditWifeName] = useState('');
  const [editSurname, setEditSurname] = useState('');
  const [editPhoneNumber, setEditPhoneNumber] = useState('');
  const [editProgramId, setEditProgramId] = useState('');
  const [editCouplePhoto, setEditCouplePhoto] = useState<File | null>(null);
  const [editPaymentScreenshot, setEditPaymentScreenshot] = useState<File | null>(null);
  const [updating, setUpdating] = useState(false);
  const [editError, setEditError] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [editRejectionReason, setEditRejectionReason] = useState('');
  const [editRefundReason, setEditRefundReason] = useState('');
  // Payment Settings States
  const [upiId, setUpiId] = useState('');
  const [upiIdsString, setUpiIdsString] = useState('');
  const [upiLimit, setUpiLimit] = useState(50);
  const [activeUpiIndex, setActiveUpiIndex] = useState(0);
  const [upiBookingsCount, setUpiBookingsCount] = useState(0);
  const [upiIdsList, setUpiIdsList] = useState<string[]>([]);
  const [payeeName, setPayeeName] = useState('');
  const [amount, setAmount] = useState('');
  const [settingsSuccess, setSettingsSuccess] = useState('');
  const [settingsError, setSettingsError] = useState('');
  const [notifications, setNotifications] = useState<any[]>([]);

  // Manual Entry States
  const [manualHusbandName, setManualHusbandName] = useState('');
  const [manualWifeName, setManualWifeName] = useState('');
  const [manualSurname, setManualSurname] = useState('');
  const [manualPhoneNumber, setManualPhoneNumber] = useState('');
  const [manualProgramId, setManualProgramId] = useState('');
  const [manualCouplePhoto, setManualCouplePhoto] = useState<File | null>(null);
  const [manualSuccess, setManualSuccess] = useState('');
  const [manualError, setManualError] = useState('');
  const [manualLoading, setManualLoading] = useState(false);
  const [generatedPassUrl, setGeneratedPassUrl] = useState('');

  // WhatsApp Templates States
  const [whatsappTemplates, setWhatsappTemplates] = useState<any[]>([]);
  const [activeWhatsappTemplate, setActiveWhatsappTemplate] = useState('Hello! Your payment has been verified. You can view and download your pass here: {passUrl}');
  const [activePaymentRequestTemplate, setActivePaymentRequestTemplate] = useState('Hello! I have registered for the {programName}. My Inquiry ID is {inquiryId}. My phone number is {phoneNumber}. Please verify my payment screenshot.');
  const [activePhotoDeliveryTemplate, setActivePhotoDeliveryTemplate] = useState('નમસ્તે {husbandName} & {wifeName}, તમારા પ્રોગ્રામ ({programName}) ના સુંદર ફોટાઓ જોવા માટે નીચેની લિંક પર ક્લિક કરો:\n\nફોટો લિંક: {photoLink}\n\nઆભાર!');
  const [whatsappTemplateTab, setWhatsappTemplateTab] = useState<'pass_delivery' | 'payment_request' | 'photo_delivery'>('pass_delivery');

  const fetchPrograms = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/programs`);
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data.programs || []);
        setPrograms(list);
      }
    } catch (err) {
      console.error('Failed to fetch programs:', err);
    }
  };

  const fetchNotifications = async () => {
    const activePassword = password || sessionStorage.getItem('adminPassword') || '';
    if (!activePassword) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/notifications`, {
        headers: { 'Authorization': activePassword }
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  };

  const dismissNotification = async (id?: string) => {
    const activePassword = password || sessionStorage.getItem('adminPassword') || '';
    if (!activePassword) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/notifications/dismiss`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': activePassword 
        },
        body: JSON.stringify({ id })
      });
      if (res.ok) {
        fetchNotifications();
      }
    } catch (err) {
      console.error('Failed to dismiss notification:', err);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/settings`);
      if (res.ok) {
        const data = await res.json();
        setUpiId(data.upiId || '');
        setPayeeName(data.payeeName || '');
        setAmount(data.amount || '');
        setUpiLimit(data.upiLimit || 50);
        setActiveUpiIndex(data.activeUpiIndex || 0);
        setUpiBookingsCount(data.upiBookingsCount || 0);
        if (data.upiIds && data.upiIds.length > 0) {
          setUpiIdsList(data.upiIds);
          setUpiIdsString(data.upiIds.join(', '));
        } else {
          setUpiIdsList([data.upiId || '']);
          setUpiIdsString(data.upiId || '');
        }
      }
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    }
  };

  const fetchActiveWhatsappTemplate = async () => {
    const activePassword = password || sessionStorage.getItem('adminPassword') || '';
    if (!activePassword) return;
    try {
      const res1 = await fetch(`${API_BASE_URL}/api/whatsapp-templates/active?type=pass_delivery`, {
        headers: { 'Authorization': activePassword }
      });
      if (res1.ok) {
        const data = await res1.json();
        if (data && data.text) {
          setActiveWhatsappTemplate(data.text);
        }
      }
      const res2 = await fetch(`${API_BASE_URL}/api/whatsapp-templates/active?type=payment_request`, {
        headers: { 'Authorization': activePassword }
      });
      if (res2.ok) {
        const data = await res2.json();
        if (data && data.text) {
          setActivePaymentRequestTemplate(data.text);
        }
      }
      const res3 = await fetch(`${API_BASE_URL}/api/whatsapp-templates/active?type=photo_delivery`, {
        headers: { 'Authorization': activePassword }
      });
      if (res3.ok) {
        const data = await res3.json();
        if (data && data.text) {
          setActivePhotoDeliveryTemplate(data.text);
        }
      }
    } catch (err) {
      console.error('Failed to fetch active WhatsApp templates:', err);
    }
  };

  const fetchWhatsappTemplates = async () => {
    const activePassword = password || sessionStorage.getItem('adminPassword') || '';
    if (!activePassword) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/whatsapp-templates`, {
        headers: { 'Authorization': activePassword }
      });
      if (res.ok) {
        const data = await res.json();
        setWhatsappTemplates(data || []);
      }
    } catch (err) {
      console.error('Failed to fetch WhatsApp templates:', err);
    }
  };

  const formatWhatsappMessage = (template: string, sub: Submission) => {
    const siteUrl = typeof window !== 'undefined' ? window.location.origin : 'https://ekdujekeliye.in';
    const passUrl = `${siteUrl}/pass/${sub.inquiryId}`;
    
    return template
      .replace(/{husbandName}/g, sub.husbandName || '')
      .replace(/{wifeName}/g, sub.wifeName || '')
      .replace(/{surname}/g, sub.surname || '')
      .replace(/{inquiryId}/g, sub.inquiryId || '')
      .replace(/{passUrl}/g, passUrl);
  };

  const fetchSubmissions = async (options?: {
    page?: number;
    search?: string;
    status?: string;
    programId?: string;
    attendance?: string;
    sortBy?: string;
    sortOrder?: string;
    password?: string;
    showSpinner?: boolean;
    limit?: number;
    fetchMetadata?: boolean;
  }) => {
    const activePage = options?.page !== undefined ? options.page : currentPage;
    const activeSearch = options?.search !== undefined ? options.search : searchQuery;
    const activeStatus = options?.status !== undefined ? options.status : statusFilter;
    const activeProgramId = options?.programId !== undefined ? options.programId : programFilter;
    const activeAttendance = options?.attendance !== undefined ? options.attendance : attendanceFilter;
    const activeSortBy = options?.sortBy !== undefined ? options.sortBy : sortBy;
    const activeSortOrder = options?.sortOrder !== undefined ? options.sortOrder : sortOrder;
    const activePassword = options?.password || password || sessionStorage.getItem('adminPassword') || '';
    const showSpinner = options?.showSpinner !== false;
    const activeLimit = options?.limit !== undefined ? options.limit : pageSize;

    if (!activePassword) {
      setLoading(false);
      return;
    }
    try {
      if (showSpinner) setLoading(true);
      const url = `${API_BASE_URL}/api/submissions?page=${activePage}&limit=${activeLimit}&search=${encodeURIComponent(activeSearch)}&status=${activeStatus}&programId=${activeProgramId}&sortBy=${activeSortBy}&sortOrder=${activeSortOrder}&attendance=${activeAttendance === 'all' ? '' : activeAttendance}`;
      const res = await fetch(url, {
        headers: {
          'Authorization': activePassword
        }
      });
      if (res.ok) {
        const data = await res.json();
        setSubmissions(data.submissions || []);
        setTotalPages(data.totalPages || 1);
        setTotalSubmissions(data.totalSubmissions || 0);
        setCurrentPage(data.currentPage || activePage);
        setGoToPageInput(String(data.currentPage || activePage));
        
        if (activePage === 1 && data.submissions && data.submissions.length > 0) {
          setLatestTokenId(data.submissions[0].inquiryId);
        }

        setIsAuthenticated(true);
        sessionStorage.setItem('adminPassword', activePassword);
        setError('');

        fetchPrograms();
        fetchDbStats(activePassword);

        if (options?.fetchMetadata) {
          fetchSettings();
          fetchActiveWhatsappTemplate();
          fetchWhatsappTemplates();
          fetchNotifications();

          // Fetch user role
          try {
            const roleRes = await fetch(`${API_BASE_URL}/api/auth/verify`, {
              headers: { 'Authorization': activePassword }
            });
            if (roleRes.ok) {
              const roleData = await roleRes.json();
              setRole(roleData.role);
              sessionStorage.setItem('adminRole', roleData.role);
            }
          } catch (roleErr) {
            console.error('Error fetching role:', roleErr);
          }
        }
        return data.submissions;
      } else if (res.status === 401) {
        setError('Incorrect admin password. Please try again.');
        setIsAuthenticated(false);
        sessionStorage.removeItem('adminPassword');
        sessionStorage.removeItem('adminRole');
      } else {
        setError('Failed to fetch data from backend.');
      }
    } catch (err) {
      setError('Cannot connect to backend server. Make sure it is running on port 5001.');
    } finally {
      if (showSpinner) setLoading(false);
    }
  };

  const fetchDuplicates = async (options?: { password?: string }) => {
    const activePassword = options?.password || password || sessionStorage.getItem('adminPassword') || '';
    if (!activePassword) return;
    try {
      setLoadingDuplicates(true);
      const url = `${API_BASE_URL}/api/submissions/duplicates`;
      const res = await fetch(url, {
        headers: {
          'Authorization': activePassword
        }
      });
      if (res.ok) {
        const data = await res.json();
        setDuplicateGroups(data || []);
      } else {
        console.error('Failed to fetch duplicate submissions');
      }
    } catch (err) {
      console.error('Error fetching duplicates:', err);
    } finally {
      setLoadingDuplicates(false);
    }
  };

  const handleCreateProgram = async (e: React.FormEvent) => {
    e.preventDefault();
    const activePassword = password || (typeof window !== 'undefined' ? sessionStorage.getItem('adminPassword') : '') || '';
    if (!newProgramName || (newProgramIsDateFinal && !newProgramDate) || !newProgramCapacity) {
      setProgramError('Please fill in all required program fields.');
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/programs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': activePassword
        },
        body: JSON.stringify({
          name: newProgramName,
          date: newProgramDate,
          time: newProgramTime,
          price: newProgramPrice ? Number(newProgramPrice) : 1000,
          city: newProgramCity,
          venue: newProgramVenue,
          mapUrl: newProgramMapUrl,
          status: newProgramStatus,
          slug: newProgramSlug,
          registrationMode: newProgramRegistrationMode,
          externalRegistrationUrl: newProgramExternalUrl,
          capacity: Number(newProgramCapacity),
          isDateFinal: newProgramIsDateFinal,
          cardTemplate: newProgramCardTemplate,
          heartX: Number(newProgramHeartX),
          heartY: Number(newProgramHeartY),
          heartWidth: Number(newProgramHeartWidth),
          heartHeight: Number(newProgramHeartHeight),
          photoZoom: Number(newProgramPhotoZoom),
          photoOffsetY: Number(newProgramPhotoOffsetY),
          photoLink: newProgramPhotoLink,
          isInquiryClosed: newProgramIsInquiryClosed
        })
      });
      if (res.ok) {
        setProgramSuccess('Program created successfully.');
        setProgramError('');
        setNewProgramName('');
        setNewProgramDate('');
        setNewProgramTime('8:30 PM');
        setNewProgramPrice(1000);
        setNewProgramCity('Surat');
        setNewProgramVenue('Sardar Patel Smruti Bhavan, Varachha, Surat');
        setNewProgramMapUrl('https://share.google/y1jtFAZXuKusYTiUD');
        setNewProgramStatus('upcoming');
        setNewProgramSlug('');
        setNewProgramRegistrationMode('internal');
        setNewProgramExternalUrl('');
        setNewProgramCapacity('');
        setNewProgramIsDateFinal(true);
        setNewProgramIsInquiryClosed(false);
        setNewProgramCardTemplate(null);
        setNewProgramHeartX(144);
        setNewProgramHeartY(112);
        setNewProgramHeartWidth(288);
        setNewProgramHeartHeight(260);
        setNewProgramPhotoZoom(1.0);
        setNewProgramPhotoOffsetY(0);
        setNewProgramPhotoLink('');
        const fileInput = document.getElementById('programCardTemplateInput') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
        fetchPrograms();
      } else {
        const data = await res.json();
        setProgramError(data.error || 'Failed to create program.');
      }
    } catch (err) {
      setProgramError('Network error creating program.');
    }
  };

  const handleDeleteProgram = async (id: string) => {
    const activePassword = password || (typeof window !== 'undefined' ? sessionStorage.getItem('adminPassword') : '') || '';
    if (!confirm('Are you sure you want to delete this program?')) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/programs/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': activePassword
        }
      });
      if (res.ok) {
        fetchPrograms();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete program.');
      }
    } catch (err) {
      alert('Network error deleting program.');
    }
  };

  const handleEditProgramClick = (prog: Program) => {
    setEditingProgram(prog);
    setEditProgramName(prog.name);
    setEditProgramDate(prog.date);
    setEditProgramTime(prog.time || '8:30 PM');
    setEditProgramPrice(prog.price !== undefined ? prog.price : 1000);
    setEditProgramCity(prog.city || '');
    setEditProgramVenue(prog.venue || '');
    setEditProgramMapUrl(prog.mapUrl || '');
    setEditProgramStatus(prog.status || 'upcoming');
    setEditProgramSlug(prog.slug || '');
    setEditProgramRegistrationMode((prog.registrationMode as any) || 'internal');
    setEditProgramExternalUrl(prog.externalRegistrationUrl || '');
    setEditProgramCapacity(prog.capacity);
    setEditProgramIsDateFinal(prog.isDateFinal !== false);
    setEditProgramCardTemplate(prog.cardTemplate || null);
    setEditProgramHeartX(prog.heartX ?? 144);
    setEditProgramHeartY(prog.heartY ?? 112);
    setEditProgramHeartWidth(prog.heartWidth ?? 288);
    setEditProgramHeartHeight(prog.heartHeight ?? 260);
    setEditProgramPhotoZoom(prog.photoZoom ?? 1.0);
    setEditProgramPhotoOffsetY(prog.photoOffsetY ?? 0);
    setEditProgramPhotoLink(prog.photoLink || '');
    setEditProgramIsInquiryClosed(prog.isInquiryClosed || false);
    setEditProgramError('');
    setEditProgramSuccess('');
  };

  const handleUpdateProgram = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProgram) return;
    const activePassword = password || (typeof window !== 'undefined' ? sessionStorage.getItem('adminPassword') : '') || '';
    if (!editProgramName || (editProgramIsDateFinal && !editProgramDate) || !editProgramCapacity) {
      setEditProgramError('Please fill in all required program fields.');
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/programs/${editingProgram.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': activePassword
        },
        body: JSON.stringify({
          name: editProgramName,
          date: editProgramDate,
          time: editProgramTime,
          price: editProgramPrice ? Number(editProgramPrice) : 1000,
          city: editProgramCity,
          venue: editProgramVenue,
          mapUrl: editProgramMapUrl,
          status: editProgramStatus,
          slug: editProgramSlug,
          registrationMode: editProgramRegistrationMode,
          externalRegistrationUrl: editProgramExternalUrl,
          capacity: Number(editProgramCapacity),
          isDateFinal: editProgramIsDateFinal,
          cardTemplate: editProgramCardTemplate,
          heartX: Number(editProgramHeartX),
          heartY: Number(editProgramHeartY),
          heartWidth: Number(editProgramHeartWidth),
          heartHeight: Number(editProgramHeartHeight),
          photoZoom: Number(editProgramPhotoZoom),
          photoOffsetY: Number(editProgramPhotoOffsetY),
          photoLink: editProgramPhotoLink,
          isInquiryClosed: editProgramIsInquiryClosed
        })
      });
      if (res.ok) {
        setEditProgramSuccess('Program updated successfully.');
        setTimeout(() => setEditingProgram(null), 1000);
        fetchPrograms();
      } else {
        const data = await res.json();
        setEditProgramError(data.error || 'Failed to update program.');
      }
    } catch (err) {
      setEditProgramError('Network error updating program.');
    }
  };

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const activePassword = password || sessionStorage.getItem('adminPassword') || '';
    if (!upiId || !payeeName || !amount) {
      setSettingsError('All fields are required.');
      return;
    }
    try {
      setSettingsSuccess('');
      setSettingsError('');
      const res = await fetch(`${API_BASE_URL}/api/settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': activePassword
        },
        body: JSON.stringify({ upiId, payeeName, amount, upiIds: upiIdsString, upiLimit })
      });
      if (res.ok) {
        setSettingsSuccess('Payment settings updated successfully.');
        fetchSettings();
      } else {
        const data = await res.json();
        setSettingsError(data.error || 'Failed to update settings.');
      }
    } catch (err) {
      setSettingsError('Network error updating settings.');
    }
  };

  const handleManualEntrySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const activePassword = password || sessionStorage.getItem('adminPassword') || '';
    if (!manualHusbandName || !manualWifeName || !manualSurname || !manualPhoneNumber || !manualProgramId) {
      setManualError('All fields are required.');
      return;
    }
    setManualLoading(true);
    setManualError('');
    setManualSuccess('');
    setGeneratedPassUrl('');

    const formData = new FormData();
    formData.append('husbandName', manualHusbandName);
    formData.append('wifeName', manualWifeName);
    formData.append('surname', manualSurname);
    formData.append('phoneNumber', manualPhoneNumber);
    formData.append('programId', manualProgramId);
    if (manualCouplePhoto) {
      formData.append('couplePhoto', manualCouplePhoto);
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/submissions/manual`, {
        method: 'POST',
        headers: {
          'Authorization': activePassword
        },
        body: formData
      });
      if (res.ok) {
        const result = await res.json();
        setManualSuccess('Invitee manual registration completed successfully!');
        const hostUrl = window.location.origin;
        const passLink = `${hostUrl}/pass/${result.data.inquiryId}`;
        setGeneratedPassUrl(passLink);
        setManualHusbandName('');
        setManualWifeName('');
        setManualSurname('');
        setManualPhoneNumber('');
        setManualCouplePhoto(null);
        fetchSubmissions({ showSpinner: false });
        fetchPrograms();
      } else {
        const data = await res.json();
        setManualError(data.error || 'Failed to register invitee.');
      }
    } catch (err) {
      setManualError('Network error registering invitee.');
    } finally {
      setManualLoading(false);
    }
  };

  const handleApproveSubmission = async (inquiryId: string) => {
    const activePassword = password || sessionStorage.getItem('adminPassword') || '';
    setSubmittingAction(prev => ({ ...prev, [inquiryId]: 'approve' }));
    try {
      const res = await fetch(`${API_BASE_URL}/api/submissions/${inquiryId}/approve`, {
        method: 'POST',
        headers: { 'Authorization': activePassword }
      });
      if (res.ok) {
        // Optimistically update status to 'approved' to make the transition feel instant!
        setSubmissions(prev => prev.map(sub => sub.inquiryId === inquiryId ? { ...sub, status: 'approved' } : sub));
        fetchSubmissions({ showSpinner: false });
        fetchDuplicates();
        fetchApprovedSubmissionsForFrames();
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(errData.error || 'Failed to approve submission.');
      }
    } catch (err) {
      alert('Network error.');
    } finally {
      setSubmittingAction(prev => {
        const next = { ...prev };
        delete next[inquiryId];
        return next;
      });
    }
  };

  const handleUpdateAttendance = async (inquiryId: string, attendance: 'present' | 'absent' | 'unmarked') => {
    const activePassword = password || sessionStorage.getItem('adminPassword') || '';
    try {
      const res = await fetch(`${API_BASE_URL}/api/submissions/${inquiryId}/attendance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': activePassword
        },
        body: JSON.stringify({ attendance })
      });
      if (res.ok) {
        fetchSubmissions({ showSpinner: false });
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to update attendance.');
      }
    } catch (err) {
      alert('Network error updating attendance.');
    }
  };

  const handleBulkUpdateAttendance = async (attendance: 'present' | 'absent' | 'unmarked') => {
    if (selectedAttendanceIds.length === 0) {
      alert('Please select at least one submission.');
      return;
    }
    const activePassword = password || sessionStorage.getItem('adminPassword') || '';
    try {
      const res = await fetch(`${API_BASE_URL}/api/submissions/bulk-attendance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': activePassword
        },
        body: JSON.stringify({ inquiryIds: selectedAttendanceIds, attendance })
      });
      if (res.ok) {
        setSelectedAttendanceIds([]);
        fetchSubmissions({ showSpinner: false });
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to update bulk attendance.');
      }
    } catch (err) {
      alert('Network error updating bulk attendance.');
    }
  };

  const handleBulkMoveSubmissions = async (targetProgramId: string) => {
    if (selectedAttendanceIds.length === 0) {
      alert('કૃપા કરીને ઓછામાં ઓછી એક ઇન્ક્વાયરી પસંદ કરો.');
      return;
    }
    if (!targetProgramId) {
      alert('કૃપા કરીને નવો પ્રોગ્રામ પસંદ કરો.');
      return;
    }

    const selectedProgram = programs.find(p => p.id === targetProgramId);
    const programNameStr = selectedProgram ? `${selectedProgram.name} (${selectedProgram.date})` : 'પસંદ કરેલ પ્રોગ્રામ';

    if (!confirm(`શું તમે ખરેખર પસંદ કરેલી ${selectedAttendanceIds.length} ઇન્ક્વાયરીઝને "${programNameStr}" માં ટ્રાન્સફર કરવા માંગો છો?`)) {
      return;
    }

    const activePassword = password || sessionStorage.getItem('adminPassword') || '';
    try {
      const res = await fetch(`${API_BASE_URL}/api/submissions/bulk-move`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': activePassword
        },
        body: JSON.stringify({ inquiryIds: selectedAttendanceIds, targetProgramId })
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message || 'ઇન્ક્વાયરીઝ સફળતાપૂર્વક ટ્રાન્સફર કરવામાં આવી છે.');
        setSelectedAttendanceIds([]);
        fetchSubmissions({ showSpinner: false });
        fetchPrograms();
      } else {
        alert(data.error || 'ઇન્ક્વાયરી ટ્રાન્સફર કરવામાં નિષ્ફળતા.');
      }
    } catch (err) {
      alert('नेटरवर्क भूल: इन्क्वायरी ट्रांसफर थई शकी नथी.');
    }
  };

  const fetchTrashSubmissions = async (options?: { page?: number }) => {
    const activePage = options?.page !== undefined ? options.page : currentPage;
    const activePassword = password || sessionStorage.getItem('adminPassword') || '';
    if (!activePassword) return;
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/submissions/trash?page=${activePage}&limit=10`, {
        headers: { 'Authorization': activePassword }
      });
      if (res.ok) {
        const data = await res.json();
        setSubmissions(data.submissions || []);
        setTotalPages(data.totalPages || 1);
        setTotalSubmissions(data.totalSubmissions || 0);
        setCurrentPage(data.currentPage || activePage);
        setGoToPageInput(String(data.currentPage || activePage));
      }
    } catch (err) {
      console.error('Failed to fetch trash:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreSubmission = async (inquiryId: string) => {
    const activePassword = password || sessionStorage.getItem('adminPassword') || '';
    try {
      const res = await fetch(`${API_BASE_URL}/api/submissions/${inquiryId}/restore`, {
        method: 'POST',
        headers: { 'Authorization': activePassword }
      });
      if (res.ok) {
        alert('Submission restored successfully.');
        fetchTrashSubmissions();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to restore submission.');
      }
    } catch (err) {
      alert('Network error.');
    }
  };

  const handlePermanentDeleteSubmission = async (inquiryId: string) => {
    if (!confirm('Are you sure you want to permanently delete this submission? This action CANNOT be undone.')) return;
    const activePassword = password || sessionStorage.getItem('adminPassword') || '';
    try {
      const res = await fetch(`${API_BASE_URL}/api/submissions/${inquiryId}/permanent`, {
        method: 'DELETE',
        headers: { 'Authorization': activePassword }
      });
      if (res.ok) {
        alert('Submission permanently deleted.');
        fetchTrashSubmissions();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete permanently.');
      }
    } catch (err) {
      alert('Network error.');
    }
  };

  const handleQuickAttendance = async () => {
    if (!programFilter) {
      alert('Please select a program slot first.');
      return;
    }
    if (!absentInput.trim()) {
      alert('Please enter at least one absent token ID.');
      return;
    }

    const absentInquiryIds = absentInput
      .split(',')
      .map(id => id.trim().toUpperCase())
      .filter(Boolean);

    const activePassword = password || sessionStorage.getItem('adminPassword') || '';
    try {
      const res = await fetch(`${API_BASE_URL}/api/submissions/attendance-by-absentees`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': activePassword
        },
        body: JSON.stringify({ programId: programFilter, absentInquiryIds })
      });
      if (res.ok) {
        alert('Attendance processed: specified tokens marked Absent, and all other approved couples marked Present.');
        setAbsentInput('');
        fetchSubmissions({ showSpinner: false });
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to update attendance.');
      }
    } catch (err) {
      alert('Network error updating quick attendance.');
    }
  };

  const handleRejectSubmission = async (inquiryId: string) => {
    const activePassword = password || sessionStorage.getItem('adminPassword') || '';
    const reason = prompt('Enter reason for rejection:');
    if (reason === null) return;
    setSubmittingAction(prev => ({ ...prev, [inquiryId]: 'reject' }));
    try {
      const res = await fetch(`${API_BASE_URL}/api/submissions/${inquiryId}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': activePassword
        },
        body: JSON.stringify({ reason })
      });
      if (res.ok) {
        // Optimistically update status to 'rejected'
        setSubmissions(prev => prev.map(sub => sub.inquiryId === inquiryId ? { ...sub, status: 'rejected', rejectionReason: reason } : sub));
        fetchSubmissions({ showSpinner: false });
        fetchDuplicates();
        fetchApprovedSubmissionsForFrames();
      } else {
        alert('Failed to reject submission.');
      }
    } catch (err) {
      alert('Network error.');
    } finally {
      setSubmittingAction(prev => {
        const next = { ...prev };
        delete next[inquiryId];
        return next;
      });
    }
  };

  const handleDeleteSubmission = async (inquiryId: string) => {
    const activePassword = password || sessionStorage.getItem('adminPassword') || '';
    if (!confirm(`Are you sure you want to delete submission ${inquiryId}? This will free up 2 seats in the program and permanently remove the couple's registration.`)) {
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/submissions/${inquiryId}`, {
        method: 'DELETE',
        headers: { 'Authorization': activePassword }
      });
      if (res.ok) {
        fetchSubmissions({ showSpinner: false });
        fetchDuplicates();
        fetchPrograms();
        fetchApprovedSubmissionsForFrames();
      } else {
        const errData = await res.json();
        alert(errData.error || 'Failed to delete submission.');
      }
    } catch (err) {
      alert('Network error.');
    }
  };

  const handleBulkDeleteSubmissions = async () => {
    if (selectedInquiryIds.length === 0) {
      alert('Please select at least one submission to delete.');
      return;
    }

    const activePassword = password || sessionStorage.getItem('adminPassword') || '';
    if (!confirm(`Are you sure you want to delete the ${selectedInquiryIds.length} selected submissions? This will release ${selectedInquiryIds.length * 2} seats and permanently remove the registrations.`)) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/submissions/bulk-delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': activePassword
        },
        body: JSON.stringify({ inquiryIds: selectedInquiryIds })
      });

      if (res.ok) {
        setSelectedInquiryIds([]);
        fetchSubmissions({ showSpinner: false });
        fetchDuplicates();
        fetchPrograms();
        fetchApprovedSubmissionsForFrames();
      } else {
        const errData = await res.json();
        alert(errData.error || 'Failed to delete submissions.');
      }
    } catch (err) {
      alert('Network error.');
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSubmission) return;
    setUpdating(true);
    setEditError('');

    try {
      let compressedPhoto = editCouplePhoto;
      let compressedScreenshot = editPaymentScreenshot;

      if (editCouplePhoto) {
        try {
          compressedPhoto = await compressImage(editCouplePhoto);
        } catch (err) {
          console.error('Error compressing edit photo:', err);
        }
      }

      if (editPaymentScreenshot) {
        try {
          compressedScreenshot = await compressImage(editPaymentScreenshot);
        } catch (err) {
          console.error('Error compressing edit screenshot:', err);
        }
      }

      const formData = new FormData();
      formData.append('husbandName', editHusbandName);
      formData.append('wifeName', editWifeName);
      formData.append('surname', editSurname);
      formData.append('phoneNumber', editPhoneNumber);
      formData.append('programId', editProgramId);
      formData.append('status', editStatus);
      formData.append('rejectionReason', editRejectionReason);
      formData.append('refundReason', editRefundReason);

      if (compressedPhoto) {
        formData.append('couplePhoto', compressedPhoto);
      }
      if (compressedScreenshot) {
        formData.append('paymentScreenshot', compressedScreenshot);
      }

      const activePassword = password || sessionStorage.getItem('adminPassword') || '';
      const res = await fetch(`${API_BASE_URL}/api/submissions/${editingSubmission.inquiryId}`, {
        method: 'PUT',
        headers: { 'Authorization': activePassword },
        body: formData
      });

      if (res.ok) {
        setEditingSubmission(null);
        setEditCouplePhoto(null);
        setEditPaymentScreenshot(null);
        fetchSubmissions({ showSpinner: false });
        fetchDuplicates();
        fetchPrograms();
      } else {
        const errData = await res.json();
        setEditError(errData.error || 'Failed to update submission.');
      }
    } catch (err) {
      setEditError('Network error updating submission.');
    } finally {
      setUpdating(false);
    }
  };

  const startEditing = (sub: Submission) => {
    setEditingSubmission(sub);
    setEditHusbandName(sub.husbandName);
    setEditWifeName(sub.wifeName);
    setEditSurname(sub.surname);
    setEditPhoneNumber(sub.phoneNumber);
    setEditProgramId(sub.programId || '');
    setEditStatus(sub.status || 'pending');
    setEditRejectionReason(sub.rejectionReason || '');
    setEditRefundReason(sub.refundReason || '');
    setEditCouplePhoto(null);
    setEditPaymentScreenshot(null);
    setEditError('');
  };


  useEffect(() => {
    const savedPassword = sessionStorage.getItem('adminPassword');
    if (savedPassword) {
      fetchSubmissions({ password: savedPassword });
      fetchDuplicates({ password: savedPassword });
    } else {
      setLoading(false);
      fetchSettings();
    }
  }, []);

  const fetchApprovedSubmissionsForFrames = async () => {
    if (!selectedProgramIdForFrames) {
      setApprovedSubmissionsForFrames([]);
      setSelectedFrameInquiryIds([]);
      return;
    }
    const activePassword = password || sessionStorage.getItem('adminPassword') || '';
    if (!activePassword) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/submissions?limit=1000&status=approved&programId=${selectedProgramIdForFrames}`, {
        headers: { 'Authorization': activePassword }
      });
      if (res.ok) {
        const data = await res.json();
        const withPhoto = (data.submissions || []).filter((sub: any) => sub.couplePhoto);
        setApprovedSubmissionsForFrames(withPhoto);
        setSelectedFrameInquiryIds(withPhoto.map((sub: any) => sub.inquiryId));
      }
    } catch (err) {
      console.error('Failed to fetch approved submissions for frames:', err);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchApprovedSubmissionsForFrames();
    }
  }, [selectedProgramIdForFrames, isAuthenticated]);

  // Debounced search query fetching
  useEffect(() => {
    if (!isAuthenticated) return;
    
    const delayDebounceFn = setTimeout(() => {
      fetchSubmissions({
        page: 1,
        search: searchQuery,
        status: statusFilter,
        programId: programFilter,
        attendance: attendanceFilter,
        sortBy: sortBy,
        sortOrder: sortOrder
      });
    }, 400); // 400ms debounce

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, statusFilter, programFilter, attendanceFilter, sortBy, sortOrder, isAuthenticated]);

  // Live Invitation Preview in Edit Modal
  useEffect(() => {
    if (!editingProgram) return;

    const canvas = document.getElementById('programEditPreviewCanvas') as HTMLCanvasElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 576;
    canvas.height = 1024;

    const templateImg = new Image();
    templateImg.crossOrigin = 'anonymous';
    templateImg.onload = () => {
      // Paint solid white background first to avoid transparent areas blending with black canvas background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext('2d');
      if (tempCtx) {
        tempCtx.drawImage(templateImg, 0, 0, canvas.width, canvas.height);

        const hX = editProgramHeartX;
        const hY = editProgramHeartY;
        const hW = editProgramHeartWidth;
        const hH = editProgramHeartHeight;

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
        } catch (e) { }
      }

      const coupleImg = new Image();
      coupleImg.crossOrigin = 'anonymous';
      coupleImg.onload = () => {
        const hX = editProgramHeartX;
        const hY = editProgramHeartY;
        const hW = editProgramHeartWidth;
        const hH = editProgramHeartHeight;

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

        const zoom = editProgramPhotoZoom;
        const finalW = drawW * zoom;
        const finalH = drawH * zoom;
        const finalOffsetX = offsetX - (finalW - drawW) / 2;
        const finalOffsetY = (offsetY - (finalH - drawH) / 2) + editProgramPhotoOffsetY;

        ctx.save();
        ctx.beginPath();
        ctx.rect(hX, hY, hW, hH);
        ctx.clip();

        ctx.drawImage(coupleImg, hX + finalOffsetX, hY + finalOffsetY, finalW, finalH);
        ctx.restore();

        ctx.drawImage(tempCanvas, 0, 0);

        ctx.save();
        const textX = editProgramHeartX + editProgramHeartWidth / 2;
        const textY = editProgramHeartY + editProgramHeartHeight + 28;

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 6;
        ctx.lineJoin = 'round';
        ctx.font = 'bold 30px "Oswald", "Impact", "Arial Narrow", sans-serif';
        ctx.strokeText('EK01-01-SAMPLE', textX, textY);
        ctx.fillStyle = '#D4AF37';
        ctx.fillText('EK01-01-SAMPLE', textX, textY);
        ctx.restore();
      };
      coupleImg.onerror = () => {
        // Draw template anyway if couple photo fails to load
        ctx.drawImage(tempCanvas, 0, 0);

        ctx.save();
        const textX = editProgramHeartX + editProgramHeartWidth / 2;
        const textY = editProgramHeartY + editProgramHeartHeight + 28;

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 6;
        ctx.lineJoin = 'round';
        ctx.font = 'bold 30px "Oswald", "Impact", "Arial Narrow", sans-serif';
        ctx.strokeText('EK01-01-SAMPLE', textX, textY);
        ctx.fillStyle = '#D4AF37';
        ctx.fillText('EK01-01-SAMPLE', textX, textY);
        ctx.restore();
      };
      // Use local sample_couple.png which is guaranteed to load without CORS issues
      coupleImg.src = '/sample_couple.png';
    };
    templateImg.src = editProgramCardTemplate || '/card_template.png';
  }, [
    editingProgram,
    editProgramCardTemplate,
    editProgramHeartX,
    editProgramHeartY,
    editProgramHeartWidth,
    editProgramHeartHeight,
    editProgramPhotoZoom,
    editProgramPhotoOffsetY
  ]);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    fetchSubmissions({ password, fetchMetadata: true, showSpinner: true });
    fetchDuplicates({ password });
  };

  const handleClearData = async () => {
    const activePassword = password || sessionStorage.getItem('adminPassword') || '';
    if (!confirm('WARNING: Are you sure you want to delete ALL couple registrations, reset Inquiry IDs, and clear uploaded photos? This action CANNOT be undone.')) {
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/submissions/clear`, {
        method: 'POST',
        headers: { 'Authorization': activePassword }
      });
      if (res.ok) {
        alert('All data cleared successfully.');
        fetchSubmissions({ page: 1 });
      } else {
        alert('Failed to clear data.');
      }
    } catch (err) {
      alert('Network error.');
    }
  };

  const handleExportCSV = async (exportProgramId: string, exportStatus: string, exportType: string) => {
    const activePassword = password || sessionStorage.getItem('adminPassword') || '';
    setIsExporting(true);
    try {
      const urlParams = new URLSearchParams();
      if (exportProgramId) {
        urlParams.append('programId', exportProgramId);
      }
      if (exportStatus) {
        urlParams.append('status', exportStatus);
      }
      if (exportType) {
        urlParams.append('type', exportType);
      }
      const queryStr = urlParams.toString();
      const fetchUrl = `${API_BASE_URL}/api/submissions/export${queryStr ? `?${queryStr}` : ''}`;

      const res = await fetch(fetchUrl, {
        method: 'GET',
        headers: { 'Authorization': activePassword }
      });
      if (!res.ok) {
        throw new Error('Export request failed.');
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      let filename = `submissions_export_${new Date().toISOString().split('T')[0]}.csv`;
      let programPart = '';
      if (exportProgramId) {
        const prog = programs.find(p => p.id === exportProgramId);
        programPart = prog ? prog.name.replace(/[^a-zA-Z0-9]/g, '_') : exportProgramId;
      }
      
      let statusPart = exportStatus ? exportStatus : '';
      let typePart = exportType ? exportType : '';
      
      const parts = [programPart, statusPart, typePart].filter(Boolean);
      if (parts.length > 0) {
        filename = `submissions_${parts.join('_')}_export_${new Date().toISOString().split('T')[0]}.csv`;
      }
      
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export error:', err);
      alert('Error exporting CSV: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPDF = async (exportProgramId: string, exportStatus: string, exportType: string) => {
    const activePassword = password || sessionStorage.getItem('adminPassword') || '';
    setIsExporting(true);
    try {
      const urlParams = new URLSearchParams();
      urlParams.append('page', '1');
      urlParams.append('limit', '5000'); // Fetch a large number of records to get the full list
      if (exportProgramId) {
        urlParams.append('programId', exportProgramId);
      }
      if (exportStatus) {
        urlParams.append('status', exportStatus);
      }
      if (exportType) {
        urlParams.append('type', exportType);
      }
      const queryStr = urlParams.toString();
      const fetchUrl = `${API_BASE_URL}/api/submissions?${queryStr}`;

      const res = await fetch(fetchUrl, {
        method: 'GET',
        headers: { 'Authorization': activePassword }
      });
      if (!res.ok) {
        throw new Error('Failed to fetch submissions for PDF export.');
      }
      const data = await res.json();
      const list: Submission[] = data.submissions || [];
      if (list.length === 0) {
        alert('No records found for the selected filters.');
        return;
      }

      // Generate a print-friendly HTML and open it in a new window for printing
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        alert('Pop-up blocked. Please allow pop-ups for this site.');
        return;
      }

      const programName = exportProgramId 
        ? (programs.find(p => p.id === exportProgramId)?.name || exportProgramId)
        : 'All Programs';
      
      const statusLabel = exportStatus ? exportStatus.toUpperCase() : 'ALL';
      const typeLabel = exportType ? exportType.toUpperCase() : 'ALL';

      // Group submissions by Inquiry ID number range (1-50, 51-100, 101-150, etc.)
      const groups: Record<number, Submission[]> = {};
      list.forEach(sub => {
        const match = sub.inquiryId.match(/^(?:.*-)?(\d+)$/);
        const num = match ? parseInt(match[1], 10) : null;
        const groupIdx = num ? Math.floor((num - 1) / 50) : 0;
        
        if (!groups[groupIdx]) {
          groups[groupIdx] = [];
        }
        groups[groupIdx].push(sub);
      });

      const sortedGroupKeys = Object.keys(groups)
        .map(Number)
        .sort((a, b) => a - b);

      const printHtmlBlocks = sortedGroupKeys.map((groupIdx, pageIdx) => {
        const chunk = groups[groupIdx];
        chunk.sort((a, b) => {
          const numA = parseInt((a.inquiryId.match(/^(?:.*-)?(\d+)$/) || ['0', '0'])[1], 10) || 0;
          const numB = parseInt((b.inquiryId.match(/^(?:.*-)?(\d+)$/) || ['0', '0'])[1], 10) || 0;
          return numA - numB;
        });

        const rows = chunk.map((sub, idx) => {
          return `
            <tr style="border-bottom: 1px solid #ddd; height: 13.5px;">
              <td style="padding: 1.5px; text-align: center; border: 1px solid #ddd;">${idx + 1}</td>
              <td style="padding: 1.5px; font-weight: bold; border: 1px solid #ddd;">${sub.inquiryId}</td>
              <td style="padding: 1.5px; border: 1px solid #ddd;">${sub.husbandName} & ${sub.wifeName} ${sub.surname}</td>
              <td style="padding: 1.5px; text-align: center; border: 1px solid #ddd;">${sub.phoneNumber}</td>
            </tr>
          `;
        }).join('');

        const pageBreakStyle = pageIdx > 0 ? 'style="page-break-before: always;"' : '';
        const rangeLabel = `${groupIdx * 50 + 1} - ${(groupIdx + 1) * 50}`;

        return `
          <div ${pageBreakStyle} style="page-break-inside: avoid; margin-bottom: 15px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px;">
              <div>
                <h1 style="font-size: 13px; margin: 0; color: #111; font-weight: bold;">Ek Duje Ke Liye - Submissions Report</h1>
                <div style="font-size: 9px; color: #555; margin-top: 1px; line-height: 1.2;">
                  <strong>Program:</strong> ${programName} | 
                  <strong>Status:</strong> ${statusLabel} | 
                  <strong>Type:</strong> ${typeLabel} | 
                  <strong>ID Range:</strong> ${rangeLabel} |
                  <strong>Page:</strong> ${pageIdx + 1} of ${sortedGroupKeys.length} |
                  <strong>Total Records in Range:</strong> ${chunk.length}
                </div>
              </div>
              ${pageIdx === 0 ? `
                <button onclick="window.print()" style="padding: 3px 6px; background-color: #059669; color: white; border: none; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 9px;">
                  Print / Save to PDF
                </button>
              ` : ''}
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 8.5px; border: 1px solid #ddd;">
              <thead>
                <tr>
                  <th style="width: 6%; text-align: center; background-color: #f5f5f5; border: 1px solid #ddd; padding: 2px; font-weight: bold;">#</th>
                  <th style="width: 24%; background-color: #f5f5f5; border: 1px solid #ddd; padding: 2px; font-weight: bold;">Inquiry ID</th>
                  <th style="width: 48%; background-color: #f5f5f5; border: 1px solid #ddd; padding: 2px; font-weight: bold;">Names</th>
                  <th style="width: 22%; text-align: center; background-color: #f5f5f5; border: 1px solid #ddd; padding: 2px; font-weight: bold;">Phone</th>
                </tr>
              </thead>
              <tbody>
                ${rows}
              </tbody>
            </table>
          </div>
        `;
      }).join('');

      printWindow.document.write(`
        <html>
          <head>
            <title>Submissions Report - ${programName}</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 10px; color: #333; }
              @media print {
                body { margin: 5px; }
                button { display: none !important; }
              }
            </style>
          </head>
          <body>
            ${printHtmlBlocks}
            <script>
              window.onload = function() {
                setTimeout(function() {
                  window.print();
                }, 300);
              }
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    } catch (err) {
      console.error('PDF export error:', err);
      alert('Error exporting PDF: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setIsExporting(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('adminPassword');
    sessionStorage.removeItem('adminRole');
    setIsAuthenticated(false);
    setPassword('');
    setSubmissions([]);
    setPrograms([]);
    setRole(null);
  };



  const handleDownloadFramedZip = async (specificProg?: Program) => {
    const prog = specificProg || programs.find(p => p.id === selectedProgramIdForFrames);
    if (!prog) return;

    const searchedCpls = cplSearchQuery
      .split(/[\s,]+/)
      .map(s => s.trim().toUpperCase())
      .filter(Boolean);
    const isBulk = searchedCpls.length > 1;

    const progSubmissions = approvedSubmissionsForFrames.filter(sub => {
      const isSelected = selectedFrameInquiryIds.includes(sub.inquiryId);
      if (!isSelected) return false;
      if (cplSearchQuery.trim()) {
        return searchedCpls.some(cpl => matchCplToken(sub.inquiryId, cpl, isBulk));
      }
      return true;
    });
    if (progSubmissions.length === 0) {
      alert('No selected approved registrations with couple photos found matching the filter.');
      return;
    }

    try {
      setZipping(true);
      setZipProgress('Starting...');
      const zip = new JSZip();

      // Helper to load image
      const loadImage = (src: string): Promise<HTMLImageElement> => {
        return new Promise((resolve, reject) => {
          let safeSrc = src;
          if (typeof window !== 'undefined' && window.location.protocol === 'https:' && safeSrc.startsWith('http://')) {
            safeSrc = safeSrc.replace('http://', 'https://');
          }
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => resolve(img);
          img.onerror = (e) => reject(new Error('Failed to load image: ' + safeSrc));
          img.src = safeSrc;
        });
      };

      // Load frame template
      setZipProgress('Loading frame template...');
      const frameImg = await loadImage('/frame_template.png');

      // Create a temporary canvas
      const canvas = document.createElement('canvas');
      canvas.width = frameImg.naturalWidth || 768;
      canvas.height = frameImg.naturalHeight || 1024;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get 2D context');

      // Define target frame bounding box inside template
      const startX = canvas.width * 0.08;
      const startY = canvas.height * 0.08;
      const drawWidth = canvas.width * 0.84;
      const drawHeight = canvas.height * 0.84;

      for (let i = 0; i < progSubmissions.length; i++) {
        const sub = progSubmissions[i];
        setZipProgress(`Processing photo ${i + 1} of ${progSubmissions.length}...`);

        try {
          // Load couple photo
          const photoPath = sub.couplePhoto;
          const fullPhotoUrl = (photoPath.startsWith('data:') || photoPath.startsWith('http://') || photoPath.startsWith('https://')) ? photoPath : `${API_BASE_URL}${photoPath}`;
          const coupleImg = await loadImage(fullPhotoUrl);

          // Clear canvas
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          // Calculate zoom/offset crops to match preview canvas
          const imgAspect = coupleImg.width / coupleImg.height;
          const targetAspect = drawWidth / drawHeight;
          let tempW = drawWidth;
          let tempH = drawHeight;
          let offsetX = 0;
          let offsetY = 0;

          if (imgAspect > targetAspect) {
            tempW = drawHeight * imgAspect;
            offsetX = -(tempW - drawWidth) / 2;
          } else {
            tempH = drawWidth / imgAspect;
            offsetY = -(tempH - drawHeight) / 2;
          }

          const zoom = sub.photoZoom ?? 1.0;
          const w = tempW * zoom;
          const h = tempH * zoom;
          const ox = offsetX - (w - tempW) / 2;
          const oy = (offsetY - (h - tempH) / 2) + (sub.photoOffsetY ?? 0) * (canvas.height / 1024);

          ctx.save();
          ctx.beginPath();
          ctx.rect(startX, startY, drawWidth, drawHeight);
          ctx.clip();
          ctx.drawImage(coupleImg, startX + ox, startY + oy, w, h);
          ctx.restore();

          // Draw frame over it
          ctx.drawImage(frameImg, 0, 0, canvas.width, canvas.height);

          // Draw inquiryId (Unique ID) below the logo
          ctx.save();
          ctx.fillStyle = '#7a0c0c'; // Premium dark red matching invitation theme
          ctx.font = 'bold 22px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(sub.inquiryId, canvas.width / 2, canvas.height * 0.95);
          ctx.restore();

          // Convert canvas to blob
          const dataUrl = canvas.toDataURL('image/png');
          const base64Data = dataUrl.split(',')[1];

          // Add to zip (using inquiry ID / CPL number as the filename)
          const filename = `${sub.inquiryId}.png`;
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
      a.download = `${prog.name}_framed_photos.zip`.replace(/\s+/g, '_');
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setZipProgress('Done!');
      setTimeout(() => {
        setZipping(false);
        setZipProgress('');
      }, 1500);
    } catch (error: any) {
      alert('Error creating zip: ' + error.message);
      setZipping(false);
      setZipProgress('');
    }
  };

  const handleDownloadRawZip = async (specificProg?: Program) => {
    const prog = specificProg || programs.find(p => p.id === selectedProgramIdForFrames);
    if (!prog) return;

    const searchedCpls = cplSearchQuery
      .split(/[\s,]+/)
      .map(s => s.trim().toUpperCase())
      .filter(Boolean);
    const isBulk = searchedCpls.length > 1;

    const progSubmissions = approvedSubmissionsForFrames.filter(sub => {
      const isSelected = selectedFrameInquiryIds.includes(sub.inquiryId);
      if (!isSelected) return false;
      if (cplSearchQuery.trim()) {
        return searchedCpls.some(cpl => matchCplToken(sub.inquiryId, cpl, isBulk));
      }
      return true;
    });
    if (progSubmissions.length === 0) {
      alert('No selected approved registrations with couple photos found matching the filter.');
      return;
    }

    try {
      setZipping(true);
      setZipProgress('Starting...');
      const zip = new JSZip();

      for (let i = 0; i < progSubmissions.length; i++) {
        const sub = progSubmissions[i];
        setZipProgress(`Fetching raw photo ${i + 1} of ${progSubmissions.length}...`);

        try {
          const photoPath = sub.couplePhoto;
          const fullPhotoUrl = (photoPath.startsWith('data:') || photoPath.startsWith('http://') || photoPath.startsWith('https://')) 
            ? photoPath 
            : `${API_BASE_URL}${photoPath}`;

          const res = await fetch(fullPhotoUrl);
          if (!res.ok) throw new Error('Fetch failed');
          const blob = await res.blob();
          
          // Determine extension from content-type or filename
          let ext = 'png';
          const contentType = res.headers.get('content-type');
          if (contentType) {
            if (contentType.includes('jpeg') || contentType.includes('jpg')) {
              ext = 'jpg';
            } else if (contentType.includes('webp')) {
              ext = 'webp';
            } else if (contentType.includes('png')) {
              ext = 'png';
            }
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
      a.download = `${prog.name}_raw_photos.zip`.replace(/\s+/g, '_');
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setZipProgress('Done!');
      setTimeout(() => {
        setZipping(false);
        setZipProgress('');
      }, 1500);
    } catch (error: any) {
      alert('Error creating zip: ' + error.message);
      setZipping(false);
      setZipProgress('');
    }
  };


  const handleDownloadPassesZip = async (specificProg?: Program) => {
    const prog = specificProg || programs.find(p => p.id === selectedProgramIdForFrames);
    if (!prog) return;

    const searchedCpls = cplSearchQuery
      .split(/[\s,]+/)
      .map(s => s.trim().toUpperCase())
      .filter(Boolean);
    const isBulk = searchedCpls.length > 1;

    const progSubmissions = approvedSubmissionsForFrames.filter(sub => {
      const isSelected = selectedFrameInquiryIds.includes(sub.inquiryId);
      if (!isSelected) return false;
      if (cplSearchQuery.trim()) {
        return searchedCpls.some(cpl => matchCplToken(sub.inquiryId, cpl, isBulk));
      }
      return true;
    });
    if (progSubmissions.length === 0) {
      alert('No selected approved registrations with couple photos found matching the filter.');
      return;
    }

    try {
      setZipping(true);
      setZipProgress('Starting...');
      const zip = new JSZip();

      // Helper to load image
      const loadImage = (src: string): Promise<HTMLImageElement> => {
        return new Promise((resolve, reject) => {
          let safeSrc = src;
          if (typeof window !== 'undefined' && window.location.protocol === 'https:' && safeSrc.startsWith('http://')) {
            safeSrc = safeSrc.replace('http://', 'https://');
          }
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => resolve(img);
          img.onerror = (e) => reject(new Error('Failed to load image: ' + safeSrc));
          img.src = safeSrc;
        });
      };

      // Load program card template
      setZipProgress('Loading pass template...');
      const templatePath = prog.cardTemplate || '/card_template.png';
      const templateImgSrc = (templatePath.startsWith('data:') || templatePath.startsWith('http://') || templatePath.startsWith('https://') || templatePath === '/card_template.png')
        ? templatePath
        : `${API_BASE_URL}${templatePath}`;
      const templateImg = await loadImage(templateImgSrc);

      // Create a temporary canvas for scanning white transparency
      const canvas = document.createElement('canvas');
      canvas.width = 576;
      canvas.height = 1024;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get 2D context');

      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) throw new Error('Could not get temp 2D context');

      tempCtx.drawImage(templateImg, 0, 0, canvas.width, canvas.height);

      const hX = prog.heartX ?? 144;
      const hY = prog.heartY ?? 112;
      const hW = prog.heartWidth ?? 288;
      const hH = prog.heartHeight ?? 260;

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

      // Helper to draw text details on pass
      const drawTextDetails = (context: CanvasRenderingContext2D, sub: any) => {
        context.save();
        const localHX = sub.heartX ?? prog.heartX ?? 144;
        const localHY = sub.heartY ?? prog.heartY ?? 112;
        const localHW = sub.heartWidth ?? prog.heartWidth ?? 288;
        const localHH = sub.heartHeight ?? prog.heartHeight ?? 260;

        const textX = localHX + localHW / 2;
        const textY = localHY - 20;

        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.strokeStyle = '#000000';
        context.lineWidth = 6;
        context.lineJoin = 'round';
        context.font = 'bold 30px "Oswald", "Impact", "Arial Narrow", sans-serif';
        context.strokeText(sub.inquiryId, textX, textY);
        context.fillStyle = '#D4AF37';
        context.fillText(sub.inquiryId, textX, textY);
        context.restore();
      };

      for (let i = 0; i < progSubmissions.length; i++) {
        const sub = progSubmissions[i];
        setZipProgress(`Processing pass ${i + 1} of ${progSubmissions.length}...`);

        try {
          // Load couple photo
          const photoPath = sub.couplePhoto;
          const fullPhotoUrl = (photoPath.startsWith('data:') || photoPath.startsWith('http://') || photoPath.startsWith('https://')) ? photoPath : `${API_BASE_URL}${photoPath}`;
          const coupleImg = await loadImage(fullPhotoUrl);

          // Clear canvas
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          // Calculate zoom/offset crops to match preview canvas
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

          const zoom = sub.photoZoom ?? prog.photoZoom ?? 1.0;
          const finalW = drawW * zoom;
          const finalH = drawH * zoom;
          const finalOffsetX = offsetX - (finalW - drawW) / 2;
          const finalOffsetY = (offsetY - (finalH - drawH) / 2) + ((sub.photoOffsetY ?? prog.photoOffsetY ?? 0));

          ctx.save();
          ctx.beginPath();
          ctx.rect(hX, hY, hW, hH);
          ctx.clip();
          ctx.drawImage(coupleImg, hX + finalOffsetX, hY + finalOffsetY, finalW, finalH);
          ctx.restore();

          // Draw template over it
          ctx.drawImage(tempCanvas, 0, 0);

          // Draw details
          drawTextDetails(ctx, sub);

          // Convert canvas to blob
          const dataUrl = canvas.toDataURL('image/png');
          const base64Data = dataUrl.split(',')[1];

          // Add to zip (using inquiry ID / CPL number as the filename)
          const filename = `${sub.inquiryId}_pass.png`;
          zip.file(filename, base64Data, { base64: true });
        } catch (err: any) {
          console.error('Error drawing pass for submission:', sub.inquiryId, err);
        }
      }

      setZipProgress('Generating ZIP file...');
      const content = await zip.generateAsync({ type: 'blob' });
      
      setZipProgress('Downloading...');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(content);
      a.download = `${prog.name}_entry_passes.zip`.replace(/\s+/g, '_');
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setZipProgress('Done!');
      setTimeout(() => {
        setZipping(false);
        setZipProgress('');
      }, 1500);
    } catch (error: any) {
      alert('Error creating zip: ' + error.message);
      setZipping(false);
      setZipProgress('');
    }
  };

  const handleSaveAndDownloadZip = async () => {
    if (!reviewingProgramForFrames) return;
    const activePassword = password || sessionStorage.getItem('adminPassword') || '';
    const progSubmissions = approvedSubmissionsForFrames.filter(sub => selectedFrameInquiryIds.includes(sub.inquiryId));

    setZipping(true);
    setZipProgress('Saving alignments to database...');

    try {
      // Save coordinates of all submissions to backend
      await Promise.all(progSubmissions.map(async (sub) => {
        const body = {
          photoZoom: sub.photoZoom ?? 1.0,
          photoOffsetY: sub.photoOffsetY ?? 0
        };
        await fetch(`${API_BASE_URL}/api/submissions/${sub.inquiryId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': activePassword
          },
          body: JSON.stringify(body)
        });
      }));
    } catch (e) {
      console.error('Failed to persist photo coordinates:', e);
    }

    // Now trigger download zip using the updated coordinates
    await handleDownloadFramedZip(reviewingProgramForFrames);
  };

  const downloadImage = async (imagePath: string) => {
    try {
      if (imagePath.startsWith('data:')) {
        const a = document.createElement('a');
        a.href = imagePath;
        a.download = 'database_image.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        return;
      }
      const filename = imagePath.split('/').pop() || 'download';
      const fullUrl = (imagePath.startsWith('http://') || imagePath.startsWith('https://')) ? imagePath : `${API_BASE_URL}${imagePath}`;
      const response = await fetch(fullUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      const fullUrl = (imagePath.startsWith('data:') || imagePath.startsWith('http://') || imagePath.startsWith('https://')) ? imagePath : `${API_BASE_URL}${imagePath}`;
      window.open(fullUrl, '_blank');
    }
  };

  const filteredSubmissions = submissions;

  // Login view if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col justify-between font-sans relative overflow-hidden">
        {/* Ambient Warm Light Glows */}
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-amber-200/35 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-rose-200/35 rounded-full blur-3xl pointer-events-none" />

        <div className="flex-grow flex items-center justify-center p-6">
          <div className="w-full max-w-md bg-white border border-slate-200/90 rounded-3xl p-8 md:p-10 shadow-2xl space-y-6">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto mb-3 shadow-inner">
                <ShieldCheckIcon className="w-7 h-7 text-rose-600" />
              </div>
              <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Admin Authentication</h2>
              <p className="text-slate-500 text-xs leading-relaxed font-medium">Enter your master security key to access the management portal.</p>
            </div>

            {error && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs text-center font-bold">
                {error}
              </div>
            )}

            <form onSubmit={handleLoginSubmit} className="space-y-5">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2">Security Key</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3.5 bg-slate-50 border border-slate-300 focus:bg-white focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none transition-all text-center text-lg tracking-widest font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-700 hover:to-amber-700 active:scale-[0.99] text-white font-extrabold rounded-xl transition-all shadow-xl shadow-rose-600/20 text-sm uppercase tracking-wider cursor-pointer"
              >
                {loading ? 'Authenticating...' : 'Access Dashboard'}
              </button>
            </form>
          </div>
        </div>

        <footer className="py-6 text-center text-xs text-slate-500 font-medium">
          Ek Duje Ke Liye &bull; Secure Administrative System
        </footer>
      </div>
    );
  }

  // Dashboard view if authenticated
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans flex flex-col md:flex-row relative">
      {/* Lightbox / Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-3xl max-h-[85vh] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl flex flex-col">
            <img
              src={selectedImage.startsWith('data:') ? selectedImage : `${API_BASE_URL}${selectedImage}`}
              alt="Preview"
              className="max-w-full max-h-[70vh] object-contain bg-slate-50"
            />
            <div className="p-4 bg-white border-t border-slate-200 flex justify-between items-center gap-4">
              <span className="text-xs text-slate-500 font-mono truncate">{selectedImage.startsWith('data:') ? 'Inline Database Image' : selectedImage}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  downloadImage(selectedImage);
                }}
                className="px-4 py-2 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-700 hover:to-amber-700 text-white font-bold rounded-xl text-xs transition-all shadow-md"
              >
                Download File
              </button>
            </div>
            <button
              className="absolute top-4 right-4 bg-white/90 hover:bg-white text-slate-700 rounded-full w-9 h-9 flex items-center justify-center font-bold text-lg shadow-md border border-slate-200 cursor-pointer"
              onClick={() => setSelectedImage(null)}
            >
              &times;
            </button>
          </div>
        </div>
      )}

      {/* Export Program Selection Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 space-y-6 shadow-2xl">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Export Submissions</h3>
              <p className="text-xs text-slate-500 mt-1">Select filters to export submissions to a CSV sheet or PDF report.</p>
            </div>
            
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700">Program Slot</label>
              <select
                id="exportProgramSelect"
                defaultValue=""
                className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-sm rounded-xl px-4 py-3 focus:bg-white focus:outline-none focus:border-rose-500 cursor-pointer"
              >
                <option value="">All Programs (આખો ડેટા)</option>
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.date})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700">Status</label>
              <select
                id="exportStatusSelect"
                defaultValue=""
                className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-sm rounded-xl px-4 py-3 focus:bg-white focus:outline-none focus:border-rose-500 cursor-pointer"
              >
                <option value="">All Statuses (બધા જ સ્ટેટસ)</option>
                <option value="approved">Approved (મંજૂર થયેલ)</option>
                <option value="pending">Pending (પેન્ડિંગ)</option>
                <option value="rejected">Rejected (નામંજૂર થયેલ)</option>
                <option value="refunded">Refunded (રિફંડ કરેલ)</option>
                <option value="inquiry">Inquiries (ઇન્ક્વાયરી)</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700">Registration Type (રજીસ્ટ્રેશન પ્રકાર)</label>
              <select
                id="exportTypeSelect"
                defaultValue=""
                className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-sm rounded-xl px-4 py-3 focus:bg-white focus:outline-none focus:border-rose-500 cursor-pointer"
              >
                <option value="">All Types (બધા જ પ્રકાર)</option>
                <option value="cpl">CPL Only (માત્ર CPL)</option>
                <option value="ip">IP Only (માત્ર IP)</option>
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex gap-4">
                <button
                  onClick={() => {
                    const selectEl = document.getElementById('exportProgramSelect') as HTMLSelectElement | null;
                    const statusEl = document.getElementById('exportStatusSelect') as HTMLSelectElement | null;
                    const typeEl = document.getElementById('exportTypeSelect') as HTMLSelectElement | null;
                    handleExportCSV(selectEl?.value || '', statusEl?.value || '', typeEl?.value || '');
                    setShowExportModal(false);
                  }}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-emerald-500/20 cursor-pointer"
                >
                  Export CSV (એક્સેલ)
                </button>
                <button
                  onClick={() => {
                    const selectEl = document.getElementById('exportProgramSelect') as HTMLSelectElement | null;
                    const statusEl = document.getElementById('exportStatusSelect') as HTMLSelectElement | null;
                    const typeEl = document.getElementById('exportTypeSelect') as HTMLSelectElement | null;
                    handleExportPDF(selectEl?.value || '', statusEl?.value || '', typeEl?.value || '');
                    setShowExportModal(false);
                  }}
                  className="flex-1 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-sky-500/20 cursor-pointer"
                >
                  Export PDF (પીડીએફ)
                </button>
              </div>
              <button
                onClick={() => setShowExportModal(false)}
                className="w-full py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-bold rounded-xl text-xs transition-all mt-2 cursor-pointer"
              >
                Cancel (રદ કરો)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Submission Modal */}
      {editingSubmission && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="relative w-full max-w-lg bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6">
            <div className="flex justify-between items-center border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">Edit Couple Registration</h2>
                <p className="text-xs text-slate-500 font-mono mt-1">Inquiry ID: {editingSubmission.inquiryId}</p>
              </div>
              <button
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm cursor-pointer"
                onClick={() => setEditingSubmission(null)}
              >
                &times;
              </button>
            </div>

            {editError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-medium">
                {editError}
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">Husband Name</label>
                  <input
                    type="text"
                    required
                    value={editHusbandName}
                    onChange={(e) => setEditHusbandName(e.target.value)}
                    placeholder="First Name"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs focus:bg-white focus:outline-none focus:border-rose-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">Wife Name</label>
                  <input
                    type="text"
                    required
                    value={editWifeName}
                    onChange={(e) => setEditWifeName(e.target.value)}
                    placeholder="First Name"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs focus:bg-white focus:outline-none focus:border-rose-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">Surname / Family Name</label>
                <input
                  type="text"
                  required
                  value={editSurname}
                  onChange={(e) => setEditSurname(e.target.value)}
                  placeholder="e.g. Patel"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs focus:bg-white focus:outline-none focus:border-rose-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">Phone Number (WhatsApp)</label>
                <input
                  type="tel"
                  required
                  value={editPhoneNumber}
                  onChange={(e) => setEditPhoneNumber(e.target.value)}
                  placeholder="10-digit number"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs focus:bg-white focus:outline-none focus:border-rose-500 transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">Select Program Slot</label>
                  <select
                    value={editProgramId}
                    onChange={(e) => setEditProgramId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs focus:bg-white focus:outline-none focus:border-rose-500 transition-colors"
                  >
                    {programs.map((p) => {
                      const isSoldOut = p.bookingsCount + 2 > p.capacity;
                      const remainingSeats = p.capacity - p.bookingsCount;
                      const isCurrent = p.id === editingSubmission.programId;
                      return (
                        <option
                          key={p.id}
                          value={p.id}
                          disabled={isSoldOut && !isCurrent}
                        >
                          {p.name} ({p.date}) {isSoldOut && !isCurrent ? "[SOLD OUT]" : `(${Math.floor(remainingSeats / 2)} left)`}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs focus:bg-white focus:outline-none focus:border-rose-500 transition-colors font-semibold"
                  >
                    <option value="inquiry">Inquiry (ઇન્ક્વાયરી)</option>
                    <option value="pending">Pending (પેન્ડિંગ)</option>
                    <option value="approved">Approved (મંજૂર)</option>
                    <option value="rejected">Rejected (નામંજૂર)</option>
                    <option value="refunded">Refunded (રિફંડ કરેલ)</option>
                  </select>
                </div>
              </div>

              {editStatus === 'rejected' && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">Rejection Reason</label>
                  <input
                    type="text"
                    required
                    value={editRejectionReason}
                    onChange={(e) => setEditRejectionReason(e.target.value)}
                    placeholder="Enter reason for rejection"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs focus:bg-white focus:outline-none focus:border-rose-500 transition-colors"
                  />
                </div>
              )}

              {editStatus === 'refunded' && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">Refund Reason</label>
                  <input
                    type="text"
                    required
                    value={editRefundReason}
                    onChange={(e) => setEditRefundReason(e.target.value)}
                    placeholder="Enter reason for refund"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs focus:bg-white focus:outline-none focus:border-rose-500 transition-colors"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">Update Couple Photo</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setEditCouplePhoto(e.target.files?.[0] || null)}
                    className="w-full text-xs text-slate-600 file:mr-2 file:py-1 file:px-2 file:rounded-lg file:border-0 file:text-[10px] file:font-semibold file:bg-slate-200 file:text-slate-700 hover:file:bg-slate-300 cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">Update Payment Screenshot</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setEditPaymentScreenshot(e.target.files?.[0] || null)}
                    className="w-full text-xs text-slate-600 file:mr-2 file:py-1 file:px-2 file:rounded-lg file:border-0 file:text-[10px] file:font-semibold file:bg-slate-200 file:text-slate-700 hover:file:bg-slate-300 cursor-pointer"
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingSubmission(null)}
                  className="flex-1 py-2.5 border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-xs transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="flex-1 py-2.5 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-700 hover:to-amber-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition-all shadow-md cursor-pointer"
                >
                  {updating ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingProgram && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6">
            <div className="flex justify-between items-center border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">Edit Program Slot</h2>
              </div>
              <button
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm cursor-pointer"
                onClick={() => setEditingProgram(null)}
              >
                &times;
              </button>
            </div>

            {editProgramError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-medium">
                {editProgramError}
              </div>
            )}
            {editProgramSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-xl font-medium">
                {editProgramSuccess}
              </div>
            )}

            <form onSubmit={handleUpdateProgram} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">Program Name</label>
                <input
                  type="text"
                  required
                  value={editProgramName}
                  onChange={(e) => setEditProgramName(e.target.value)}
                  placeholder="e.g. Ek Duje Ke Liye - Sardar Patel Smruti Bhavan"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:border-rose-500 transition-colors font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">Program Date</label>
                  <input
                    type="date"
                    required={editProgramIsDateFinal}
                    value={editProgramDate}
                    onChange={(e) => setEditProgramDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:border-rose-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">Event Time</label>
                  <input
                    type="text"
                    value={editProgramTime}
                    onChange={(e) => setEditProgramTime(e.target.value)}
                    placeholder="e.g. 8:30 PM"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:border-rose-500 transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">Couple Pass Price (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={editProgramPrice}
                    onChange={(e) => setEditProgramPrice(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="e.g. 1000"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm font-bold focus:bg-white focus:outline-none focus:border-rose-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">City</label>
                  <input
                    type="text"
                    value={editProgramCity}
                    onChange={(e) => setEditProgramCity(e.target.value)}
                    placeholder="e.g. Surat"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:border-rose-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">Venue & Address</label>
                <input
                  type="text"
                  value={editProgramVenue}
                  onChange={(e) => setEditProgramVenue(e.target.value)}
                  placeholder="e.g. Sardar Patel Smruti Bhavan, Varachha, Surat"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:border-rose-500 transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">Program Status</label>
                  <select
                    value={editProgramStatus}
                    onChange={(e) => setEditProgramStatus(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm font-semibold focus:bg-white focus:outline-none focus:border-rose-500 transition-colors"
                  >
                    <option value="upcoming">Upcoming (Active)</option>
                    <option value="few_seats">Few Seats Left</option>
                    <option value="housefull">Housefull / Sold Out</option>
                    <option value="registration_closed">Registration Closed</option>
                    <option value="completed">Completed / Past</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">Registration Mode</label>
                  <select
                    value={editProgramRegistrationMode}
                    onChange={(e) => setEditProgramRegistrationMode(e.target.value as 'internal' | 'external')}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm font-semibold focus:bg-white focus:outline-none focus:border-rose-500 transition-colors"
                  >
                    <option value="internal">Internal (Website & Razorpay)</option>
                    <option value="external">External Link</option>
                  </select>
                </div>
              </div>

              {editProgramRegistrationMode === 'external' && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">External Registration URL</label>
                  <input
                    type="url"
                    value={editProgramExternalUrl}
                    onChange={(e) => setEditProgramExternalUrl(e.target.value)}
                    placeholder="https://allevents.in/..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:border-rose-500 transition-colors"
                  />
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">Google Maps Link</label>
                <input
                  type="url"
                  value={editProgramMapUrl}
                  onChange={(e) => setEditProgramMapUrl(e.target.value)}
                  placeholder="https://maps.google.com/..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:border-rose-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">Custom Event URL Slug (Optional)</label>
                <input
                  type="text"
                  value={editProgramSlug}
                  onChange={(e) => setEditProgramSlug(e.target.value)}
                  placeholder="e.g. surat-7-september-2026"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:border-rose-500 transition-colors"
                />
              </div>

              <div className="flex items-center gap-2 py-1">
                <input
                  type="checkbox"
                  id="editProgramIsDateFinal"
                  checked={editProgramIsDateFinal}
                  onChange={(e) => setEditProgramIsDateFinal(e.target.checked)}
                  className="rounded bg-slate-50 border-slate-300 text-rose-600 focus:ring-rose-500 h-4 w-4"
                />
                <label htmlFor="editProgramIsDateFinal" className="text-xs font-bold text-slate-700 cursor-pointer">
                  Date is Final? / Collect Payment (તારીખ નક્કી છે / પેમેન્ટ લેવું)
                </label>
              </div>

              {!editProgramIsDateFinal && (
                <div className="flex items-center gap-2 py-1">
                  <input
                    type="checkbox"
                    id="editProgramIsInquiryClosed"
                    checked={editProgramIsInquiryClosed}
                    onChange={(e) => setEditProgramIsInquiryClosed(e.target.checked)}
                    className="rounded bg-slate-50 border-slate-300 text-rose-600 focus:ring-rose-500 h-4 w-4"
                  />
                  <label htmlFor="editProgramIsInquiryClosed" className="text-xs font-bold text-slate-700 cursor-pointer">
                    Close Inquiry Registration? (ઇન્ક્વાયરી લેવાનું બંધ કરવું)
                  </label>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">Hall Capacity (Seats, e.g. 600 for 300 Couples)</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={editProgramCapacity}
                  onChange={(e) => setEditProgramCapacity(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="e.g. 600"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:border-rose-500 transition-colors"
                />
              </div>

              {editProgramIsDateFinal && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
                  <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider block">Pass Layout Configuration</span>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-600 uppercase tracking-wider mb-1">Heart X Offset ({editProgramHeartX}px)</label>
                      <input
                        type="range"
                        min="0"
                        max="800"
                        value={editProgramHeartX}
                        onChange={(e) => setEditProgramHeartX(Number(e.target.value))}
                        className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-rose-600"
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] font-bold text-slate-600 uppercase tracking-wider mb-1">Heart Y Offset ({editProgramHeartY}px)</label>
                      <input
                        type="range"
                        min="0"
                        max="800"
                        value={editProgramHeartY}
                        onChange={(e) => setEditProgramHeartY(Number(e.target.value))}
                        className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-rose-600"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold text-slate-600 uppercase tracking-wider mb-1">Heart Width ({editProgramHeartWidth}px)</label>
                    <input
                      type="range"
                      min="50"
                      max="500"
                      value={editProgramHeartWidth}
                      onChange={(e) => setEditProgramHeartWidth(Number(e.target.value))}
                      className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-rose-600"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold text-slate-600 uppercase tracking-wider mb-1">Heart Height ({editProgramHeartHeight}px)</label>
                    <input
                      type="range"
                      min="50"
                      max="500"
                      value={editProgramHeartHeight}
                      onChange={(e) => setEditProgramHeartHeight(Number(e.target.value))}
                      className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-rose-600"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold text-slate-600 uppercase tracking-wider mb-1">Photo Zoom ({editProgramPhotoZoom}x)</label>
                    <input
                      type="range"
                      min="0.5"
                      max="2.5"
                      step="0.05"
                      value={editProgramPhotoZoom}
                      onChange={(e) => setEditProgramPhotoZoom(Number(e.target.value))}
                      className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-rose-600"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold text-slate-600 uppercase tracking-wider mb-1">Photo Vertical Shift ({editProgramPhotoOffsetY}px)</label>
                    <input
                      type="range"
                      min="-300"
                      max="300"
                      value={editProgramPhotoOffsetY}
                      onChange={(e) => setEditProgramPhotoOffsetY(Number(e.target.value))}
                      className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-rose-600"
                    />
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditProgramHeartX(144);
                        setEditProgramHeartY(112);
                        setEditProgramHeartWidth(288);
                        setEditProgramHeartHeight(260);
                        setEditProgramPhotoZoom(1.0);
                        setEditProgramPhotoOffsetY(0);
                      }}
                      className="w-full py-2 bg-white hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-bold transition-all border border-slate-300 cursor-pointer"
                    >
                      Reset to Default Layout
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">Entry Pass Template Image (Optional)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = async () => {
                        const base64 = reader.result as string;
                        setEditProgramCardTemplate(base64);
                        const coords = await detectHeartCutout(base64);
                        if (coords) {
                          setEditProgramHeartX(coords.x);
                          setEditProgramHeartY(coords.y);
                          setEditProgramHeartWidth(coords.w);
                          setEditProgramHeartHeight(coords.h);
                        }
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="w-full text-slate-600 text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-slate-200 file:text-slate-700 hover:file:bg-slate-300 file:cursor-pointer cursor-pointer bg-slate-50 border border-slate-300 rounded-xl px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">Photo Gallery Link (ફોટો ગેલેરી લિંક)</label>
                <input
                  type="url"
                  value={editProgramPhotoLink}
                  onChange={(e) => setEditProgramPhotoLink(e.target.value)}
                  placeholder="e.g. https://photos.google.com/..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:border-rose-500 transition-colors"
                />
              </div>

              <div className="pt-4 flex gap-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingProgram(null)}
                  className="flex-1 py-2.5 border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-xs transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-700 hover:to-amber-700 text-white font-bold rounded-xl text-xs transition-all shadow-md cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {reviewingProgramForFrames && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="relative w-full max-w-4xl h-[90vh] bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-2xl flex flex-col space-y-6">
            <div className="flex justify-between items-center border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">Review &amp; Adjust Framed Photos</h2>
                <p className="text-xs text-slate-500 mt-1">Program: {reviewingProgramForFrames.name} ({reviewingProgramForFrames.date})</p>
              </div>
              <button 
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm cursor-pointer"
                onClick={() => setReviewingProgramForFrames(null)}
              >
                &times;
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-4">
              {approvedSubmissionsForFrames.filter(sub => selectedFrameInquiryIds.includes(sub.inquiryId)).map((sub) => (
                  <div key={sub.inquiryId} className="flex flex-col sm:flex-row items-center gap-6 bg-slate-50 border border-slate-200 rounded-2xl p-4 shadow-sm">
                    <div className="w-[120px] h-[160px] overflow-hidden rounded-xl border border-slate-200 bg-white flex items-center justify-center flex-shrink-0">
                      <LivePreviewCanvas sub={sub} frameImg={globalFrameImg} />
                    </div>

                    <div className="flex-1 w-full space-y-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold text-slate-900 text-sm">{sub.husbandName} &amp; {sub.wifeName} {sub.surname}</p>
                          <p className="text-[10px] text-rose-700 font-mono font-bold mt-0.5">{sub.inquiryId}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[9px] font-bold text-slate-600 uppercase tracking-wider mb-1">Zoom ({sub.photoZoom || 1.0}x)</label>
                          <input
                            type="range"
                            min="0.5"
                            max="2.5"
                            step="0.05"
                            value={sub.photoZoom || 1.0}
                            onChange={(e) => updateSubmissionCoordInState(sub.inquiryId, 'photoZoom', Number(e.target.value))}
                            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-rose-600"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-slate-600 uppercase tracking-wider mb-1">Vertical Shift ({sub.photoOffsetY || 0}px)</label>
                          <input
                            type="range"
                            min="-300"
                            max="300"
                            value={sub.photoOffsetY || 0}
                            onChange={(e) => updateSubmissionCoordInState(sub.inquiryId, 'photoOffsetY', Number(e.target.value))}
                            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-rose-600"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              }
            </div>

            <div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => setReviewingProgramForFrames(null)}
                className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-xs transition-all cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={() => handleDownloadFramedZip(reviewingProgramForFrames)}
                disabled={zipping || selectedFrameInquiryIds.length === 0}
                className="px-4 py-2 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-700 hover:to-amber-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition-all shadow-md cursor-pointer"
              >
                {zipping ? `Processing (${zipProgress})` : 'Save Alignments & Download ZIP'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar Navigation */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-slate-200 shadow-sm flex flex-col justify-between transform transition-transform duration-300 md:translate-x-0 ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 space-y-8 flex-grow flex flex-col">
          {/* Logo / Title */}
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Logo" className="h-9 w-auto object-contain" />
            <div>
              <h2 className="font-extrabold text-slate-900 text-sm tracking-tight">Ek Duje Ke Liye</h2>
              <span className="text-[10px] text-rose-700 font-bold tracking-wider uppercase">Admin Portal</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5 flex-grow">
            <button
              onClick={() => { setActiveSection('dashboard'); setMobileSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all ${activeSection === 'dashboard' ? 'bg-rose-50 border border-rose-200 text-rose-800 shadow-xs' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
            >
              <LayoutDashboardIcon className="w-4 h-4 flex-shrink-0 text-rose-600" />
              <span>Dashboard</span>
              <span className="text-[10px] opacity-75 font-normal ml-auto">(ડેશબોર્ડ)</span>
            </button>
            <button
              onClick={() => { setActiveSection('programs'); setMobileSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all ${activeSection === 'programs' ? 'bg-rose-50 border border-rose-200 text-rose-800 shadow-xs' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
            >
              <TicketIcon className="w-4 h-4 flex-shrink-0 text-rose-600" />
              <span>Program Slots</span>
              <span className="text-[10px] opacity-75 font-normal ml-auto">(સ્લોટ)</span>
            </button>
            <button
              onClick={() => { setActiveSection('registrations'); setMobileSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all ${activeSection === 'registrations' ? 'bg-rose-50 border border-rose-200 text-rose-800 shadow-xs' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
            >
              <UsersIcon className="w-4 h-4 flex-shrink-0 text-rose-600" />
              <span>Registrations</span>
              <span className="text-[10px] opacity-75 font-normal ml-auto">(રજીસ્ટ્રેશન)</span>
            </button>
            <button
              onClick={() => { setActiveSection('settings'); setMobileSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all ${activeSection === 'settings' ? 'bg-rose-50 border border-rose-200 text-rose-800 shadow-xs' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
            >
              <SettingsIcon className="w-4 h-4 flex-shrink-0 text-rose-600" />
              <span>Settings</span>
              <span className="text-[10px] opacity-75 font-normal ml-auto">(સેટિંગ્સ)</span>
            </button>
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="p-6 border-t border-slate-200 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center font-bold text-xs text-rose-700">
              {role === 'superadmin' ? 'SA' : 'A'}
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800 capitalize">{role}</p>
              <span className="text-[9px] text-slate-500 font-medium">Active Session</span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full py-2.5 bg-red-50 hover:bg-red-100 text-red-700 font-bold rounded-xl text-xs transition-all border border-red-200 flex items-center justify-center gap-2 cursor-pointer"
          >
            <LogOutIcon className="w-3.5 h-3.5" />
            <span>Log Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Backdrop Overlay */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 z-30 md:hidden backdrop-blur-xs transition-opacity"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Main Content Area */}
      <div className="flex-grow md:pl-64 flex flex-col min-h-screen bg-[#F8FAFC]">
        {/* Mobile Header Bar */}
        <header className="md:hidden bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center z-30 sticky top-0 shadow-xs">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Logo" className="h-8 w-auto object-contain" />
            <span className="font-extrabold text-slate-900 text-sm tracking-tight">EKDJK Admin</span>
          </div>
          <button
            onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
            className="p-2 bg-slate-100 border border-slate-200 hover:bg-slate-200 text-slate-700 rounded-xl transition-all cursor-pointer"
          >
            {mobileSidebarOpen ? (
              <span className="text-xs font-bold px-1">✕</span>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </header>

        {/* Content Container */}
        <main className="p-6 md:p-8 space-y-8 flex-grow overflow-y-auto max-w-[1600px] mx-auto w-full">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 pb-6">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
              <img src="/logo.png" alt="Ek Duje Ke Liye Logo" className="h-9 w-auto object-contain" />
              Admin Dashboard
            </h1>
            <p className="text-slate-500 text-sm mt-1 font-medium">
              Manage, verify, and view all couple card registration entries.
              {role === 'superadmin' && <span className="ml-2 px-2 py-0.5 bg-purple-50 border border-purple-200 text-purple-700 text-xs font-bold rounded-md">SUPER ADMIN</span>}
            </p>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            {role === 'superadmin' && (
              <button
                onClick={handleClearData}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-sm transition-all shadow-md shadow-red-600/20 cursor-pointer"
              >
                Clear All Data
              </button>
            )}
            <button
              onClick={() => setShowExportModal(true)}
              disabled={isExporting}
              className="flex-1 sm:flex-initial px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-800 disabled:opacity-50 text-white font-bold rounded-xl text-xs sm:text-sm transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer"
            >
              {isExporting ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span>Exporting...</span>
                </>
              ) : (
                <>
                  <DownloadIcon className="w-4 h-4" />
                  <span>Export Sheet</span>
                </>
              )}
            </button>
            <button
              onClick={() => fetchSubmissions()}
              className="flex-1 sm:flex-initial px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-xs sm:text-sm transition-all border border-slate-300 shadow-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCwIcon className="w-4 h-4" />
              <span>Refresh</span>
            </button>
            <button
              onClick={handleLogout}
              className="flex-1 sm:flex-initial px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-700 font-bold rounded-xl text-xs sm:text-sm transition-all border border-red-200 flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogOutIcon className="w-3.5 h-3.5" />
              <span>Log Out</span>
            </button>
        </div>
      </div>

        {/* UPI Auto-Rotation Notifications Banner */}
        {notifications.length > 0 && (
          <div className="space-y-3">
            {notifications.map((notif) => (
              <div 
                key={notif._id}
                className={`p-4 rounded-2xl border flex justify-between items-start gap-4 transition-all shadow-sm ${
                  notif.type === 'error' 
                    ? 'bg-red-50 border-red-200 text-red-800' 
                    : 'bg-amber-50 border-amber-200 text-amber-900'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-lg mt-0.5">{notif.type === 'error' ? '⚠️' : 'ℹ️'}</span>
                  <div>
                    <h4 className="text-xs font-bold">{notif.title || 'System Notification'}</h4>
                    <p className="text-xs mt-0.5 opacity-90">{notif.message}</p>
                  </div>
                </div>
                <button
                  onClick={() => dismissNotification(notif._id)}
                  className="text-xs font-bold hover:opacity-75"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

          {activeSection === 'dashboard' && (
            <>
              {/* Stats Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="p-6 bg-white border border-slate-200/90 rounded-2xl shadow-sm">
                  <span className="text-xs text-slate-500 font-bold uppercase tracking-wider block">Total Inquiries</span>
                  <span className="text-3xl sm:text-4xl font-extrabold text-slate-900 mt-2 block">{totalSubmissions}</span>
                </div>
                <div className="p-6 bg-white border border-slate-200/90 rounded-2xl shadow-sm">
                  <span className="text-xs text-slate-500 font-bold uppercase tracking-wider block">Latest Token ID</span>
                  <span className="text-3xl sm:text-4xl font-extrabold text-rose-700 mt-2 block">{latestTokenId}</span>
                </div>
                <div className="p-6 bg-white border border-slate-200/90 rounded-2xl shadow-sm">
                  <span className="text-xs text-slate-500 font-bold uppercase tracking-wider block">Database Storage</span>
                  <span className="text-2xl font-extrabold text-slate-900 mt-2 block">
                    {dbStats ? `${dbStats.storageSizeMB.toFixed(1)} MB / ${dbStats.totalLimitMB} MB` : 'Loading...'}
                  </span>
                  {dbStats && (
                    <div className="mt-3 space-y-1.5">
                      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div 
                          className={`h-1.5 rounded-full transition-all duration-500 ${
                            (dbStats.storageSizeMB / dbStats.totalLimitMB) > 0.8 ? 'bg-red-500' : 
                            (dbStats.storageSizeMB / dbStats.totalLimitMB) > 0.5 ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.min(100, (dbStats.storageSizeMB / dbStats.totalLimitMB) * 100)}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[9px] text-slate-500 font-bold">
                        <span>{((dbStats.storageSizeMB / dbStats.totalLimitMB) * 100).toFixed(2)}% Used</span>
                        <span>{(dbStats.totalLimitMB - dbStats.storageSizeMB).toFixed(1)} MB Free</span>
                      </div>
                    </div>
                  )}
                </div>
                <div className="p-6 bg-white border border-slate-200/90 rounded-2xl shadow-sm">
                  <span className="text-xs text-slate-500 font-bold uppercase tracking-wider block">System Status</span>
                  <span className="text-3xl sm:text-4xl font-extrabold text-emerald-600 mt-2 block">Secure</span>
                </div>
              </div>
            </>
          )}

      {activeSection === 'programs' && (
        /* Program Slots Section */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Create Program Form */}
          <div className="bg-white border border-slate-200/90 shadow-sm rounded-2xl p-6 space-y-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                Add Program Slot
              </h2>
              <p className="text-slate-500 text-xs mt-1">Schedule a program with a specific date and seat capacity.</p>
            </div>

            {programError && (
              <div className="p-3 text-xs bg-red-50 border border-red-200 text-red-700 rounded-xl font-medium">
                {programError}
              </div>
            )}
            {programSuccess && (
              <div className="p-3 text-xs bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl font-medium">
                {programSuccess}
              </div>
            )}

            <form onSubmit={handleCreateProgram} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">Program Name</label>
                <input
                  type="text"
                  required
                  value={newProgramName}
                  onChange={(e) => setNewProgramName(e.target.value)}
                  placeholder="e.g. Ek Duje Ke Liye - Sardar Patel Smruti Bhavan"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:border-rose-500 transition-colors font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">Program Date</label>
                  <input
                    type="date"
                    required={newProgramIsDateFinal}
                    value={newProgramDate}
                    onChange={(e) => setNewProgramDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:border-rose-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">Event Time</label>
                  <input
                    type="text"
                    value={newProgramTime}
                    onChange={(e) => setNewProgramTime(e.target.value)}
                    placeholder="e.g. 8:30 PM"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:border-rose-500 transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">Couple Pass Price (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={newProgramPrice}
                    onChange={(e) => setNewProgramPrice(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="e.g. 1000"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm font-bold focus:bg-white focus:outline-none focus:border-rose-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">City</label>
                  <input
                    type="text"
                    value={newProgramCity}
                    onChange={(e) => setNewProgramCity(e.target.value)}
                    placeholder="e.g. Surat"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:border-rose-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">Venue & Address</label>
                <input
                  type="text"
                  value={newProgramVenue}
                  onChange={(e) => setNewProgramVenue(e.target.value)}
                  placeholder="e.g. Sardar Patel Smruti Bhavan, Varachha, Surat"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:border-rose-500 transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">Program Status</label>
                  <select
                    value={newProgramStatus}
                    onChange={(e) => setNewProgramStatus(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm font-semibold focus:bg-white focus:outline-none focus:border-rose-500 transition-colors"
                  >
                    <option value="upcoming">Upcoming (Active)</option>
                    <option value="few_seats">Few Seats Left</option>
                    <option value="housefull">Housefull / Sold Out</option>
                    <option value="registration_closed">Registration Closed</option>
                    <option value="completed">Completed / Past</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">Registration Mode</label>
                  <select
                    value={newProgramRegistrationMode}
                    onChange={(e) => setNewProgramRegistrationMode(e.target.value as 'internal' | 'external')}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm font-semibold focus:bg-white focus:outline-none focus:border-rose-500 transition-colors"
                  >
                    <option value="internal">Internal (Website & Razorpay)</option>
                    <option value="external">External Link</option>
                  </select>
                </div>
              </div>

              {newProgramRegistrationMode === 'external' && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">External Registration URL</label>
                  <input
                    type="url"
                    value={newProgramExternalUrl}
                    onChange={(e) => setNewProgramExternalUrl(e.target.value)}
                    placeholder="https://allevents.in/..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:border-rose-500 transition-colors"
                  />
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">Google Maps Link</label>
                <input
                  type="url"
                  value={newProgramMapUrl}
                  onChange={(e) => setNewProgramMapUrl(e.target.value)}
                  placeholder="https://maps.google.com/..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:border-rose-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">Custom Event URL Slug (Optional)</label>
                <input
                  type="text"
                  value={newProgramSlug}
                  onChange={(e) => setNewProgramSlug(e.target.value)}
                  placeholder="e.g. surat-7-september-2026"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:border-rose-500 transition-colors"
                />
              </div>

              <div className="flex items-center gap-2 py-1">
                <input
                  type="checkbox"
                  id="newProgramIsDateFinal"
                  checked={newProgramIsDateFinal}
                  onChange={(e) => setNewProgramIsDateFinal(e.target.checked)}
                  className="rounded bg-slate-50 border-slate-300 text-rose-600 focus:ring-rose-500 h-4 w-4"
                />
                <label htmlFor="newProgramIsDateFinal" className="text-xs font-bold text-slate-700 cursor-pointer">
                  Date is Final? / Collect Payment (તારીખ નક્કી છે / પેમેન્ટ લેવું)
                </label>
              </div>

              {!newProgramIsDateFinal && (
                <div className="flex items-center gap-2 py-1">
                  <input
                    type="checkbox"
                    id="newProgramIsInquiryClosed"
                    checked={newProgramIsInquiryClosed}
                    onChange={(e) => setNewProgramIsInquiryClosed(e.target.checked)}
                    className="rounded bg-slate-50 border-slate-300 text-rose-600 focus:ring-rose-500 h-4 w-4"
                  />
                  <label htmlFor="newProgramIsInquiryClosed" className="text-xs font-bold text-slate-700 cursor-pointer">
                    Close Inquiry Registration? (ઇન્ક્વાયરી લેવાનું બંધ કરવું)
                  </label>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">Hall Capacity (Seats, e.g. 600 for 300 Couples)</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={newProgramCapacity}
                  onChange={(e) => setNewProgramCapacity(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="e.g. 600"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:border-rose-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">Entry Pass Template Image (Optional)</label>
                <input
                  id="programCardTemplateInput"
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = async () => {
                        const base64 = reader.result as string;
                        setNewProgramCardTemplate(base64);
                        const coords = await detectHeartCutout(base64);
                        if (coords) {
                          setNewProgramHeartX(coords.x);
                          setNewProgramHeartY(coords.y);
                          setNewProgramHeartWidth(coords.w);
                          setNewProgramHeartHeight(coords.h);
                        }
                      };
                      reader.readAsDataURL(file);
                    } else {
                      setNewProgramCardTemplate(null);
                    }
                  }}
                  className="w-full text-slate-600 text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-slate-200 file:text-slate-700 hover:file:bg-slate-300 file:cursor-pointer cursor-pointer bg-slate-50 border border-slate-300 rounded-xl px-3 py-2"
                />
                {newProgramCardTemplate && (
                  <div className="mt-2 text-[10px] text-emerald-700 flex items-center gap-1.5 font-bold">
                    <span>✓ Template loaded</span>
                    <button
                      type="button"
                      onClick={() => {
                        setNewProgramCardTemplate(null);
                        const fileInput = document.getElementById('programCardTemplateInput') as HTMLInputElement;
                        if (fileInput) fileInput.value = '';
                      }}
                      className="text-red-600 hover:text-red-700 font-bold underline"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">Photo Gallery Link (ફોટો ગેલેરી લિંક)</label>
                <input
                  type="url"
                  value={newProgramPhotoLink}
                  onChange={(e) => setNewProgramPhotoLink(e.target.value)}
                  placeholder="e.g. https://photos.google.com/..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:border-rose-500 transition-colors"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-700 hover:to-amber-700 active:scale-[0.99] text-white font-bold rounded-xl text-sm transition-all shadow-md cursor-pointer"
              >
                Add Program Slot
              </button>
            </form>
          </div>

          {/* Programs List */}
          <div className="lg:col-span-2 bg-white border border-slate-200/90 shadow-sm rounded-2xl p-6 flex flex-col">
            <div>
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <span>🎟️</span> Scheduled Slots
              </h2>
              <p className="text-slate-500 text-xs mt-1">Active program sessions, capacities, and booking status.</p>
            </div>

            <div className="mt-4 flex-grow overflow-y-auto max-h-[320px] space-y-3 pr-2">
              {programs.length === 0 ? (
                <div className="text-center py-10 text-xs text-slate-500 border border-dashed border-slate-300 rounded-xl">
                  No programs scheduled yet.
                </div>
              ) : (
                programs.map((prog) => {
                  const isSoldOut = prog.bookingsCount + 2 > prog.capacity;
                  return (
                    <div key={prog.id} className="flex justify-between items-center p-4 bg-slate-50 border border-slate-200 rounded-xl hover:border-slate-300 transition-colors">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900 text-sm">{prog.name}</span>
                          
                          {/* Status Badge */}
                          {prog.status === 'completed' ? (
                            <span className="px-2 py-0.5 text-[10px] bg-slate-200 text-slate-700 rounded-full font-bold uppercase tracking-wider">Completed</span>
                          ) : prog.status === 'archived' ? (
                            <span className="px-2 py-0.5 text-[10px] bg-slate-200 text-slate-500 rounded-full font-bold uppercase tracking-wider">Archived</span>
                          ) : prog.status === 'housefull' || isSoldOut ? (
                            <span className="px-2 py-0.5 text-[10px] bg-red-50 border border-red-200 text-red-700 rounded-full font-bold uppercase tracking-wider">Sold Out</span>
                          ) : prog.status === 'few_seats' ? (
                            <span className="px-2 py-0.5 text-[10px] bg-amber-50 border border-amber-200 text-amber-800 rounded-full font-bold uppercase tracking-wider">Few Seats</span>
                          ) : (
                            <span className="px-2 py-0.5 text-[10px] bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full font-bold uppercase tracking-wider">Active</span>
                          )}

                          {/* Price Badge */}
                          <span className="px-2 py-0.5 text-[10px] bg-rose-50 border border-rose-200 text-rose-800 rounded-full font-extrabold tracking-wider">
                            ₹ {prog.price ?? 1000}
                          </span>

                          {/* City & Venue */}
                          {prog.city && (
                            <span className="px-2 py-0.5 text-[10px] bg-blue-50 border border-blue-200 text-blue-800 rounded-full font-semibold">
                              📍 {prog.city}
                            </span>
                          )}

                          {prog.time && (
                            <span className="px-2 py-0.5 text-[10px] bg-stone-100 border border-stone-300 text-stone-700 rounded-full font-medium">
                              🕒 {prog.time}
                            </span>
                          )}

                          {prog.isDateFinal === false && prog.isInquiryClosed && (
                            <span className="px-2 py-0.5 text-[10px] bg-amber-50 border border-amber-200 text-amber-800 rounded-full font-bold uppercase tracking-wider">Inquiry Closed</span>
                          )}
                        </div>

                        {prog.venue && (
                          <div className="text-[11px] text-slate-500 font-medium truncate max-w-xl">
                            🏛️ {prog.venue}
                          </div>
                        )}

                        <div className="text-xs text-slate-600 flex items-center gap-3 flex-wrap pt-0.5">
                          <span className="font-bold text-slate-800">{prog.date}</span>
                          <span>👥 Booked: <strong className={isSoldOut ? "text-red-600" : "text-rose-700"}>{Math.floor(prog.bookingsCount / 2)}</strong> / {Math.floor(prog.capacity / 2)} couples</span>
                          {prog.inquiryCount !== undefined && prog.inquiryCount > 0 && (
                            <span className="flex items-center gap-1 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200 text-blue-700 font-semibold">
                              📝 Inquiries: <strong>{prog.inquiryCount}</strong>
                            </span>
                          )}
                          {prog.pendingCount !== undefined && prog.pendingCount > 0 && (
                            <span className="flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 text-amber-800 font-semibold">
                              ⏳ Pending: <strong>{prog.pendingCount}</strong>
                            </span>
                          )}
                          {prog.approvedCount !== undefined && prog.approvedCount > 0 && (
                            <span className="flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 text-emerald-800 font-semibold">
                              ✓ Approved: <strong>{prog.approvedCount}</strong>
                            </span>
                          )}
                          {prog.rejectedCount !== undefined && prog.rejectedCount > 0 && (
                            <span className="flex items-center gap-1 bg-red-50 px-2 py-0.5 rounded-full border border-red-200 text-red-700 font-semibold">
                              ✗ Rejected: <strong>{prog.rejectedCount}</strong>
                            </span>
                          )}
                          <span className="flex items-center gap-1 bg-pink-50 px-2 py-0.5 rounded-full border border-pink-200 text-pink-800 font-semibold">
                            💑 CPL: <strong>{prog.cplApproved || 0}</strong> Appr / <strong>{(prog.cplApproved || 0) + (prog.cplPending || 0) + (prog.cplInquiry || 0)}</strong> Total
                          </span>
                          <span className="flex items-center gap-1 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200 text-purple-800 font-semibold">
                            👤 IP: <strong>{prog.ipApproved || 0}</strong> Appr / <strong>{(prog.ipApproved || 0) + (prog.ipPending || 0) + (prog.ipInquiry || 0)}</strong> Total
                          </span>
                          {prog.cardTemplate && (
                            <span className="text-[10px] text-emerald-800 flex items-center gap-1 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 font-semibold">
                              🖼️ Custom Pass
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditProgramClick(prog)}
                          className="p-2 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg text-xs font-bold transition-all border border-amber-200 cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteProgram(prog.id)}
                          className="p-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-xs font-bold transition-all border border-red-200 cursor-pointer"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {activeSection === 'settings' && (
        <>
          {/* Payment Settings Section */}
          <div className="bg-white border border-slate-200/90 shadow-sm rounded-2xl p-6 space-y-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <span>💳</span> Payment Settings (UPI QR Code)
            </h2>
            <p className="text-slate-500 text-xs mt-1">Configure the active UPI account details and amount for ticket payments.</p>
          </div>

          {settingsError && (
            <div className="p-3 text-xs bg-red-50 border border-red-200 text-red-700 rounded-xl font-medium">
              {settingsError}
            </div>
          )}
          {settingsSuccess && (
            <div className="p-3 text-xs bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl font-medium">
              {settingsSuccess}
            </div>
          )}

          <form onSubmit={handleUpdateSettings} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">UPI ID List (Comma separated for Auto-Rotation)</label>
                <input
                  type="text"
                  required
                  value={upiIdsString}
                  onChange={(e) => {
                    setUpiIdsString(e.target.value);
                    const first = e.target.value.split(',')[0]?.trim();
                    if (first) setUpiId(first);
                  }}
                  placeholder="e.g. upi1@okaxis, upi2@okicici"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:border-rose-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">Currently Active UPI ID</label>
                <input
                  type="text"
                  required
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  placeholder="e.g. payee@upi"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:border-rose-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">Rotation Limit (Submissions per UPI)</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={upiLimit}
                  onChange={(e) => setUpiLimit(Number(e.target.value))}
                  placeholder="e.g. 50"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:border-rose-500 transition-colors"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">Payee Name</label>
                <input
                  type="text"
                  required
                  value={payeeName}
                  onChange={(e) => setPayeeName(e.target.value)}
                  placeholder="e.g. Couple Pass Org"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:border-rose-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">Ticket Price (INR)</label>
                <input
                  type="number"
                  required
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g. 100"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:border-rose-500 transition-colors"
                />
              </div>

              <div className="flex justify-between items-center bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs">
                <div>
                  <span className="text-slate-500 font-medium">Current UPI Usage:</span>
                  <div className="font-bold text-rose-700 text-sm">{upiBookingsCount} / {upiLimit} registrations</div>
                </div>
                <button
                  type="submit"
                  className="px-6 py-2 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-700 hover:to-amber-700 active:scale-[0.99] text-white font-bold rounded-xl text-sm transition-all shadow-md cursor-pointer h-[38px]"
                >
                  Save Settings
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Manual Invitee Registration Section */}
        <div className="bg-white border border-slate-200/90 shadow-sm rounded-2xl p-6 space-y-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <span>✍️</span> Manual Invitee Registration (મેન્યુઅલ એન્ટ્રી)
            </h2>
            <p className="text-slate-500 text-xs mt-1">Directly register invited couples, generating an instant approved pass with prefix IP-.</p>
          </div>

          {manualError && (
            <div className="p-3 text-xs bg-red-50 border border-red-200 text-red-700 rounded-xl font-medium">
              {manualError}
            </div>
          )}
          {manualSuccess && (
            <div className="p-3 text-xs bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl font-medium space-y-2">
              <div>{manualSuccess}</div>
              {generatedPassUrl && (
                <div className="mt-3 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <span className="font-mono text-xs text-rose-700 font-bold select-all break-all">{generatedPassUrl}</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(generatedPassUrl);
                          alert('Pass link copied to clipboard!');
                        }}
                        className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 text-[10px] font-bold rounded-lg transition-all cursor-pointer"
                      >
                        Copy Link
                      </button>
                      <a
                        href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`Hello! Your manual registration pass is ready. You can download it here: ${generatedPassUrl}`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                      >
                        Share on WhatsApp
                      </a>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleManualEntrySubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">Husband Name (પતિનું નામ)</label>
                <input
                  type="text"
                  required
                  value={manualHusbandName}
                  onChange={(e) => setManualHusbandName(e.target.value)}
                  placeholder="Enter Husband's Name"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:border-rose-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">Wife Name (પત્નીનું નામ)</label>
                <input
                  type="text"
                  required
                  value={manualWifeName}
                  onChange={(e) => setManualWifeName(e.target.value)}
                  placeholder="Enter Wife's Name"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:border-rose-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">Surname (અટક)</label>
                <input
                  type="text"
                  required
                  value={manualSurname}
                  onChange={(e) => setManualSurname(e.target.value)}
                  placeholder="Enter Surname"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:border-rose-500 transition-colors"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">Phone Number (મોબાઇલ નંબર)</label>
                <input
                  type="tel"
                  required
                  pattern="[6-9][0-9]{9}"
                  value={manualPhoneNumber}
                  onChange={(e) => setManualPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="Enter 10-digit number"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:border-rose-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">Select Program Slot</label>
                <select
                  required
                  value={manualProgramId}
                  onChange={(e) => setManualProgramId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:border-rose-500 transition-colors cursor-pointer"
                >
                  <option value="">Choose a slot</option>
                  {programs.map((prog) => {
                    const remainingSeats = prog.capacity - prog.bookingsCount;
                    const isSoldOut = remainingSeats < 2;
                    return (
                      <option key={prog.id} value={prog.id} disabled={isSoldOut}>
                        {prog.name} ({prog.date}) ({Math.floor(remainingSeats / 2)} left)
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">Couple Photo (Optional / મરજીયાત)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setManualCouplePhoto(e.target.files[0]);
                    }
                  }}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-600 text-xs focus:bg-white focus:outline-none focus:border-rose-500 file:mr-4 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-[10px] file:font-semibold file:bg-slate-200 file:text-slate-700 hover:file:bg-slate-300 cursor-pointer"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={manualLoading}
                className="px-6 py-2.5 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-700 hover:to-amber-700 active:scale-[0.99] disabled:opacity-50 text-white font-bold rounded-xl text-sm transition-all shadow-md cursor-pointer"
              >
                {manualLoading ? 'Registering...' : 'Register Invited Guest'}
              </button>
            </div>
          </form>
        </div>

        {/* WhatsApp Message Templates Section */}
        <div className="bg-white border border-slate-200/90 shadow-sm rounded-2xl p-6 space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <span>💬</span> WhatsApp Message Templates
              </h2>
              <p className="text-slate-500 text-xs mt-1">
                Manage templates for sending passes to users, and messages sent by users after registration.
              </p>
            </div>
            
            {/* Tab switcher */}
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 self-stretch sm:self-auto">
              <button
                type="button"
                onClick={() => setWhatsappTemplateTab('pass_delivery')}
                className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${whatsappTemplateTab === 'pass_delivery' ? 'bg-white text-rose-700 shadow-sm border border-slate-200' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Pass Delivery (Admin to User)
              </button>
              <button
                type="button"
                onClick={() => setWhatsappTemplateTab('payment_request')}
                className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${whatsappTemplateTab === 'payment_request' ? 'bg-white text-rose-700 shadow-sm border border-slate-200' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Payment Request (User to Admin)
              </button>
              <button
                type="button"
                onClick={() => setWhatsappTemplateTab('photo_delivery')}
                className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${whatsappTemplateTab === 'photo_delivery' ? 'bg-white text-rose-700 shadow-sm border border-slate-200' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Photo Delivery (Admin to User)
              </button>
            </div>
          </div>

          {/* Add Template Form */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
            <h3 className="text-sm font-bold text-slate-800">
              Create New {whatsappTemplateTab === 'pass_delivery' ? 'Pass Delivery' : whatsappTemplateTab === 'payment_request' ? 'Payment Request' : 'Photo Delivery'} Template
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div className="md:col-span-1">
                <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">Template Name</label>
                <input
                  type="text"
                  id="newTemplateName"
                  placeholder={whatsappTemplateTab === 'pass_delivery' ? "e.g. Gujarati Pass Msg" : whatsappTemplateTab === 'payment_request' ? "e.g. Payment Done Request" : "e.g. Gujarati Photo Msg"}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-rose-500 transition-colors"
                />
              </div>
              <div className="md:col-span-2 flex gap-4">
                <div className="flex-grow">
                  <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">Message Text</label>
                  <input
                    type="text"
                    id="newTemplateText"
                    placeholder={whatsappTemplateTab === 'pass_delivery' ? "Hello! Download your pass here: {passUrl}" : whatsappTemplateTab === 'payment_request' ? "Hello! Verified. Inquiry ID: {inquiryId}" : "નમસ્તે {husbandName} & {wifeName}, તમારા ફોટાઓ જોવા માટે લિંક: {photoLink}"}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-rose-500 transition-colors"
                  />
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    const nameEl = document.getElementById('newTemplateName') as HTMLInputElement;
                    const textEl = document.getElementById('newTemplateText') as HTMLInputElement;
                    if (!nameEl.value || !textEl.value) {
                      alert('Please fill template name and message text.');
                      return;
                    }
                    const activePassword = password || sessionStorage.getItem('adminPassword') || '';
                    try {
                      const res = await fetch(`${API_BASE_URL}/api/whatsapp-templates`, {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          'Authorization': activePassword
                        },
                        body: JSON.stringify({ name: nameEl.value, text: textEl.value, type: whatsappTemplateTab })
                      });
                      if (res.ok) {
                        nameEl.value = '';
                        textEl.value = '';
                        fetchWhatsappTemplates();
                        fetchActiveWhatsappTemplate();
                      } else {
                        const errData = await res.json();
                        alert(errData.error || 'Failed to create template.');
                      }
                    } catch (e) {
                      alert('Network error.');
                    }
                  }}
                  className="px-5 py-2 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-700 hover:to-amber-700 active:scale-[0.99] text-white font-bold rounded-xl text-xs transition-all shadow-md h-[38px] self-end cursor-pointer"
                >
                  Create
                </button>
              </div>
            </div>
            <div className="text-[10px] text-slate-500 flex flex-wrap gap-x-4">
              <span className="font-semibold text-slate-600">Supported Variables:</span>
              {whatsappTemplateTab === 'pass_delivery' ? (
                <>
                  <span><code>{`{husbandName}`}</code></span>
                  <span><code>{`{wifeName}`}</code></span>
                  <span><code>{`{surname}`}</code></span>
                  <span><code>{`{inquiryId}`}</code></span>
                  <span><code>{`{passUrl}`}</code></span>
                </>
              ) : whatsappTemplateTab === 'payment_request' ? (
                <>
                  <span><code>{`{programName}`}</code></span>
                  <span><code>{`{inquiryId}`}</code></span>
                  <span><code>{`{phoneNumber}`}</code></span>
                </>
              ) : (
                <>
                  <span><code>{`{husbandName}`}</code></span>
                  <span><code>{`{wifeName}`}</code></span>
                  <span><code>{`{surname}`}</code></span>
                  <span><code>{`{programName}`}</code></span>
                  <span><code>{`{photoLink}`}</code></span>
                </>
              )}
            </div>
          </div>

          {/* Templates List */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-800">
              Available {whatsappTemplateTab === 'pass_delivery' ? 'Pass Delivery' : whatsappTemplateTab === 'payment_request' ? 'Payment Request' : 'Photo Delivery'} Templates
            </h3>
            {whatsappTemplates.filter(t => t.type === whatsappTemplateTab).length === 0 ? (
              <p className="text-xs text-slate-500 italic">No templates of this type available. The default message will be used.</p>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {whatsappTemplates.filter(t => t.type === whatsappTemplateTab).map((t) => (
                  <div key={t._id} className={`flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 bg-slate-50 border rounded-xl gap-4 ${t.isActive ? 'border-rose-300 bg-rose-50/40' : 'border-slate-200'}`}>
                    <div className="space-y-1 flex-grow">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">{t.name}</span>
                        {t.isActive && (
                          <span className="px-2 py-0.5 text-[9px] bg-rose-100 border border-rose-200 text-rose-800 rounded-full font-bold uppercase">Active</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 font-mono break-all bg-white p-2 rounded-lg border border-slate-200 mt-1.5">{t.text}</p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0 mt-2 sm:mt-0">
                      {!t.isActive && (
                        <button
                          type="button"
                          onClick={async () => {
                            const activePassword = password || sessionStorage.getItem('adminPassword') || '';
                            try {
                              const res = await fetch(`${API_BASE_URL}/api/whatsapp-templates/${t._id}/use`, {
                                method: 'POST',
                                headers: { 'Authorization': activePassword }
                              });
                              if (res.ok) {
                                fetchWhatsappTemplates();
                                fetchActiveWhatsappTemplate();
                              }
                            } catch (e) {
                              alert('Network error.');
                            }
                          }}
                          className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-bold transition-all border border-slate-300 cursor-pointer"
                        >
                          Use
                        </button>
                      )}
                      {!t.isActive && (
                        <button
                          type="button"
                          onClick={async () => {
                            if (!confirm('Are you sure you want to delete this template?')) return;
                            const activePassword = password || sessionStorage.getItem('adminPassword') || '';
                            try {
                              const res = await fetch(`${API_BASE_URL}/api/whatsapp-templates/${t._id}`, {
                                method: 'DELETE',
                                headers: { 'Authorization': activePassword }
                              });
                              if (res.ok) {
                                fetchWhatsappTemplates();
                              } else {
                                const errData = await res.json();
                                alert(errData.error || 'Failed to delete template.');
                              }
                            } catch (e) {
                              alert('Network error.');
                            }
                          }}
                          className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-xs font-bold transition-all border border-red-200 cursor-pointer"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Frame Download Option Section */}
        <div className="bg-white border border-slate-200/90 shadow-sm rounded-2xl p-6 space-y-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <span>🖼️</span> Frame Download Option
            </h2>
            <p className="text-slate-500 text-xs mt-1">Select a program, filter/search multiple CPL IDs, select/deselect them, and download/adjust frames for only the selected couples.</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div className="w-full sm:w-72">
              <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">Select Program Session</label>
              <select
                value={selectedProgramIdForFrames}
                onChange={(e) => setSelectedProgramIdForFrames(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:border-rose-500 transition-colors cursor-pointer"
              >
                <option value="">-- Choose Program Slot --</option>
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.date})</option>
                ))}
              </select>
            </div>
          </div>

          {selectedProgramIdForFrames && (
            <div className="space-y-4 border-t border-slate-200 pt-4">
              {/* Search CPL IDs Input */}
              <div className="w-full">
                <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Search Multiple CPL IDs (Comma or space separated)
                </label>
                <input
                  type="text"
                  value={cplSearchQuery}
                  onChange={(e) => setCplSearchQuery(e.target.value)}
                  placeholder="e.g. EK01-01, EK01-02, EK01-05"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:bg-white focus:outline-none focus:border-rose-500 transition-colors"
                />
              </div>

              {/* Selection Controls */}
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      const matchedIds = approvedSubmissionsForFrames
                        .filter(sub => {
                          if (!cplSearchQuery.trim()) return true;
                          const searchedCpls = cplSearchQuery
                            .split(/[\s,]+/)
                            .map(s => s.trim().toUpperCase())
                            .filter(Boolean);
                          const isBulk = searchedCpls.length > 1;
                          return searchedCpls.some(cpl => matchCplToken(sub.inquiryId, cpl, isBulk));
                        })
                        .map(sub => sub.inquiryId);
                      
                      setSelectedFrameInquiryIds(prev => {
                        const newSelection = new Set([...prev, ...matchedIds]);
                        return Array.from(newSelection);
                      });
                    }}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 rounded-lg font-bold transition-all cursor-pointer"
                  >
                    Select All Filtered
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const matchedIds = approvedSubmissionsForFrames
                        .filter(sub => {
                          if (!cplSearchQuery.trim()) return true;
                          const searchedCpls = cplSearchQuery
                            .split(/[\s,]+/)
                            .map(s => s.trim().toUpperCase())
                            .filter(Boolean);
                          const isBulk = searchedCpls.length > 1;
                          return searchedCpls.some(cpl => matchCplToken(sub.inquiryId, cpl, isBulk));
                        })
                        .map(sub => sub.inquiryId);
                      
                      setSelectedFrameInquiryIds(prev => prev.filter(id => !matchedIds.includes(id)));
                    }}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 rounded-lg font-bold transition-all cursor-pointer"
                  >
                    Deselect All Filtered
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFrameInquiryIds(approvedSubmissionsForFrames.map(sub => sub.inquiryId));
                    }}
                    className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 rounded-lg font-bold transition-all cursor-pointer"
                  >
                    Select All (બધા સિલેક્ટ કરો)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFrameInquiryIds([]);
                    }}
                    className="px-3 py-1.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 rounded-lg font-bold transition-all cursor-pointer"
                  >
                    Clear Selection (બધા અન-સિલેક્ટ કરો)
                  </button>
                </div>
                <div className="text-slate-600 font-bold">
                  Selected: <span className="text-rose-700">{selectedFrameInquiryIds.length}</span> / {approvedSubmissionsForFrames.length}
                </div>
              </div>

              {/* List of Couples */}
              <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl bg-slate-50 p-3 space-y-2">
                {approvedSubmissionsForFrames
                  .filter(sub => {
                    if (!cplSearchQuery.trim()) return true;
                    const searchedCpls = cplSearchQuery
                      .split(/[\s,]+/)
                      .map(s => s.trim().toUpperCase())
                      .filter(Boolean);
                    const isBulk = searchedCpls.length > 1;
                    return searchedCpls.some(cpl => matchCplToken(sub.inquiryId, cpl, isBulk));
                  })
                  .map(sub => {
                    const isChecked = selectedFrameInquiryIds.includes(sub.inquiryId);
                    return (
                      <label key={sub.inquiryId} className="flex items-center gap-3 p-2 hover:bg-white rounded-lg cursor-pointer transition-colors border border-transparent hover:border-slate-200">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            if (isChecked) {
                              setSelectedFrameInquiryIds(prev => prev.filter(id => id !== sub.inquiryId));
                            } else {
                              setSelectedFrameInquiryIds(prev => [...prev, sub.inquiryId]);
                            }
                          }}
                          className="rounded border-slate-300 text-rose-600 focus:ring-rose-500 w-4 h-4 cursor-pointer"
                        />
                        <span className="font-mono text-xs font-bold text-rose-700 w-20">{sub.inquiryId}</span>
                        <span className="text-xs text-slate-800 font-medium">{sub.husbandName} &amp; {sub.wifeName} {sub.surname}</span>
                      </label>
                    );
                  })}
                {approvedSubmissionsForFrames.filter(sub => {
                  if (!cplSearchQuery.trim()) return true;
                  const searchedCpls = cplSearchQuery
                    .split(/[\s,]+/)
                    .map(s => s.trim().toUpperCase())
                    .filter(Boolean);
                  const isBulk = searchedCpls.length > 1;
                  return searchedCpls.some(cpl => matchCplToken(sub.inquiryId, cpl, isBulk));
                }).length === 0 && (
                  <p className="text-center text-xs text-slate-500 py-4 font-medium">No matching couples found.</p>
                )}
              </div>

              {/* Action and Count */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <div>
                  <p className="text-sm font-bold text-slate-900">
                    Total Selected Couples for Download: <span className="text-rose-700 font-extrabold">{selectedFrameInquiryIds.length}</span>
                  </p>
                  <p className="text-xs text-slate-500 mt-1">Review alignments line by line and download the framed photos in a single ZIP file.</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => {
                      const prog = programs.find(p => p.id === selectedProgramIdForFrames);
                      if (prog) setReviewingProgramForFrames(prog);
                    }}
                    disabled={zipping || selectedFrameInquiryIds.length === 0}
                    className="px-5 py-2.5 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-700 hover:to-amber-700 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition-all shadow-md text-center cursor-pointer"
                  >
                    {zipping ? `Processing (${zipProgress})` : 'Review & Download ZIP'}
                  </button>
                  <button
                    onClick={() => handleDownloadRawZip()}
                    disabled={zipping || selectedFrameInquiryIds.length === 0}
                    className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition-all shadow-md text-center cursor-pointer"
                  >
                    {zipping ? `Processing (${zipProgress})` : 'Download Raw Photos ZIP'}
                  </button>
                  <button
                    onClick={() => handleDownloadPassesZip()}
                    disabled={zipping || selectedFrameInquiryIds.length === 0}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition-all shadow-md text-center cursor-pointer"
                  >
                    {zipping ? `Processing (${zipProgress})` : 'Download Entry Passes ZIP'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </>
      )}

      {activeSection === 'registrations' && (
        <>
          {/* View Mode Tabs */}
          <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 gap-2 mb-6">
            <button
              type="button"
            onClick={() => {
              setViewMode('all');
              setStatusFilter('');
              fetchSubmissions({ page: 1, status: '' });
            }}
            className={`flex-1 py-3 text-center rounded-xl text-sm font-bold transition-all cursor-pointer ${viewMode === 'all' ? 'bg-white text-rose-700 shadow-sm border border-slate-200' : 'text-slate-600 hover:text-slate-900'}`}
          >
            📋 All Registrations (બધા રજીસ્ટ્રેશન)
          </button>
          <button
            type="button"
            onClick={() => {
              setViewMode('inquiries');
              setStatusFilter('inquiry');
              fetchSubmissions({ page: 1, status: 'inquiry' });
            }}
            className={`flex-1 py-3 text-center rounded-xl text-sm font-bold transition-all cursor-pointer ${viewMode === 'inquiries' ? 'bg-white text-rose-700 shadow-sm border border-slate-200' : 'text-slate-600 hover:text-slate-900'}`}
          >
            📝 Inquiries Only (માત્ર ઇન્ક્વાયરી)
          </button>
          <button
            type="button"
            onClick={() => {
              setViewMode('duplicates');
              fetchDuplicates();
            }}
            className={`flex-1 py-3 text-center rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${viewMode === 'duplicates' ? 'bg-white text-rose-700 shadow-sm border border-slate-200' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Duplicate Inquiries (ડુપ્લિકેટ)
          </button>
          <button
            type="button"
            onClick={() => {
              setViewMode('trash');
              fetchTrashSubmissions({ page: 1 });
            }}
            className={`flex-1 py-3 text-center rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${viewMode === 'trash' ? 'bg-white text-rose-700 shadow-sm border border-slate-200' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Trash (કચરાપેટી)
          </button>
        </div>

        {viewMode === 'all' || viewMode === 'inquiries' || viewMode === 'trash' ? (
          <>
            {/* Filters and Search Bar Container */}
            {viewMode !== 'trash' && (
              <div className="bg-white border border-slate-200/90 shadow-sm rounded-2xl p-4 md:p-5 space-y-4">
                {/* Search Bar */}
                <div className="relative flex items-center bg-slate-50 border border-slate-300 focus-within:bg-white focus-within:border-rose-500 focus-within:ring-2 focus-within:ring-rose-500/20 rounded-xl px-4 py-3 transition-all">
                  <SearchIcon className="w-4 h-4 text-slate-500 flex-shrink-0 mr-3" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search registrations by token (e.g. EK06-01), name, surname, or phone..."
                    className="w-full bg-transparent border-none text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-0 text-xs sm:text-sm font-medium pr-8"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors text-xs font-bold cursor-pointer"
                      title="Clear search"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Filter Controls Responsive Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* Status Filter */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex flex-col gap-1">
                    <label className="text-[10px] text-slate-600 font-bold uppercase tracking-wider">Status</label>
                    <select
                      value={statusFilter}
                      onChange={(e) => {
                        const val = e.target.value;
                        setStatusFilter(val);
                        fetchSubmissions({ page: 1, status: val });
                      }}
                      className="w-full bg-white border border-slate-300 text-slate-800 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-rose-500 font-medium cursor-pointer"
                    >
                      <option value="">All Statuses</option>
                      <option value="pending">Pending (બાકી)</option>
                      <option value="approved">Approved (મંજૂર)</option>
                      <option value="rejected">Rejected (રદ)</option>
                      <option value="refunded">Refunded (રિફંડ કરેલ)</option>
                      <option value="inquiry">Inquiries (ઇન્ક્વાયરી)</option>
                    </select>
                  </div>

                  {/* Program Filter */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex flex-col gap-1">
                    <label className="text-[10px] text-slate-600 font-bold uppercase tracking-wider">Program</label>
                    <select
                      value={programFilter}
                      onChange={(e) => {
                        const val = e.target.value;
                        setProgramFilter(val);
                        fetchSubmissions({ page: 1, programId: val });
                      }}
                      className="w-full bg-white border border-slate-300 text-slate-800 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-rose-500 font-medium cursor-pointer"
                    >
                      <option value="">All Programs</option>
                      {programs.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.date})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Attendance Filter */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex flex-col gap-1">
                    <label className="text-[10px] text-slate-600 font-bold uppercase tracking-wider">Attendance</label>
                    <select
                      value={attendanceFilter}
                      onChange={(e) => {
                        const val = e.target.value as any;
                        setAttendanceFilter(val);
                        fetchSubmissions({ page: 1, attendance: val });
                      }}
                      className="w-full bg-white border border-slate-300 text-slate-800 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-rose-500 font-medium cursor-pointer"
                    >
                      <option value="all">All</option>
                      <option value="unmarked">Unmarked (હાજરી બાકી)</option>
                      <option value="present">Present (હાજર)</option>
                      <option value="absent">Absent (ગેરહાજર)</option>
                    </select>
                  </div>

                  {/* Sort Order Filter */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex flex-col gap-1">
                    <label className="text-[10px] text-slate-600 font-bold uppercase tracking-wider">Sort Order</label>
                    <select
                      value={`${sortBy}-${sortOrder}`}
                      onChange={(e) => {
                        const [field, order] = e.target.value.split('-');
                        setSortBy(field);
                        setSortOrder(order);
                        fetchSubmissions({ page: 1, sortBy: field, sortOrder: order });
                      }}
                      className="w-full bg-white border border-slate-300 text-slate-800 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-rose-500 font-medium cursor-pointer"
                    >
                      <option value="createdAt-desc">Newest First</option>
                      <option value="createdAt-asc">Oldest First</option>
                      <option value="inquiryId-asc">Token ID (Ascending)</option>
                      <option value="inquiryId-desc">Token ID (Descending)</option>
                    </select>
                  </div>
                </div>

                {/* Quick Select Top N Toolbar */}
                <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-600 font-semibold">Select Top:</span>
                    <input
                      type="number"
                      min="1"
                      value={selectTopCount}
                      onChange={(e) => setSelectTopCount(e.target.value ? parseInt(e.target.value, 10) : 200)}
                      className="w-16 bg-white border border-slate-300 text-slate-900 text-xs rounded-lg px-2 py-1.5 text-center focus:outline-none focus:border-rose-500 font-bold"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        if (selectTopCount && selectTopCount > 0) {
                          if (selectTopCount > pageSize) {
                            setPageSize(selectTopCount);
                            const fetched = await fetchSubmissions({ page: 1, limit: selectTopCount });
                            if (fetched) {
                              const ids = fetched.slice(0, selectTopCount).map((s: any) => s.inquiryId);
                              setSelectedAttendanceIds(ids);
                            }
                          } else {
                            const ids = filteredSubmissions.slice(0, selectTopCount).map(s => s.inquiryId);
                            setSelectedAttendanceIds(ids);
                          }
                        }
                      }}
                      className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-800 font-bold rounded-lg text-xs transition-colors cursor-pointer"
                    >
                      Select Top {selectTopCount}
                    </button>
                  </div>

                  {searchQuery && (
                    <div className="text-rose-700 font-bold text-xs">
                      Filtered by: &ldquo;{searchQuery}&rdquo; ({totalSubmissions} found)
                    </div>
                  )}
                </div>
              </div>
            )}

        {/* Table / Grid */}
        {error && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-20 text-slate-500 font-medium">Loading registrations...</div>
        ) : filteredSubmissions.length === 0 ? (
          <div className="text-center py-20 text-slate-500 border border-dashed border-slate-300 rounded-2xl bg-white font-medium">
            No registrations found.
          </div>
        ) : (
          <>
            {selectedAttendanceIds.length > 0 && (
              <div className="flex flex-wrap items-center justify-between p-4 bg-white border border-slate-200 shadow-sm rounded-2xl mb-4 gap-4">
                <div className="text-xs text-slate-800 font-bold">
                  {selectedAttendanceIds.length} કપલ સિલેક્ટ થયેલ છે.
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => handleBulkUpdateAttendance('present')}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-all shadow-xs cursor-pointer"
                  >
                    Mark Present (હાજર કરો)
                  </button>
                  <button
                    onClick={() => handleBulkUpdateAttendance('absent')}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs transition-all shadow-xs cursor-pointer"
                  >
                    Mark Absent (ગેરહાજર કરો)
                  </button>
                  <button
                    onClick={() => handleBulkUpdateAttendance('unmarked')}
                    className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl text-xs transition-all cursor-pointer"
                  >
                    Reset (અનમાર્ક કરો)
                  </button>

                  <div className="h-6 w-px bg-slate-300 mx-1 hidden sm:block"></div>
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val) {
                        handleBulkMoveSubmissions(val);
                        e.target.value = "";
                      }
                    }}
                    className="bg-white border border-slate-300 text-slate-800 text-xs rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-rose-500 cursor-pointer font-bold"
                  >
                    <option value="" disabled>પ્રોગ્રામ બદલો (Move to...)</option>
                    {programs.map(p => {
                      const remainingSeats = p.capacity - p.bookingsCount;
                      const isSoldOut = p.bookingsCount + 2 > p.capacity;
                      return (
                        <option key={p.id} value={p.id} disabled={isSoldOut}>
                          {p.name} ({p.date}) {isSoldOut ? "[SOLD OUT]" : `(${Math.floor(remainingSeats / 2)} left)`}
                        </option>
                      );
                    })}
                  </select>

                  <button
                    onClick={() => setSelectedAttendanceIds([])}
                    className="px-2.5 py-1.5 text-xs text-slate-500 hover:text-slate-800 font-medium cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
            {viewMode !== 'trash' && programFilter && (
              <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-4 mb-4 space-y-3">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1.5">
                  <h3 className="text-xs font-bold text-rose-700 uppercase tracking-wider">
                    ⚡ Quick Attendance (ઝડપી હાજરી પૂરક)
                  </h3>
                  <span className="text-[10px] text-slate-500">
                    * આ સ્લોટના લિસ્ટમાં લખેલા કપલ ગેરહાજર (Absent) થશે અને બાકીના આપોઆપ હાજર (Present) માર્ક થશે.
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 items-end">
                  <div className="flex-grow w-full">
                    <label className="block text-[10px] text-slate-600 font-bold mb-1">
                      Absent Couple Tokens (ગેરહાજર કપલના આઈડી - અલ્પવિરામ `,` થી અલગ કરો)
                    </label>
                    <input
                      type="text"
                      value={absentInput}
                      onChange={(e) => setAbsentInput(e.target.value)}
                      placeholder="e.g. EK01-01, EK01-02"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs focus:bg-white focus:outline-none focus:border-rose-500 transition-colors"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleQuickAttendance}
                    className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-700 hover:to-amber-700 active:scale-[0.99] text-white font-bold rounded-xl text-xs transition-all shadow-md h-[36px] cursor-pointer"
                  >
                    Process Attendance (હાજરી પૂરો)
                  </button>
                </div>
              </div>
            )}
            <div className="overflow-x-auto no-scrollbar border border-slate-200 rounded-2xl bg-white shadow-sm">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-700">
                  <th className="py-4 px-4 w-12 text-center">
                    <input
                      type="checkbox"
                      checked={filteredSubmissions.length > 0 && filteredSubmissions.every(s => selectedAttendanceIds.includes(s.inquiryId))}
                      onChange={(e) => {
                        if (e.target.checked) {
                          const allIds = filteredSubmissions.map(s => s.inquiryId);
                          setSelectedAttendanceIds(allIds);
                        } else {
                          setSelectedAttendanceIds([]);
                        }
                      }}
                      className="rounded bg-white border-slate-300 text-rose-600 focus:ring-rose-500 h-4 w-4 cursor-pointer"
                    />
                  </th>
                  <th className="py-3 px-3">Token ID</th>
                  <th className="py-3 px-3">Program Slot</th>
                  <th className="py-3 px-3">Couple Names</th>
                  <th className="py-3 px-3">Surname</th>
                  <th className="py-3 px-3">Phone</th>
                  <th className="py-3 px-3">Couple Photo</th>
                  <th className="py-3 px-3">Payment Proof</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Attendance</th>
                  <th className="py-3 px-3">Submitted At</th>
                  <th className="py-3 px-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {filteredSubmissions.map((sub) => {
                  const cleanPhone = sub.phoneNumber.replace(/[^0-9]/g, '');
                  const waPhone = cleanPhone.length === 10 ? '91' + cleanPhone : cleanPhone;
                  const isApproved = sub.status === 'approved';
                  const isRejected = sub.status === 'rejected';
                  const isRefunded = sub.status === 'refunded';
                  const isInquiry = sub.status === 'inquiry';
                  const isPending = !isApproved && !isRejected && !isInquiry && !isRefunded;

                  return (
                    <tr key={sub.inquiryId} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-4 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={selectedAttendanceIds.includes(sub.inquiryId)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedAttendanceIds(prev => [...prev, sub.inquiryId]);
                            } else {
                              setSelectedAttendanceIds(prev => prev.filter(id => id !== sub.inquiryId));
                            }
                          }}
                          className="rounded bg-white border-slate-300 text-rose-600 focus:ring-rose-500 h-4 w-4 cursor-pointer"
                        />
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-mono text-xs font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 inline-block">
                          {sub.inquiryId}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-700">
                        {sub.programName ? (
                          <div>
                            <div className="font-bold text-slate-900">{sub.programName}</div>
                            <div className="text-xs text-slate-500 font-medium">{sub.programDate}</div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">N/A</span>
                        )}
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-900">
                        {sub.husbandName} &amp; {sub.wifeName}
                      </td>
                      <td className="py-3 px-3 text-slate-700 font-medium">{sub.surname}</td>
                      <td className="py-3 px-3 font-mono text-slate-700 font-medium">{sub.phoneNumber}</td>
                      <td className="py-3 px-3">
                        <div className="flex flex-col items-center gap-1.5">
                          <div
                            className="w-12 h-12 rounded-lg overflow-hidden border border-slate-200 cursor-pointer hover:border-rose-400 transition-colors bg-slate-50 shadow-2xs"
                            onClick={() => setSelectedImage(sub.couplePhoto)}
                          >
                            <img
                              src={(sub.couplePhoto.startsWith('data:') || sub.couplePhoto.startsWith('http://') || sub.couplePhoto.startsWith('https://')) ? sub.couplePhoto : `${API_BASE_URL}${sub.couplePhoto}`}
                              alt="Couple"
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <button
                            onClick={() => downloadImage(sub.couplePhoto)}
                            className="text-[10px] text-rose-700 hover:underline font-bold cursor-pointer"
                          >
                            Download
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        {sub.payment?.provider === 'razorpay' ? (
                          <div className="flex flex-col items-center gap-1">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                              💳 Razorpay
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                              sub.payment?.status === 'captured' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' :
                              sub.payment?.status === 'failed' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-amber-50 text-amber-800 border border-amber-200'
                            }`}>
                              {sub.payment?.status || 'pending'}
                            </span>
                            {sub.payment?.razorpayPaymentId && (
                              <span className="text-[9px] text-slate-500 max-w-[100px] truncate font-mono" title={sub.payment.razorpayPaymentId}>
                                ID: {sub.payment.razorpayPaymentId}
                              </span>
                            )}
                          </div>
                        ) : sub.paymentScreenshot ? (
                          <div className="flex flex-col items-center gap-1.5">
                            <div
                              className="w-12 h-12 rounded-lg overflow-hidden border border-slate-200 cursor-pointer hover:border-rose-400 transition-colors bg-slate-50 shadow-2xs"
                              onClick={() => setSelectedImage(sub.paymentScreenshot)}
                            >
                              <img
                                src={(sub.paymentScreenshot.startsWith('data:') || sub.paymentScreenshot.startsWith('http://') || sub.paymentScreenshot.startsWith('https://')) ? sub.paymentScreenshot : `${API_BASE_URL}${sub.paymentScreenshot}`}
                                alt="Payment"
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <button
                              onClick={() => downloadImage(sub.paymentScreenshot!)}
                              className="text-[10px] text-rose-700 hover:underline font-bold cursor-pointer"
                            >
                              Download
                            </button>
                            <div className="text-[9px] text-slate-500 max-w-[100px] truncate text-center" title={sub.payeeNameFromReceipt}>
                              To: <span className="font-bold text-slate-700">{sub.payeeNameFromReceipt || 'Not detected'}</span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">{sub.payment?.provider === 'manual' ? 'Manual / Offline' : 'None'}</span>
                        )}
                      </td>
                      <td className="py-3 px-3 flex flex-col gap-1 items-start">
                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase ${isApproved ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' :
                          isRejected ? 'bg-red-50 border border-red-200 text-red-700' :
                            isRefunded ? 'bg-purple-50 border border-purple-200 text-purple-800' :
                              isInquiry ? 'bg-blue-50 border border-blue-200 text-blue-800' :
                                'bg-amber-50 border border-amber-200 text-amber-800'
                          }`}>
                          {sub.status ? sub.status : 'pending'}
                        </span>
                        {isRefunded && sub.refundReason && (
                          <span className="text-[10px] text-purple-700 italic max-w-[120px] truncate block" title={sub.refundReason}>
                            Reason: {sub.refundReason}
                          </span>
                        )}
                        {isRejected && sub.rejectionReason && (
                          <span className="text-[10px] text-red-700 italic max-w-[120px] truncate block" title={sub.rejectionReason}>
                            Reason: {sub.rejectionReason}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleUpdateAttendance(sub.inquiryId, 'present')}
                            className={`px-2 py-1 rounded text-[10px] font-bold transition-all cursor-pointer ${
                              sub.attendance === 'present'
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'bg-slate-100 border border-slate-300 text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                            }`}
                            title="Mark Present (હાજર)"
                          >
                            P
                          </button>
                          <button
                            onClick={() => handleUpdateAttendance(sub.inquiryId, 'absent')}
                            className={`px-2 py-1 rounded text-[10px] font-bold transition-all cursor-pointer ${
                              sub.attendance === 'absent'
                                ? 'bg-red-600 text-white shadow-xs'
                                : 'bg-slate-100 border border-slate-300 text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                            }`}
                            title="Mark Absent (ગેરહાજર)"
                          >
                            A
                          </button>
                          <button
                            onClick={() => handleUpdateAttendance(sub.inquiryId, 'unmarked')}
                            className={`px-1.5 py-1 rounded text-[9px] font-semibold transition-all cursor-pointer ${
                              sub.attendance === 'unmarked' || !sub.attendance
                                ? 'bg-slate-200 text-slate-700 font-bold'
                                : 'bg-slate-100 text-slate-400 hover:text-slate-700'
                            }`}
                            title="Reset (અનમાર્ક)"
                          >
                            Reset
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-xs text-slate-500 font-mono">
                        {new Date(sub.createdAt).toLocaleString()}
                      </td>
                      <td className="py-3 px-3 space-y-2">
                        {viewMode === 'trash' ? (
                          <div className="flex flex-col gap-2">
                            <button
                              onClick={() => handleRestoreSubmission(sub.inquiryId)}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition-all text-center cursor-pointer"
                            >
                              Restore
                            </button>
                            <button
                              onClick={() => handlePermanentDeleteSubmission(sub.inquiryId)}
                              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg text-xs transition-all text-center cursor-pointer"
                            >
                              Delete Permanently
                            </button>
                          </div>
                        ) : (
                          <>
                            {isPending && (
                              <div className="flex flex-col gap-1.5">
                                <button
                                  onClick={() => handleApproveSubmission(sub.inquiryId)}
                                  disabled={!!submittingAction[sub.inquiryId]}
                                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-lg text-xs transition-all cursor-pointer shadow-2xs"
                                >
                                  {submittingAction[sub.inquiryId] === 'approve' ? 'Approving...' : 'Approve'}
                                </button>
                                <button
                                  onClick={() => handleRejectSubmission(sub.inquiryId)}
                                  disabled={!!submittingAction[sub.inquiryId]}
                                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold rounded-lg text-xs transition-all cursor-pointer shadow-2xs"
                                >
                                  {submittingAction[sub.inquiryId] === 'reject' ? 'Rejecting...' : 'Reject'}
                                </button>
                              </div>
                            )}
                            {isInquiry && (
                              <div className="flex flex-col gap-1.5">
                                <a
                                  href={`https://wa.me/${waPhone}?text=${encodeURIComponent(
                                    `નમસ્તે ${sub.husbandName} & ${sub.wifeName}, તમે જે પ્રોગ્રામ (${sub.programName}) માટે ઇન્ક્વાયરી રજીસ્ટર કરી હતી તેની તારીખ નક્કી થઈ ગઈ છે.\n\nનક્કી થયેલ તારીખ: ${sub.programDate}\n\nકૃપા કરીને તમારી લિંક પર જઈને પેમેન્ટ કરી તમારી સીટ કન્ફર્મ કરો: ${typeof window !== 'undefined' ? window.location.origin : ''}/pass/${sub.inquiryId}`
                                  )}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-block px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs transition-all text-center shadow-2xs"
                                >
                                  💬 Request Pay
                                </a>
                                <button
                                  onClick={() => handleRejectSubmission(sub.inquiryId)}
                                  className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 font-bold rounded-lg text-xs transition-all border border-red-200 cursor-pointer"
                                >
                                  Reject
                                </button>
                              </div>
                            )}
                            {isApproved && (() => {
                              const isSent = sentPassIds.includes(sub.inquiryId);
                              const isPhotoSent = sentPhotoIds.includes(sub.inquiryId);
                              return (
                                <div className="flex flex-col gap-1.5">
                                  <a
                                    href={`https://wa.me/${waPhone}?text=${encodeURIComponent(formatWhatsappMessage(activeWhatsappTemplate, sub))}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={() => {
                                      if (!isSent) {
                                        setSentPassIds(prev => [...prev, sub.inquiryId]);
                                      }
                                    }}
                                    className={`inline-block px-3 py-1.5 font-bold rounded-lg text-xs transition-all text-center ${isSent
                                      ? 'bg-slate-100 text-slate-500 border border-slate-300'
                                      : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs'
                                      }`}
                                  >
                                    {isSent ? '💬 Sent' : '💬 Send Pass'}
                                  </a>
                                  <a
                                    href={`https://wa.me/${waPhone}?text=${encodeURIComponent(formatWhatsappMessage(activePhotoDeliveryTemplate, sub))}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={() => {
                                      if (!isPhotoSent) {
                                        setSentPhotoIds(prev => [...prev, sub.inquiryId]);
                                      }
                                    }}
                                    className={`inline-block px-3 py-1.5 font-bold rounded-lg text-xs transition-all text-center ${isPhotoSent
                                      ? 'bg-slate-100 text-slate-500 border border-slate-300'
                                      : 'bg-amber-600 hover:bg-amber-700 text-white shadow-2xs'
                                      }`}
                                  >
                                    {isPhotoSent ? '📸 Photo Sent' : '📸 Send Photo'}
                                  </a>
                                </div>
                              );
                            })()}
                            {isRejected && (
                              <div className="flex flex-col gap-1.5">
                                <span className="text-xs text-red-600 block max-w-[120px] break-words font-bold">
                                  Rejected
                                </span>
                                {sub.rejectionReason && (
                                  <span className="text-[10px] text-red-700 block max-w-[120px] break-words bg-red-50 border border-red-200 p-1.5 rounded-md italic">
                                    {sub.rejectionReason}
                                  </span>
                                )}
                                <button
                                  onClick={() => handleApproveSubmission(sub.inquiryId)}
                                  disabled={!!submittingAction[sub.inquiryId]}
                                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-lg text-xs transition-all text-center cursor-pointer"
                                >
                                  {submittingAction[sub.inquiryId] === 'approve' ? 'Approving...' : 'Approve'}
                                </button>
                              </div>
                            )}
                            <div className="pt-2 border-t border-slate-200 flex flex-col gap-1.5">
                              <button
                                onClick={() => startEditing(sub)}
                                className="w-full px-3 py-1 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 font-bold rounded-lg text-[10px] transition-all cursor-pointer"
                              >
                                ✏️ Edit
                              </button>
                              <button
                                onClick={() => handleDeleteSubmission(sub.inquiryId)}
                                className="w-full px-3 py-1 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 font-bold rounded-lg text-[10px] transition-all cursor-pointer"
                              >
                                🗑️ Delete
                              </button>
                            </div>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalSubmissions > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 p-4 bg-white border border-slate-200/90 shadow-sm rounded-2xl">
              <span className="text-xs text-slate-600 font-medium">
                Showing <span className="text-rose-700 font-bold">{totalSubmissions === 0 ? 0 : (currentPage - 1) * pageSize + 1}</span> to{' '}
                <span className="text-rose-700 font-bold">{Math.min(currentPage * pageSize, totalSubmissions)}</span> of{' '}
                <span className="text-rose-700 font-bold">{totalSubmissions}</span> registrations
              </span>
              {totalPages > 1 && (
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <button
                      disabled={currentPage <= 1 || loading}
                      onClick={() => {
                        if (viewMode === 'trash') {
                          fetchTrashSubmissions({ page: currentPage - 1 });
                        } else {
                          fetchSubmissions({ page: currentPage - 1 });
                        }
                      }}
                      className="px-4 py-2 border border-slate-300 hover:bg-slate-50 disabled:opacity-40 text-slate-700 font-bold rounded-xl text-xs transition-all active:scale-[0.98] cursor-pointer"
                    >
                      ◀ Previous
                    </button>
                    <span className="text-xs text-slate-800 font-bold px-3 bg-slate-100 border border-slate-200 rounded-lg py-1.5 min-w-[80px] text-center">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      disabled={currentPage >= totalPages || loading}
                      onClick={() => {
                        if (viewMode === 'trash') {
                          fetchTrashSubmissions({ page: currentPage + 1 });
                        } else {
                          fetchSubmissions({ page: currentPage + 1 });
                        }
                      }}
                      className="px-4 py-2 border border-slate-300 hover:bg-slate-50 disabled:opacity-40 text-slate-700 font-bold rounded-xl text-xs transition-all active:scale-[0.98] cursor-pointer"
                    >
                      Next ▶
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-500 font-medium">Go to:</span>
                    <input
                      type="number"
                      min="1"
                      max={totalPages}
                      value={goToPageInput}
                      onChange={(e) => setGoToPageInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const page = parseInt(goToPageInput, 10);
                          if (page >= 1 && page <= totalPages) {
                            if (viewMode === 'trash') {
                              fetchTrashSubmissions({ page });
                            } else {
                              fetchSubmissions({ page });
                            }
                          }
                        }
                      }}
                      className="w-14 px-2 py-1 bg-slate-50 border border-slate-300 text-slate-900 text-xs rounded-lg focus:bg-white focus:outline-none focus:border-rose-500 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none font-bold"
                    />
                    <button
                      onClick={() => {
                        const page = parseInt(goToPageInput, 10);
                        if (page >= 1 && page <= totalPages) {
                          if (viewMode === 'trash') {
                            fetchTrashSubmissions({ page });
                          } else {
                            fetchSubmissions({ page });
                          }
                        }
                      }}
                      className="px-2.5 py-1 bg-slate-100 border border-slate-300 hover:bg-slate-200 text-slate-800 font-bold rounded-lg text-xs transition-all active:scale-[0.98] cursor-pointer"
                    >
                      Go
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          </>
        )}
      </>
    ) : (
      /* Render duplicates view */
          <div className="space-y-6">
            {loadingDuplicates ? (
              <div className="text-center py-20 text-slate-500 font-medium">Loading duplicate inquiries...</div>
            ) : duplicateGroups.length === 0 ? (
              <div className="text-center py-20 text-slate-500 border border-dashed border-slate-300 rounded-2xl bg-white font-medium">
                No duplicate inquiries found. (કોઈ ડુપ્લિકેટ ઇન્ક્વાયરી મળી નથી)
              </div>
            ) : (
              <>
                {/* Global Bulk Action Bar */}
                <div className="flex flex-wrap items-center justify-between gap-4 bg-white border border-slate-200/90 shadow-sm rounded-2xl p-4">
                  <div className="text-xs md:text-sm font-bold text-slate-800 flex items-center gap-2">
                    <span>✅</span>
                    <span>{selectedInquiryIds.length} submissions selected.</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {selectedInquiryIds.length > 0 && (
                      <button
                        onClick={handleBulkDeleteSubmissions}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs transition-all active:scale-[0.98] shadow-md cursor-pointer"
                      >
                        🗑️ Delete Selected ({selectedInquiryIds.length})
                      </button>
                    )}
                    <button
                      onClick={() => {
                        const allIds = duplicateGroups.flatMap(g => g.submissions.map(s => s.inquiryId));
                        const isAllSelected = selectedInquiryIds.length === allIds.length;
                        setSelectedInquiryIds(isAllSelected ? [] : allIds);
                      }}
                      className="px-3 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-xs transition-all active:scale-[0.98] cursor-pointer"
                    >
                      {selectedInquiryIds.length === duplicateGroups.flatMap(g => g.submissions.map(s => s.inquiryId)).length ? 'Deselect All' : 'Select All Duplicates'}
                    </button>
                  </div>
                </div>

                {duplicateGroups.map((group) => (
                  <div key={group.id} className="bg-white border border-slate-200/90 shadow-sm rounded-2xl p-6 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
                      <div className="flex items-center gap-2.5">
                        <span className="text-xl">⚠️</span>
                        <div>
                          <h3 className="font-bold text-slate-900 text-base">{group.label}</h3>
                          <p className="text-xs text-slate-500 mt-0.5">Found {group.submissions.length} conflicting submissions.</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          onClick={() => {
                            const groupIds = group.submissions.map(s => s.inquiryId);
                            const allSelected = groupIds.every(id => selectedInquiryIds.includes(id));
                            setSelectedInquiryIds(prev => {
                              if (allSelected) {
                                return prev.filter(id => !groupIds.includes(id));
                              } else {
                                const uniqueNew = groupIds.filter(id => !prev.includes(id));
                                return [...prev, ...uniqueNew];
                              }
                            });
                          }}
                          className="px-2.5 py-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-xs transition-all active:scale-[0.98] cursor-pointer"
                        >
                          {group.submissions.map(s => s.inquiryId).every(id => selectedInquiryIds.includes(id)) ? 'Deselect Group' : 'Select Group'}
                        </button>
                        <span className="px-3 py-1 bg-amber-50 border border-amber-200 text-amber-800 rounded-full text-xs font-bold uppercase tracking-wider">
                          {group.type === 'both' ? 'Phone & Name Match' : group.type === 'phone' ? 'Phone Match' : 'Name Match'}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {group.submissions.map((sub) => {
                        const isApproved = sub.status === 'approved';
                        const isRejected = sub.status === 'rejected';
                        const isPending = !isApproved && !isRejected;
                        const isSelected = selectedInquiryIds.includes(sub.inquiryId);
                        return (
                          <div key={sub.inquiryId} className={`border rounded-xl p-5 flex flex-col justify-between hover:border-rose-300 transition-all space-y-4 relative ${isSelected ? 'border-rose-400 bg-rose-50/40' : 'border-slate-200 bg-slate-50/60'}`}>
                            {/* Selection Checkbox */}
                            <div className="absolute top-4 right-4 z-10 flex items-center">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  setSelectedInquiryIds(prev => 
                                    checked 
                                      ? [...prev, sub.inquiryId]
                                      : prev.filter(id => id !== sub.inquiryId)
                                  );
                                }}
                                className="w-4.5 h-4.5 text-rose-600 bg-white border-slate-300 rounded focus:ring-rose-500 cursor-pointer"
                              />
                            </div>

                          <div className="space-y-3">
                            <div className="flex justify-between items-start gap-2 pr-8">
                              <div>
                                <span className="font-mono text-[10px] text-slate-500 font-bold">Token ID</span>
                                <div className="font-mono text-sm text-rose-700 font-bold">{sub.inquiryId}</div>
                              </div>
                              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${isApproved ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : isRejected ? 'bg-red-50 border-red-200 text-red-700' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
                                {sub.status || 'pending'}
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-3 text-xs border-t border-b border-slate-200 py-2.5">
                              <div>
                                <span className="text-slate-500 block uppercase text-[9px] tracking-wider font-bold">Couple Names</span>
                                <span className="text-slate-900 font-bold">{sub.husbandName} &amp; {sub.wifeName}</span>
                              </div>
                              <div>
                                <span className="text-slate-500 block uppercase text-[9px] tracking-wider font-bold">Surname</span>
                                <span className="text-slate-900 font-bold">{sub.surname}</span>
                              </div>
                              <div>
                                <span className="text-slate-500 block uppercase text-[9px] tracking-wider font-bold">Phone</span>
                                <span className="text-slate-900 font-mono font-bold">{sub.phoneNumber}</span>
                              </div>
                              <div>
                                <span className="text-slate-500 block uppercase text-[9px] tracking-wider font-bold">Program Slot</span>
                                <span className="text-slate-900 font-bold truncate block" title={sub.programName}>{sub.programName || 'N/A'}</span>
                                <span className="text-[10px] text-slate-500 font-medium block">{sub.programDate}</span>
                              </div>
                            </div>

                            <div className="flex gap-4">
                              <div className="flex-1 flex flex-col items-center gap-1.5">
                                <span className="text-[10px] text-slate-600 uppercase tracking-wider font-bold">Couple Photo</span>
                                <div 
                                  className="w-full h-24 rounded-lg overflow-hidden border border-slate-200 cursor-pointer hover:border-rose-400 transition-all bg-white flex items-center justify-center shadow-2xs"
                                  onClick={() => setSelectedImage(sub.couplePhoto)}
                                >
                                  {sub.couplePhoto ? (
                                    <img 
                                      src={(sub.couplePhoto.startsWith('data:') || sub.couplePhoto.startsWith('http://') || sub.couplePhoto.startsWith('https://')) ? sub.couplePhoto : `${API_BASE_URL}${sub.couplePhoto}`}
                                      alt="Couple" 
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <span className="text-slate-400 text-xs">No Photo</span>
                                  )}
                                </div>
                              </div>
                              <div className="flex-1 flex flex-col items-center gap-1.5">
                                <span className="text-[10px] text-slate-600 uppercase tracking-wider font-bold">Payment Proof</span>
                                <div 
                                  className="w-full h-24 rounded-lg overflow-hidden border border-slate-200 cursor-pointer hover:border-rose-400 transition-all bg-white flex items-center justify-center relative shadow-2xs"
                                  onClick={() => sub.paymentScreenshot && setSelectedImage(sub.paymentScreenshot)}
                                >
                                  {sub.paymentScreenshot ? (
                                    <img 
                                      src={(sub.paymentScreenshot.startsWith('data:') || sub.paymentScreenshot.startsWith('http://') || sub.paymentScreenshot.startsWith('https://')) ? sub.paymentScreenshot : `${API_BASE_URL}${sub.paymentScreenshot}`}
                                      alt="Payment Proof" 
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <span className="text-slate-400 text-xs">No Proof</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="pt-4 border-t border-slate-200 flex flex-wrap gap-2">
                            {isPending && (
                              <button
                                onClick={() => handleApproveSubmission(sub.inquiryId)}
                                disabled={!!submittingAction[sub.inquiryId]}
                                className="flex-1 min-w-[70px] px-2.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition-all active:scale-[0.98] cursor-pointer shadow-2xs"
                              >
                                {submittingAction[sub.inquiryId] === 'approve' ? 'Approving...' : 'Approve'}
                              </button>
                            )}
                            {isPending && (
                              <button
                                onClick={() => handleRejectSubmission(sub.inquiryId)}
                                disabled={!!submittingAction[sub.inquiryId]}
                                className="flex-1 min-w-[70px] px-2.5 py-2 bg-red-50 hover:bg-red-100 border border-red-200 disabled:opacity-50 text-red-700 font-bold rounded-xl text-xs transition-all active:scale-[0.98] cursor-pointer"
                              >
                                {submittingAction[sub.inquiryId] === 'reject' ? 'Rejecting...' : 'Reject'}
                              </button>
                            )}
                            <button
                              onClick={() => startEditing(sub)}
                              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 font-bold rounded-xl text-xs transition-all active:scale-[0.98] cursor-pointer"
                            >
                              ✏️ Edit
                            </button>
                            <button
                              onClick={() => handleDeleteSubmission(sub.inquiryId)}
                              className="px-3 py-2 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 font-bold rounded-xl text-xs transition-all active:scale-[0.98] cursor-pointer"
                            >
                              🗑️ Delete
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                ))}
              </>
            )}
          </div>
        )}
      </>
      )}
    </main>
  </div>
</div>
  );
}

