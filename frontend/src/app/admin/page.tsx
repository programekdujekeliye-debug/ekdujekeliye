'use client';

import React, { useEffect, useState, useRef } from 'react';
import JSZip from 'jszip';
import { API_BASE_URL } from '../../config';

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
}

interface DuplicateGroup {
  id: string;
  type: 'phone' | 'name' | 'both';
  conflictValue: string;
  label: string;
  submissions: Submission[];
}


const compressImage = (file: File, maxWidth = 1000, maxHeight = 1000, quality = 0.7): Promise<File> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
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
          resolve(file);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
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
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
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
  name: string;
  date: string;
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
  
  // If it's a full CPL ID or IP ID, match exactly
  if (token.startsWith('CPL-') || token.startsWith('IP-')) {
    return id === token;
  }
  
  // If token is just a number (e.g. "8")
  if (/^\d+$/.test(token)) {
    return id.endsWith(`-${token}`);
  }
  
  if (isBulk) return false;
  
  // Otherwise fallback to includes
  return id.includes(token);
};

export default function AdminDashboard() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
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
  const [newProgramCapacity, setNewProgramCapacity] = useState<number | ''>('');
  const [newProgramIsDateFinal, setNewProgramIsDateFinal] = useState<boolean>(true);
  const [newProgramCardTemplate, setNewProgramCardTemplate] = useState<string | null>(null);
  const [newProgramHeartX, setNewProgramHeartX] = useState<number>(144);
  const [newProgramHeartY, setNewProgramHeartY] = useState<number>(112);
  const [newProgramHeartWidth, setNewProgramHeartWidth] = useState<number>(288);
  const [newProgramHeartHeight, setNewProgramHeartHeight] = useState<number>(260);
  const [newProgramPhotoZoom, setNewProgramPhotoZoom] = useState<number>(1.0);
  const [newProgramPhotoOffsetY, setNewProgramPhotoOffsetY] = useState<number>(0);
  const [programError, setProgramError] = useState('');
  const [programSuccess, setProgramSuccess] = useState('');
  // Frame Zipping states
  const [selectedProgramIdForFrames, setSelectedProgramIdForFrames] = useState<string>('');
  const [zipping, setZipping] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [zipProgress, setZipProgress] = useState('');
  const [sentPassIds, setSentPassIds] = useState<string[]>([]);

  // Editing States
  const [editingProgram, setEditingProgram] = useState<Program | null>(null);
  const [editProgramName, setEditProgramName] = useState('');
  const [editProgramDate, setEditProgramDate] = useState('');
  const [editProgramCapacity, setEditProgramCapacity] = useState<number | ''>('');
  const [editProgramIsDateFinal, setEditProgramIsDateFinal] = useState<boolean>(true);
  const [editProgramCardTemplate, setEditProgramCardTemplate] = useState<string | null>(null);
  const [editProgramHeartX, setEditProgramHeartX] = useState<number>(144);
  const [editProgramHeartY, setEditProgramHeartY] = useState<number>(112);
  const [editProgramHeartWidth, setEditProgramHeartWidth] = useState<number>(288);
  const [editProgramHeartHeight, setEditProgramHeartHeight] = useState<number>(260);
  const [editProgramPhotoZoom, setEditProgramPhotoZoom] = useState<number>(1.0);
  const [editProgramPhotoOffsetY, setEditProgramPhotoOffsetY] = useState<number>(0);
  const [editProgramError, setEditProgramError] = useState('');
  const [editProgramSuccess, setEditProgramSuccess] = useState('');

  // Duplicate Inquiries States
  const [viewMode, setViewMode] = useState<'all' | 'duplicates' | 'inquiries'>('all');
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [loadingDuplicates, setLoadingDuplicates] = useState(false);
  const [selectedInquiryIds, setSelectedInquiryIds] = useState<string[]>([]);

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

  const [dbStats, setDbStats] = useState<{ dataSizeMB: number, storageSizeMB: number, totalLimitMB: number } | null>(null);

  const fetchDbStats = async (passVal?: string) => {
    const activePassword = passVal || password || sessionStorage.getItem('adminPassword') || '';
    if (!activePassword) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/db-status`, {
        headers: { 'Authorization': activePassword }
      });
      if (res.ok) {
        const data = await res.json();
        setDbStats(data);
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
  const [whatsappTemplateTab, setWhatsappTemplateTab] = useState<'pass_delivery' | 'payment_request'>('pass_delivery');

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
    const siteUrl = typeof window !== 'undefined' ? window.location.origin : 'https://ekdujekeliye.vercel.app';
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
    sortBy?: string;
    sortOrder?: string;
    password?: string;
    showSpinner?: boolean;
  }) => {
    const activePage = options?.page !== undefined ? options.page : currentPage;
    const activeSearch = options?.search !== undefined ? options.search : searchQuery;
    const activeStatus = options?.status !== undefined ? options.status : statusFilter;
    const activeProgramId = options?.programId !== undefined ? options.programId : programFilter;
    const activeSortBy = options?.sortBy !== undefined ? options.sortBy : sortBy;
    const activeSortOrder = options?.sortOrder !== undefined ? options.sortOrder : sortOrder;
    const activePassword = options?.password || password || sessionStorage.getItem('adminPassword') || '';
    const showSpinner = options?.showSpinner !== false;

    if (!activePassword) {
      setLoading(false);
      return;
    }
    try {
      if (showSpinner) setLoading(true);
      const url = `${API_BASE_URL}/api/submissions?page=${activePage}&limit=10&search=${encodeURIComponent(activeSearch)}&status=${activeStatus}&programId=${activeProgramId}&sortBy=${activeSortBy}&sortOrder=${activeSortOrder}`;
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
        fetchSettings();
        fetchDbStats(activePassword);
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
    const activePassword = password || sessionStorage.getItem('adminPassword') || '';
    if (!newProgramName || (newProgramIsDateFinal && !newProgramDate) || !newProgramCapacity) {
      setProgramError('Please fill in all program fields.');
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
          capacity: Number(newProgramCapacity),
          isDateFinal: newProgramIsDateFinal,
          cardTemplate: newProgramCardTemplate,
          heartX: Number(newProgramHeartX),
          heartY: Number(newProgramHeartY),
          heartWidth: Number(newProgramHeartWidth),
          heartHeight: Number(newProgramHeartHeight),
          photoZoom: Number(newProgramPhotoZoom),
          photoOffsetY: Number(newProgramPhotoOffsetY)
        })
      });
      if (res.ok) {
        setProgramSuccess('Program created successfully.');
        setProgramError('');
        setNewProgramName('');
        setNewProgramDate('');
        setNewProgramCapacity('');
        setNewProgramIsDateFinal(true);
        setNewProgramCardTemplate(null);
        setNewProgramHeartX(144);
        setNewProgramHeartY(112);
        setNewProgramHeartWidth(288);
        setNewProgramHeartHeight(260);
        setNewProgramPhotoZoom(1.0);
        setNewProgramPhotoOffsetY(0);
        // Reset the file input field
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
    const activePassword = password || sessionStorage.getItem('adminPassword') || '';
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
    setEditProgramCapacity(prog.capacity);
    setEditProgramIsDateFinal(prog.isDateFinal !== false);
    setEditProgramCardTemplate(prog.cardTemplate || null);
    setEditProgramHeartX(prog.heartX ?? 144);
    setEditProgramHeartY(prog.heartY ?? 112);
    setEditProgramHeartWidth(prog.heartWidth ?? 288);
    setEditProgramHeartHeight(prog.heartHeight ?? 260);
    setEditProgramPhotoZoom(prog.photoZoom ?? 1.0);
    setEditProgramPhotoOffsetY(prog.photoOffsetY ?? 0);
    setEditProgramError('');
    setEditProgramSuccess('');
  };

  const handleUpdateProgram = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProgram) return;
    const activePassword = password || sessionStorage.getItem('adminPassword') || '';
    if (!editProgramName || (editProgramIsDateFinal && !editProgramDate) || !editProgramCapacity) {
      setEditProgramError('Please fill in all program fields.');
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
          capacity: Number(editProgramCapacity),
          isDateFinal: editProgramIsDateFinal,
          cardTemplate: editProgramCardTemplate,
          heartX: Number(editProgramHeartX),
          heartY: Number(editProgramHeartY),
          heartWidth: Number(editProgramHeartWidth),
          heartHeight: Number(editProgramHeartHeight),
          photoZoom: Number(editProgramPhotoZoom),
          photoOffsetY: Number(editProgramPhotoOffsetY)
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
    try {
      const res = await fetch(`${API_BASE_URL}/api/submissions/${inquiryId}/approve`, {
        method: 'POST',
        headers: { 'Authorization': activePassword }
      });
      if (res.ok) {
        fetchSubmissions({ showSpinner: false });
        fetchDuplicates();
        fetchApprovedSubmissionsForFrames();
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(errData.error || 'Failed to approve submission.');
      }
    } catch (err) {
      alert('Network error.');
    }
  };

  const handleRejectSubmission = async (inquiryId: string) => {
    const activePassword = password || sessionStorage.getItem('adminPassword') || '';
    const reason = prompt('Enter reason for rejection:');
    if (reason === null) return;
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
        fetchSubmissions({ showSpinner: false });
        fetchDuplicates();
        fetchApprovedSubmissionsForFrames();
      } else {
        alert('Failed to reject submission.');
      }
    } catch (err) {
      alert('Network error.');
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
        sortBy: sortBy,
        sortOrder: sortOrder
      });
    }, 400); // 400ms debounce

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, statusFilter, programFilter, sortBy, sortOrder, isAuthenticated]);

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
        ctx.strokeText('CPL-SAMPLE', textX, textY);
        ctx.fillStyle = '#D4AF37';
        ctx.fillText('CPL-SAMPLE', textX, textY);
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
        ctx.strokeText('CPL-SAMPLE', textX, textY);
        ctx.fillStyle = '#D4AF37';
        ctx.fillText('CPL-SAMPLE', textX, textY);
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
    fetchSubmissions({ password });
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

  const handleExportCSV = async (exportProgramId: string, exportStatus: string) => {
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
      
      if (programPart && statusPart) {
        filename = `submissions_${programPart}_${statusPart}_export_${new Date().toISOString().split('T')[0]}.csv`;
      } else if (programPart) {
        filename = `submissions_${programPart}_export_${new Date().toISOString().split('T')[0]}.csv`;
      } else if (statusPart) {
        filename = `submissions_${statusPart}_export_${new Date().toISOString().split('T')[0]}.csv`;
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
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => resolve(img);
          img.onerror = (e) => reject(new Error('Failed to load image: ' + src));
          img.src = src;
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
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => resolve(img);
          img.onerror = (e) => reject(new Error('Failed to load image: ' + src));
          img.src = src;
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
        const textY = localHY + localHH + 28;

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
      <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between font-sans relative overflow-hidden">
        {/* Glows */}
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex-grow flex items-center justify-center p-6">
          <div className="w-full max-w-md bg-slate-950/70 border border-slate-800/80 rounded-3xl p-8 backdrop-blur-xl shadow-2xl">
            <div className="text-center mb-8">
              <div className="w-12 h-12 rounded-full bg-amber-500/15 text-amber-500 flex items-center justify-center mx-auto mb-4 font-bold text-xl">
                🔒
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-100">Admin Authentication</h2>
              <p className="text-slate-400 text-sm mt-1">Please enter the security password to access the panel.</p>
            </div>

            {error && (
              <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
                {error}
              </div>
            )}

            <form onSubmit={handleLoginSubmit} className="space-y-6">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 transition-colors text-center text-lg tracking-widest"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-amber-500 hover:bg-amber-600 active:scale-[0.99] text-slate-950 font-bold rounded-2xl transition-all shadow-lg shadow-amber-500/20"
              >
                {loading ? 'Authenticating...' : 'Access Dashboard'}
              </button>
            </form>
          </div>
        </div>

        <footer className="py-6 text-center text-xs text-slate-600">
          Secure Administrative System.
        </footer>
      </div>
    );
  }

  // Dashboard view if authenticated
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans p-6 md:p-12">
      {/* Lightbox / Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-3xl max-h-[85vh] overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 flex flex-col">
            <img
              src={selectedImage.startsWith('data:') ? selectedImage : `${API_BASE_URL}${selectedImage}`}
              alt="Preview"
              className="max-w-full max-h-[70vh] object-contain"
            />
            <div className="p-4 bg-slate-950/90 border-t border-slate-800 flex justify-between items-center gap-4">
              <span className="text-xs text-slate-400 font-mono truncate">{selectedImage.startsWith('data:') ? 'Inline Database Image' : selectedImage}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  downloadImage(selectedImage);
                }}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs transition-all"
              >
                Download File
              </button>
            </div>
            <button
              className="absolute top-4 right-4 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-full w-10 h-10 flex items-center justify-center font-bold text-lg"
              onClick={() => setSelectedImage(null)}
            >
              &times;
            </button>
          </div>
        </div>
      )}

      {/* Export Program Selection Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-6">
            <div>
              <h3 className="text-lg font-bold text-slate-100">Export Submissions</h3>
              <p className="text-xs text-slate-400 mt-1">Select which program slot data you want to export as a CSV sheet.</p>
            </div>
            
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300">Program Slot</label>
              <select
                id="exportProgramSelect"
                defaultValue=""
                className="w-full bg-slate-900 border border-slate-800 text-slate-200 text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-amber-500/50 cursor-pointer"
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
              <label className="text-xs font-semibold text-slate-300">Status</label>
              <select
                id="exportStatusSelect"
                defaultValue=""
                className="w-full bg-slate-900 border border-slate-800 text-slate-200 text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-amber-500/50 cursor-pointer"
              >
                <option value="">All Statuses (બધો ડેટા)</option>
                <option value="pending">Pending Only</option>
                <option value="approved">Approved Only</option>
                <option value="rejected">Rejected Only</option>
              </select>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowExportModal(false)}
                className="px-4 py-2 border border-slate-800 hover:bg-slate-900/60 text-slate-300 font-bold rounded-xl text-xs transition-all active:scale-[0.98]"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const selectEl = document.getElementById('exportProgramSelect') as HTMLSelectElement;
                  const statusEl = document.getElementById('exportStatusSelect') as HTMLSelectElement;
                  const selectedProgramId = selectEl?.value || '';
                  const selectedStatus = statusEl?.value || '';
                  setShowExportModal(false);
                  handleExportCSV(selectedProgramId, selectedStatus);
                }}
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs transition-all active:scale-[0.98]"
              >
                Export Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Submission Modal */}
      {editingSubmission && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="relative w-full max-w-xl bg-slate-950 border border-slate-800 rounded-3xl p-6 md:p-8 backdrop-blur-xl shadow-2xl space-y-6">
            <div className="flex justify-between items-center border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-xl font-bold text-slate-100 tracking-tight">Edit Couple Registration</h2>
                <p className="text-xs text-slate-400 font-mono mt-1">Inquiry ID: {editingSubmission.inquiryId}</p>
              </div>
              <button
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm"
                onClick={() => setEditingSubmission(null)}
              >
                &times;
              </button>
            </div>

            {editError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl">
                {editError}
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Husband Name</label>
                  <input
                    type="text"
                    required
                    value={editHusbandName}
                    onChange={(e) => setEditHusbandName(e.target.value)}
                    placeholder="First Name"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-amber-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Wife Name</label>
                  <input
                    type="text"
                    required
                    value={editWifeName}
                    onChange={(e) => setEditWifeName(e.target.value)}
                    placeholder="First Name"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-amber-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Surname / Family Name</label>
                <input
                  type="text"
                  required
                  value={editSurname}
                  onChange={(e) => setEditSurname(e.target.value)}
                  placeholder="e.g. Patel"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Phone Number (WhatsApp)</label>
                <input
                  type="tel"
                  required
                  value={editPhoneNumber}
                  onChange={(e) => setEditPhoneNumber(e.target.value)}
                  placeholder="10-digit number"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Select Program Slot</label>
                  <select
                    value={editProgramId}
                    onChange={(e) => setEditProgramId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-amber-500 transition-colors"
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
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-amber-500 transition-colors font-semibold"
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
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Rejection Reason</label>
                  <input
                    type="text"
                    required
                    value={editRejectionReason}
                    onChange={(e) => setEditRejectionReason(e.target.value)}
                    placeholder="Enter reason for rejection"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-amber-500 transition-colors"
                  />
                </div>
              )}

              {editStatus === 'refunded' && (
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Refund Reason</label>
                  <input
                    type="text"
                    required
                    value={editRefundReason}
                    onChange={(e) => setEditRefundReason(e.target.value)}
                    placeholder="Enter reason for refund"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-amber-500 transition-colors"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Update Couple Photo</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setEditCouplePhoto(e.target.files?.[0] || null)}
                    className="w-full text-xs text-slate-400 file:mr-2 file:py-1 file:px-2 file:rounded-lg file:border-0 file:text-[10px] file:font-semibold file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700 cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Update Payment Screenshot</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setEditPaymentScreenshot(e.target.files?.[0] || null)}
                    className="w-full text-xs text-slate-400 file:mr-2 file:py-1 file:px-2 file:rounded-lg file:border-0 file:text-[10px] file:font-semibold file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700 cursor-pointer"
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingSubmission(null)}
                  className="flex-1 py-2.5 border border-slate-800 hover:bg-slate-900 text-slate-300 font-bold rounded-xl text-xs transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-bold rounded-xl text-xs transition-all shadow-lg shadow-amber-500/20"
                >
                  {updating ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingProgram && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="relative w-full max-w-md bg-slate-950 border border-slate-800 rounded-3xl p-6 md:p-8 backdrop-blur-xl shadow-2xl space-y-6">
            <div className="flex justify-between items-center border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-xl font-bold text-slate-100 tracking-tight">Edit Program Slot</h2>
              </div>
              <button
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm"
                onClick={() => setEditingProgram(null)}
              >
                &times;
              </button>
            </div>

            {editProgramError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl">
                {editProgramError}
              </div>
            )}
            {editProgramSuccess && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl">
                {editProgramSuccess}
              </div>
            )}

            <form onSubmit={handleUpdateProgram} className="space-y-4">
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Program Name</label>
                <input
                  type="text"
                  required
                  value={editProgramName}
                  onChange={(e) => setEditProgramName(e.target.value)}
                  placeholder="e.g. Couples Gala Dinner"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Program Date</label>
                <input
                  type="date"
                  required={editProgramIsDateFinal}
                  value={editProgramDate}
                  onChange={(e) => setEditProgramDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              <div className="flex items-center gap-2 py-2">
                <input
                  type="checkbox"
                  id="editProgramIsDateFinal"
                  checked={editProgramIsDateFinal}
                  onChange={(e) => setEditProgramIsDateFinal(e.target.checked)}
                  className="rounded bg-slate-900 border-slate-800 text-amber-500 focus:ring-amber-500 h-4 w-4"
                />
                <label htmlFor="editProgramIsDateFinal" className="text-xs font-semibold text-slate-300 cursor-pointer">
                  Date is Final? / Collect Payment (તારીખ નક્કી છે / પેમેન્ટ લેવું)
                </label>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Hall Capacity (Seats)</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={editProgramCapacity}
                  onChange={(e) => setEditProgramCapacity(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="e.g. 600"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              <div className="border border-slate-800 rounded-xl p-3 bg-slate-900/30 space-y-4">
                <span className="block text-[10px] font-bold text-amber-500 uppercase tracking-wider">Pass Design Adjustments</span>

                {/* Live Preview canvas */}
                <div className="w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-950 p-2 flex justify-center">
                  <canvas
                    id="programEditPreviewCanvas"
                    style={{ width: '150px', height: '266px' }}
                    className="bg-slate-950 rounded-lg shadow-inner"
                  />
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-[9px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Heart X Position ({editProgramHeartX}px)</label>
                    <input
                      type="range"
                      min="0"
                      max="576"
                      value={editProgramHeartX}
                      onChange={(e) => setEditProgramHeartX(Number(e.target.value))}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Heart Y Position ({editProgramHeartY}px)</label>
                    <input
                      type="range"
                      min="0"
                      max="1024"
                      value={editProgramHeartY}
                      onChange={(e) => setEditProgramHeartY(Number(e.target.value))}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Heart Width ({editProgramHeartWidth}px)</label>
                    <input
                      type="range"
                      min="50"
                      max="500"
                      value={editProgramHeartWidth}
                      onChange={(e) => setEditProgramHeartWidth(Number(e.target.value))}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Heart Height ({editProgramHeartHeight}px)</label>
                    <input
                      type="range"
                      min="50"
                      max="500"
                      value={editProgramHeartHeight}
                      onChange={(e) => setEditProgramHeartHeight(Number(e.target.value))}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Photo Zoom ({editProgramPhotoZoom}x)</label>
                    <input
                      type="range"
                      min="0.5"
                      max="2.5"
                      step="0.05"
                      value={editProgramPhotoZoom}
                      onChange={(e) => setEditProgramPhotoZoom(Number(e.target.value))}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Photo Vertical Shift ({editProgramPhotoOffsetY}px)</label>
                    <input
                      type="range"
                      min="-300"
                      max="300"
                      value={editProgramPhotoOffsetY}
                      onChange={(e) => setEditProgramPhotoOffsetY(Number(e.target.value))}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
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
                      className="w-full py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white rounded-lg text-xs font-bold transition-all border border-slate-700"
                    >
                      Reset to Default Layout
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Entry Pass Template Image (Optional)</label>
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
                  className="w-full text-slate-400 text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700 file:cursor-pointer cursor-pointer bg-slate-900 border border-slate-800 rounded-xl px-3 py-2"
                />
                {editProgramCardTemplate && (
                  <div className="mt-2 text-[10px] text-emerald-400 flex items-center gap-1.5">
                    <span>✓ Template loaded</span>
                    <button
                      type="button"
                      onClick={() => setEditProgramCardTemplate(null)}
                      className="text-red-400 hover:text-red-300 font-bold underline"
                    >
                      Clear/Remove
                    </button>
                  </div>
                )}
              </div>

              <div className="pt-4 flex gap-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingProgram(null)}
                  className="flex-1 py-2.5 border border-slate-800 hover:bg-slate-900 text-slate-300 font-bold rounded-xl text-xs transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs transition-all shadow-lg shadow-amber-500/20"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {reviewingProgramForFrames && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
          <div className="relative w-full max-w-4xl h-[90vh] bg-slate-950 border border-slate-800 rounded-3xl p-6 md:p-8 backdrop-blur-xl shadow-2xl flex flex-col space-y-6">
            <div className="flex justify-between items-center border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-xl font-bold text-slate-100 tracking-tight">Review & Adjust Framed Photos</h2>
                <p className="text-xs text-slate-400 mt-1">Program: {reviewingProgramForFrames.name} ({reviewingProgramForFrames.date})</p>
              </div>
              <button 
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm"
                onClick={() => setReviewingProgramForFrames(null)}
              >
                &times;
              </button>
            </div>

            {/* Scrollable list of registrations */}
            <div className="flex-1 overflow-y-auto pr-2 space-y-4">
              {approvedSubmissionsForFrames.filter(sub => selectedFrameInquiryIds.includes(sub.inquiryId)).length === 0 ? (
                <p className="text-center text-slate-500 text-sm py-12">No selected couple registrations to review.</p>
              ) : (
                approvedSubmissionsForFrames.filter(sub => selectedFrameInquiryIds.includes(sub.inquiryId)).map((sub) => (
                  <div key={sub.inquiryId} className="flex flex-col sm:flex-row items-center gap-6 bg-slate-900/40 border border-slate-850 rounded-2xl p-4 shadow-sm">
                    {/* Live Preview canvas */}
                    <div className="w-[120px] h-[160px] overflow-hidden rounded-xl border border-slate-800 bg-slate-950 flex items-center justify-center flex-shrink-0">
                      <LivePreviewCanvas sub={sub} frameImg={globalFrameImg} />
                    </div>

                    <div className="flex-1 w-full space-y-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-bold text-slate-200 text-sm leading-snug">{sub.husbandName} & {sub.wifeName} {sub.surname}</h4>
                          <span className="text-[10px] text-amber-500 font-mono font-bold tracking-wider uppercase">{sub.inquiryId}</span>
                        </div>
                        <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded-md uppercase">Approved</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[9px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Photo Zoom ({(sub.photoZoom ?? 1.0).toFixed(2)}x)</label>
                          <input
                            type="range"
                            min="0.5"
                            max="2.0"
                            step="0.05"
                            value={sub.photoZoom ?? 1.0}
                            onChange={(e) => updateSubmissionCoordInState(sub.inquiryId, 'photoZoom', Number(e.target.value))}
                            className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[9px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Photo Vertical Shift ({sub.photoOffsetY ?? 0}px)</label>
                          <input
                            type="range"
                            min="-150"
                            max="150"
                            value={sub.photoOffsetY ?? 0}
                            onChange={(e) => updateSubmissionCoordInState(sub.inquiryId, 'photoOffsetY', Number(e.target.value))}
                            className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Modal actions */}
            <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row gap-4 items-center justify-between">
              <span className="text-[11px] text-slate-500">
                Adjusting sliders here updates the crop of their framed photo instantly, and also permanently saves it to the database for their pass!
              </span>
              <div className="flex gap-3 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setReviewingProgramForFrames(null)}
                  className="px-5 py-2.5 bg-slate-900 border border-slate-800 hover:bg-slate-850 text-slate-300 font-bold rounded-xl text-xs transition-all w-full sm:w-auto text-center"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handleSaveAndDownloadZip}
                  disabled={zipping || selectedFrameInquiryIds.length === 0}
                  className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-extrabold rounded-xl text-xs transition-all w-full sm:w-auto text-center shadow-lg shadow-amber-500/20"
                >
                  {zipping ? `Processing (${zipProgress})` : 'Save Alignments & Download ZIP'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-6">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-100 tracking-tight flex items-center gap-3">
              <img src="/logo.png" alt="Ek Duje Ke Liye Logo" className="h-9 w-auto object-contain" />
              Admin Dashboard
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Manage, verify, and view all couple card registration entries.
              {role === 'superadmin' && <span className="ml-2 px-2 py-0.5 bg-purple-500/10 border border-purple-500/25 text-purple-400 text-xs font-bold rounded-md">SUPER ADMIN</span>}
            </p>
          </div>
          <div className="flex items-center gap-4 w-full md:w-auto">
            {role === 'superadmin' && (
              <button
                onClick={handleClearData}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-red-600/20"
              >
                Clear All Data
              </button>
            )}
            <button
              onClick={() => setShowExportModal(true)}
              disabled={isExporting}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-800 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-emerald-600/20 flex items-center gap-2"
            >
              {isExporting ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Exporting...
                </>
              ) : (
                'Export to Sheet'
              )}
            </button>
            <button
              onClick={() => fetchSubmissions()}
              className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold rounded-xl text-sm transition-all border border-slate-700"
            >
              Refresh Data
            </button>
            <button
              onClick={handleLogout}
              className="px-5 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-semibold rounded-xl text-sm transition-all border border-red-500/20"
            >
              Log Out
            </button>
        </div>
      </div>

        {/* UPI Auto-Rotation Notifications Banner */}
        {notifications.length > 0 && (
          <div className="space-y-3">
            {notifications.map((notif) => (
              <div 
                key={notif._id}
                className={`p-4 rounded-2xl border flex justify-between items-start gap-4 transition-all shadow-lg ${
                  notif.type === 'error' 
                    ? 'bg-red-500/10 border-red-500/30 text-red-200' 
                    : 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-xl mt-0.5">{notif.type === 'error' ? '🚨' : '🔔'}</span>
                  <div>
                    <h4 className="font-bold text-sm">{notif.title}</h4>
                    <p className="text-xs text-slate-350 mt-1">{notif.message}</p>
                    <span className="text-[10px] text-slate-500 mt-2 block">
                      {new Date(notif.createdAt).toLocaleString()}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => dismissNotification(notif._id)}
                  className="px-2.5 py-1 bg-slate-900/60 hover:bg-slate-900 border border-slate-800 text-[10px] font-semibold text-slate-300 rounded-lg cursor-pointer transition-all active:scale-[0.98]"
                >
                  Dismiss
                </button>
              </div>
            ))}
            <div className="flex justify-end">
              <button
                onClick={() => dismissNotification()}
                className="text-xs text-slate-400 hover:text-slate-200 font-medium underline cursor-pointer"
              >
                Clear All Notifications
              </button>
            </div>
          </div>
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="p-6 bg-slate-950/60 border border-slate-800/80 rounded-2xl backdrop-blur-md">
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider block">Total Inquiries</span>
            <span className="text-4xl font-extrabold text-slate-100 mt-2 block">{totalSubmissions}</span>
          </div>
          <div className="p-6 bg-slate-950/60 border border-slate-800/80 rounded-2xl backdrop-blur-md">
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider block">Latest Token ID</span>
            <span className="text-4xl font-extrabold text-amber-500 mt-2 block">{latestTokenId}</span>
          </div>
          <div className="p-6 bg-slate-950/60 border border-slate-800/80 rounded-2xl backdrop-blur-md">
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider block">Database Storage</span>
            <span className="text-2xl font-extrabold text-slate-100 mt-2 block">
              {dbStats ? `${dbStats.storageSizeMB.toFixed(1)} MB / ${dbStats.totalLimitMB} MB` : 'Loading...'}
            </span>
            {dbStats && (
              <div className="mt-3 space-y-1.5">
                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
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
          <div className="p-6 bg-slate-950/60 border border-slate-800/80 rounded-2xl backdrop-blur-md">
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider block">System Status</span>
            <span className="text-4xl font-extrabold text-emerald-500 mt-2 block">Secure</span>
          </div>
        </div>

        {/* Program Slots Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Create Program Form */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-6 space-y-6">
            <div>
              <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                Add Program Slot
              </h2>
              <p className="text-slate-400 text-xs mt-1">Schedule a program with a specific date and seat capacity.</p>
            </div>

            {programError && (
              <div className="p-3 text-xs bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg">
                {programError}
              </div>
            )}
            {programSuccess && (
              <div className="p-3 text-xs bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg">
                {programSuccess}
              </div>
            )}

            <form onSubmit={handleCreateProgram} className="space-y-4">
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Program Name</label>
                <input
                  type="text"
                  required
                  value={newProgramName}
                  onChange={(e) => setNewProgramName(e.target.value)}
                  placeholder="e.g. Couples Gala Dinner"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Program Date</label>
                <input
                  type="date"
                  required={newProgramIsDateFinal}
                  value={newProgramDate}
                  onChange={(e) => setNewProgramDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              <div className="flex items-center gap-2 py-2">
                <input
                  type="checkbox"
                  id="newProgramIsDateFinal"
                  checked={newProgramIsDateFinal}
                  onChange={(e) => setNewProgramIsDateFinal(e.target.checked)}
                  className="rounded bg-slate-900 border-slate-800 text-amber-500 focus:ring-amber-500 h-4 w-4"
                />
                <label htmlFor="newProgramIsDateFinal" className="text-xs font-semibold text-slate-300 cursor-pointer">
                  Date is Final? / Collect Payment (તારીખ નક્કી છે / પેમેન્ટ લેવું)
                </label>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Hall Capacity (Seats, e.g. 600 for 300 Couples)</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={newProgramCapacity}
                  onChange={(e) => setNewProgramCapacity(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="e.g. 600"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Entry Pass Template Image (Optional)</label>
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
                  className="w-full text-slate-400 text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700 file:cursor-pointer cursor-pointer bg-slate-900 border border-slate-800 rounded-xl px-3 py-2"
                />
                {newProgramCardTemplate && (
                  <div className="mt-2 text-[10px] text-emerald-400 flex items-center gap-1.5">
                    <span>✓ Template loaded</span>
                    <button
                      type="button"
                      onClick={() => {
                        setNewProgramCardTemplate(null);
                        const fileInput = document.getElementById('programCardTemplateInput') as HTMLInputElement;
                        if (fileInput) fileInput.value = '';
                      }}
                      className="text-red-400 hover:text-red-300 font-bold underline"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-amber-500 hover:bg-amber-600 active:scale-[0.99] text-slate-950 font-bold rounded-xl text-sm transition-all"
              >
                Add Program Slot
              </button>
            </form>
          </div>

          {/* Programs List */}
          <div className="lg:col-span-2 bg-slate-950/60 border border-slate-800/80 rounded-2xl p-6 flex flex-col">
            <div>
              <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                <span>🎟️</span> Scheduled Slots
              </h2>
              <p className="text-slate-400 text-xs mt-1">Active program sessions, capacities, and booking status.</p>
            </div>

            <div className="mt-4 flex-grow overflow-y-auto max-h-[320px] space-y-3 pr-2">
              {programs.length === 0 ? (
                <div className="text-center py-10 text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
                  No programs scheduled yet.
                </div>
              ) : (
                programs.map((prog) => {
                  const isSoldOut = prog.bookingsCount + 2 > prog.capacity;
                  return (
                    <div key={prog.id} className="flex justify-between items-center p-3 bg-slate-900/60 border border-slate-800/80 rounded-xl hover:border-slate-700 transition-colors">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-200 text-sm">{prog.name}</span>
                          {isSoldOut ? (
                            <span className="px-2 py-0.5 text-[10px] bg-red-500/10 border border-red-500/20 text-red-400 rounded-full font-bold uppercase tracking-wider">Sold Out</span>
                          ) : (
                            <span className="px-2 py-0.5 text-[10px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full font-bold uppercase tracking-wider">Active</span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400 flex items-center gap-4 flex-wrap">
                          <span>{prog.date}</span>
                          <span>👥 Booked: <strong className={isSoldOut ? "text-red-400" : "text-amber-500"}>{Math.floor(prog.bookingsCount / 2)}</strong> / {Math.floor(prog.capacity / 2)}</span>
                          {prog.inquiryCount !== undefined && prog.inquiryCount > 0 && (
                            <span className="flex items-center gap-1 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20 text-blue-300">
                              📝 Inquiries: <strong>{prog.inquiryCount}</strong>
                            </span>
                          )}
                          {prog.pendingCount !== undefined && prog.pendingCount > 0 && (
                            <span className="flex items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 text-amber-300">
                              ⏳ Pending: <strong>{prog.pendingCount}</strong>
                            </span>
                          )}
                          {prog.approvedCount !== undefined && prog.approvedCount > 0 && (
                            <span className="flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 text-emerald-300">
                              ✓ Approved: <strong>{prog.approvedCount}</strong>
                            </span>
                          )}
                          {prog.rejectedCount !== undefined && prog.rejectedCount > 0 && (
                            <span className="flex items-center gap-1 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20 text-red-300">
                              ✗ Rejected: <strong>{prog.rejectedCount}</strong>
                            </span>
                          )}
                          <span className="flex items-center gap-1 bg-pink-500/10 px-2 py-0.5 rounded-full border border-pink-500/20 text-pink-300">
                            💑 CPL: <strong>{prog.cplApproved || 0}</strong> Appr / <strong>{(prog.cplApproved || 0) + (prog.cplPending || 0) + (prog.cplInquiry || 0)}</strong> Total
                          </span>
                          <span className="flex items-center gap-1 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/20 text-purple-300">
                            👤 IP: <strong>{prog.ipApproved || 0}</strong> Appr / <strong>{(prog.ipApproved || 0) + (prog.ipPending || 0) + (prog.ipInquiry || 0)}</strong> Total
                          </span>
                          {prog.cardTemplate && (
                            <span className="text-[10px] text-emerald-400 flex items-center gap-1 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                              🖼️ Custom Pass
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditProgramClick(prog)}
                          className="p-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded-lg text-xs font-semibold transition-all border border-amber-500/20"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteProgram(prog.id)}
                          className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-xs font-semibold transition-all border border-red-500/20"
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

        {/* Payment Settings Section */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-6 space-y-6">
          <div>
            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <span>💳</span> Payment Settings (UPI QR Code)
            </h2>
            <p className="text-slate-400 text-xs mt-1">Configure the active UPI account details and amount for ticket payments.</p>
          </div>

          {settingsError && (
            <div className="p-3 text-xs bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg">
              {settingsError}
            </div>
          )}
          {settingsSuccess && (
            <div className="p-3 text-xs bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg">
              {settingsSuccess}
            </div>
          )}

          <form onSubmit={handleUpdateSettings} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">UPI ID List (Comma separated for Auto-Rotation)</label>
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
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Currently Active UPI ID</label>
                <input
                  type="text"
                  required
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  placeholder="e.g. payee@upi"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Rotation Limit (Submissions per UPI)</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={upiLimit}
                  onChange={(e) => setUpiLimit(Number(e.target.value))}
                  placeholder="e.g. 50"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Payee Name</label>
                <input
                  type="text"
                  required
                  value={payeeName}
                  onChange={(e) => setPayeeName(e.target.value)}
                  placeholder="e.g. Couple Pass Org"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Ticket Price (INR)</label>
                <input
                  type="number"
                  required
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g. 100"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              <div className="flex justify-between items-center bg-slate-900/60 border border-slate-800/80 rounded-xl px-4 py-2 text-xs">
                <div>
                  <span className="text-slate-400">Current UPI Usage:</span>
                  <div className="font-bold text-amber-500 text-sm">{upiBookingsCount} / {upiLimit} registrations</div>
                </div>
                <button
                  type="submit"
                  className="px-6 py-2 bg-amber-500 hover:bg-amber-600 active:scale-[0.99] text-slate-950 font-bold rounded-xl text-sm transition-all h-[38px]"
                >
                  Save Settings
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Manual Invitee Registration Section */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-6 space-y-6">
          <div>
            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <span>✍️</span> Manual Invitee Registration (મેન્યુઅલ એન્ટ્રી)
            </h2>
            <p className="text-slate-400 text-xs mt-1">Directly register invited couples, generating an instant approved pass with prefix IP-.</p>
          </div>

          {manualError && (
            <div className="p-3 text-xs bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg">
              {manualError}
            </div>
          )}
          {manualSuccess && (
            <div className="p-3 text-xs bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg space-y-2">
              <div>{manualSuccess}</div>
              {generatedPassUrl && (
                <div className="mt-3 p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <span className="font-mono text-xs text-amber-500 select-all break-all">{generatedPassUrl}</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(generatedPassUrl);
                          alert('Pass link copied to clipboard!');
                        }}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-100 text-[10px] font-bold rounded-lg transition-all"
                      >
                        Copy Link
                      </button>
                      <a
                        href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`Hello! Your manual registration pass is ready. You can download it here: ${generatedPassUrl}`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded-lg transition-all flex items-center gap-1"
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
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Husband Name (પતિનું નામ)</label>
                <input
                  type="text"
                  required
                  value={manualHusbandName}
                  onChange={(e) => setManualHusbandName(e.target.value)}
                  placeholder="Enter Husband's Name"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Wife Name (પત્નીનું નામ)</label>
                <input
                  type="text"
                  required
                  value={manualWifeName}
                  onChange={(e) => setManualWifeName(e.target.value)}
                  placeholder="Enter Wife's Name"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Surname (અટક)</label>
                <input
                  type="text"
                  required
                  value={manualSurname}
                  onChange={(e) => setManualSurname(e.target.value)}
                  placeholder="Enter Surname"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Phone Number (મોબાઇલ નંબર)</label>
                <input
                  type="tel"
                  required
                  pattern="[6-9][0-9]{9}"
                  value={manualPhoneNumber}
                  onChange={(e) => setManualPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="Enter 10-digit number"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Select Program Slot</label>
                <select
                  required
                  value={manualProgramId}
                  onChange={(e) => setManualProgramId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-amber-500 transition-colors cursor-pointer"
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
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Couple Photo (Optional / મરજીયાત)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setManualCouplePhoto(e.target.files[0]);
                    }
                  }}
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-slate-450 text-xs focus:outline-none focus:border-amber-500 file:mr-4 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-[10px] file:font-semibold file:bg-amber-500/10 file:text-amber-400 hover:file:bg-amber-500/20 cursor-pointer"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={manualLoading}
                className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 active:scale-[0.99] disabled:opacity-50 text-slate-950 font-bold rounded-xl text-sm transition-all shadow-lg shadow-amber-500/20"
              >
                {manualLoading ? 'Registering...' : 'Register Invited Guest'}
              </button>
            </div>
          </form>
        </div>

        {/* WhatsApp Message Templates Section */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-6 space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                <span>💬</span> WhatsApp Message Templates
              </h2>
              <p className="text-slate-400 text-xs mt-1">
                Manage templates for sending passes to users, and messages sent by users after registration.
              </p>
            </div>
            
            {/* Tab switcher */}
            <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 self-stretch sm:self-auto">
              <button
                type="button"
                onClick={() => setWhatsappTemplateTab('pass_delivery')}
                className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${whatsappTemplateTab === 'pass_delivery' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Pass Delivery (Admin to User)
              </button>
              <button
                type="button"
                onClick={() => setWhatsappTemplateTab('payment_request')}
                className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${whatsappTemplateTab === 'payment_request' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Payment Request (User to Admin)
              </button>
            </div>
          </div>

          {/* Add Template Form */}
          <div className="bg-slate-900/40 border border-slate-800/60 rounded-xl p-4 space-y-4">
            <h3 className="text-sm font-bold text-slate-200">
              Create New {whatsappTemplateTab === 'pass_delivery' ? 'Pass Delivery' : 'Payment Request'} Template
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div className="md:col-span-1">
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Template Name</label>
                <input
                  type="text"
                  id="newTemplateName"
                  placeholder={whatsappTemplateTab === 'pass_delivery' ? "e.g. Gujarati Pass Msg" : "e.g. Payment Done Request"}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>
              <div className="md:col-span-2 flex gap-4">
                <div className="flex-grow">
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Message Text</label>
                  <input
                    type="text"
                    id="newTemplateText"
                    placeholder={whatsappTemplateTab === 'pass_delivery' ? "Hello! Download your pass here: {passUrl}" : "Hello! Verified. Inquiry ID: {inquiryId}"}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-amber-500 transition-colors"
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
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 active:scale-[0.99] text-slate-950 font-bold rounded-xl text-xs transition-all h-[38px] self-end"
                >
                  Create
                </button>
              </div>
            </div>
            <div className="text-[10px] text-slate-500 flex flex-wrap gap-x-4">
              <span>Supported Variables:</span>
              {whatsappTemplateTab === 'pass_delivery' ? (
                <>
                  <span><code>{`{husbandName}`}</code></span>
                  <span><code>{`{wifeName}`}</code></span>
                  <span><code>{`{surname}`}</code></span>
                  <span><code>{`{inquiryId}`}</code></span>
                  <span><code>{`{passUrl}`}</code></span>
                </>
              ) : (
                <>
                  <span><code>{`{programName}`}</code></span>
                  <span><code>{`{inquiryId}`}</code></span>
                  <span><code>{`{phoneNumber}`}</code></span>
                </>
              )}
            </div>
          </div>

          {/* Templates List */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-200">
              Available {whatsappTemplateTab === 'pass_delivery' ? 'Pass Delivery' : 'Payment Request'} Templates
            </h3>
            {whatsappTemplates.filter(t => t.type === whatsappTemplateTab).length === 0 ? (
              <p className="text-xs text-slate-500 italic">No templates of this type available. The default message will be used.</p>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {whatsappTemplates.filter(t => t.type === whatsappTemplateTab).map((t) => (
                  <div key={t._id} className={`flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 bg-slate-900 border rounded-xl gap-4 ${t.isActive ? 'border-amber-500/50 bg-amber-500/[0.02]' : 'border-slate-800'}`}>
                    <div className="space-y-1 flex-grow">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-200 text-sm">{t.name}</span>
                        {t.isActive && (
                          <span className="px-2 py-0.5 text-[9px] bg-amber-500/10 border border-amber-500/25 text-amber-500 rounded-full font-bold uppercase">Active</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 font-mono break-all bg-slate-950/40 p-2 rounded-lg border border-slate-850 mt-1.5">{t.text}</p>
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
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition-all border border-slate-700"
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
                          className="px-3 py-1.5 bg-red-950/20 hover:bg-red-900/30 text-red-400 rounded-lg text-xs font-semibold transition-all border border-red-900/30"
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
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-6 space-y-6">
          <div>
            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <span>🖼️</span> Frame Download Option
            </h2>
            <p className="text-slate-400 text-xs mt-1">Select a program, filter/search multiple CPL IDs, select/deselect them, and download/adjust frames for only the selected couples.</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div className="w-full sm:w-72">
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Select Program Session</label>
              <select
                value={selectedProgramIdForFrames}
                onChange={(e) => setSelectedProgramIdForFrames(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-amber-500 transition-colors"
              >
                <option value="">-- Choose Program Slot --</option>
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.date})</option>
                ))}
              </select>
            </div>
          </div>

          {selectedProgramIdForFrames && (
            <div className="space-y-4 border-t border-slate-800/60 pt-4">
              {/* Search CPL IDs Input */}
              <div className="w-full">
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Search Multiple CPL IDs (Comma or space separated)
                </label>
                <input
                  type="text"
                  value={cplSearchQuery}
                  onChange={(e) => setCplSearchQuery(e.target.value)}
                  placeholder="e.g. CPL-101, CPL-102, CPL-105"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              {/* Selection Controls */}
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      // Select all matched/filtered ones
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
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-lg font-medium transition-all"
                  >
                    Select All Filtered
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      // Deselect all matched/filtered ones
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
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-lg font-medium transition-all"
                  >
                    Deselect All Filtered
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFrameInquiryIds(approvedSubmissionsForFrames.map(sub => sub.inquiryId));
                    }}
                    className="px-3 py-1.5 bg-emerald-950/30 hover:bg-emerald-900/40 border border-emerald-900/40 text-emerald-400 rounded-lg font-medium transition-all"
                  >
                    Select All (બધા સિલેક્ટ કરો)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFrameInquiryIds([]);
                    }}
                    className="px-3 py-1.5 bg-red-950/30 hover:bg-red-900/40 border border-red-900/40 text-red-400 rounded-lg font-medium transition-all"
                  >
                    Clear Selection (બધા અન-સિલેક્ટ કરો)
                  </button>
                </div>
                <div className="text-slate-400 font-semibold">
                  Selected: <span className="text-amber-500">{selectedFrameInquiryIds.length}</span> / {approvedSubmissionsForFrames.length}
                </div>
              </div>

              {/* List of Couples */}
              <div className="max-h-48 overflow-y-auto border border-slate-800/80 rounded-xl bg-slate-900/20 p-3 space-y-2">
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
                      <label key={sub.inquiryId} className="flex items-center gap-3 p-2 hover:bg-slate-900/60 rounded-lg cursor-pointer transition-colors">
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
                          className="rounded border-slate-800 bg-slate-950 text-amber-500 focus:ring-amber-500/50 w-4 h-4 cursor-pointer"
                        />
                        <span className="font-mono text-xs font-bold text-amber-500 w-20">{sub.inquiryId}</span>
                        <span className="text-xs text-slate-200">{sub.husbandName} & {sub.wifeName} {sub.surname}</span>
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
                  <p className="text-center text-xs text-slate-500 py-4">No matching couples found.</p>
                )}
              </div>

              {/* Action and Count */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-slate-900/40 border border-slate-800/80 rounded-xl">
                <div>
                  <p className="text-sm font-semibold text-slate-200">
                    Total Selected Couples for Download: <span className="text-amber-500 font-bold">{selectedFrameInquiryIds.length}</span>
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
                    className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-bold rounded-xl text-sm transition-all shadow-lg shadow-amber-500/20 text-center"
                  >
                    {zipping ? `Processing (${zipProgress})` : 'Review & Download ZIP'}
                  </button>
                  <button
                    onClick={() => handleDownloadRawZip()}
                    disabled={zipping || selectedFrameInquiryIds.length === 0}
                    className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-slate-100 font-bold rounded-xl text-sm transition-all shadow-lg shadow-purple-600/20 text-center"
                  >
                    {zipping ? `Processing (${zipProgress})` : 'Download Raw Photos ZIP'}
                  </button>
                  <button
                    onClick={() => handleDownloadPassesZip()}
                    disabled={zipping || selectedFrameInquiryIds.length === 0}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-slate-100 font-bold rounded-xl text-sm transition-all shadow-lg shadow-emerald-600/20 text-center"
                  >
                    {zipping ? `Processing (${zipProgress})` : 'Download Entry Passes ZIP'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* View Mode Tabs */}
        <div className="flex bg-slate-950/40 p-1.5 rounded-2xl border border-slate-800/80 gap-2 mb-6">
          <button
            type="button"
            onClick={() => {
              setViewMode('all');
              setStatusFilter('');
              fetchSubmissions({ page: 1, status: '' });
            }}
            className={`flex-1 py-3 text-center rounded-xl text-sm font-bold transition-all ${viewMode === 'all' ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/10' : 'text-slate-400 hover:text-slate-200'}`}
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
            className={`flex-1 py-3 text-center rounded-xl text-sm font-bold transition-all ${viewMode === 'inquiries' ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/10' : 'text-slate-400 hover:text-slate-200'}`}
          >
            📝 Inquiries Only (માત્ર ઇન્ક્વાયરી)
          </button>
          <button
            type="button"
            onClick={() => {
              setViewMode('duplicates');
              fetchDuplicates();
            }}
            className={`flex-1 py-3 text-center rounded-xl text-sm font-bold transition-all ${viewMode === 'duplicates' ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/10' : 'text-slate-400 hover:text-slate-200'}`}
          >
            ⚠️ Duplicate Inquiries (ડુપ્લિકેટ ઇન્ક્વાયરી)
          </button>
        </div>

        {viewMode === 'all' || viewMode === 'inquiries' ? (
          <>
            {/* Filters and Search */}
            <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center">
          <div className="flex-1 flex items-center bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 gap-3">
            <span className="text-slate-500 pl-2">🔍</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by token, names, surname, or phone..."
              className="w-full bg-transparent border-none text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-0 text-sm py-1"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-semibold">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => {
                  const val = e.target.value;
                  setStatusFilter(val);
                  fetchSubmissions({ page: 1, status: val });
                }}
                className="bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-amber-500/50"
              >
                <option value="">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="refunded">Refunded (રિફંડ કરેલ)</option>
                <option value="inquiry">Inquiries (ઇન્ક્વાયરી)</option>
              </select>
            </div>

            {/* Program Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-semibold">Program:</span>
              <select
                value={programFilter}
                onChange={(e) => {
                  const val = e.target.value;
                  setProgramFilter(val);
                  fetchSubmissions({ page: 1, programId: val });
                }}
                className="bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-amber-500/50 cursor-pointer"
              >
                <option value="">All Programs</option>
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.date})
                  </option>
                ))}
              </select>
            </div>

            {/* Sort Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-semibold">Sort By:</span>
              <select
                value={`${sortBy}-${sortOrder}`}
                onChange={(e) => {
                  const [field, order] = e.target.value.split('-');
                  setSortBy(field);
                  setSortOrder(order);
                  fetchSubmissions({ page: 1, sortBy: field, sortOrder: order });
                }}
                className="bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-amber-500/50 cursor-pointer"
              >
                <option value="createdAt-desc">Newest First</option>
                <option value="createdAt-asc">Oldest First</option>
                <option value="inquiryId-asc">Token ID (Ascending)</option>
                <option value="inquiryId-desc">Token ID (Descending)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Table / Grid */}
        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-20 text-slate-400">Loading registrations...</div>
        ) : filteredSubmissions.length === 0 ? (
          <div className="text-center py-20 text-slate-400 border border-dashed border-slate-800 rounded-2xl">
            No registrations found.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto border border-slate-800 rounded-2xl bg-slate-950/40">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/80 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  <th className="py-4 px-6">Token ID</th>
                  <th className="py-4 px-6">Program Slot</th>
                  <th className="py-4 px-6">Couple Names</th>
                  <th className="py-4 px-6">Surname</th>
                  <th className="py-4 px-6">Phone</th>
                  <th className="py-4 px-6">Couple Photo</th>
                  <th className="py-4 px-6">Payment Proof</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6">Submitted At</th>
                  <th className="py-4 px-6">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {filteredSubmissions.map((sub) => {
                  const cleanPhone = sub.phoneNumber.replace(/[^0-9]/g, '');
                  const waPhone = cleanPhone.length === 10 ? '91' + cleanPhone : cleanPhone;
                  const isApproved = sub.status === 'approved';
                  const isRejected = sub.status === 'rejected';
                  const isRefunded = sub.status === 'refunded';
                  const isInquiry = sub.status === 'inquiry';
                  const isPending = !isApproved && !isRejected && !isInquiry && !isRefunded;

                  return (
                    <tr key={sub.inquiryId} className="hover:bg-slate-900/30 transition-colors">
                      <td className="py-4 px-6 font-mono text-amber-500 font-bold">{sub.inquiryId}</td>
                      <td className="py-4 px-6 text-slate-300">
                        {sub.programName ? (
                          <div>
                            <div className="font-semibold text-slate-200">{sub.programName}</div>
                            <div className="text-xs text-slate-500">{sub.programDate}</div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-500">N/A</span>
                        )}
                      </td>
                      <td className="py-4 px-6 font-semibold text-slate-200">
                        {sub.husbandName} & {sub.wifeName}
                      </td>
                      <td className="py-4 px-6 text-slate-300">{sub.surname}</td>
                      <td className="py-4 px-6 font-mono text-slate-300">{sub.phoneNumber}</td>
                      <td className="py-4 px-6">
                        <div className="flex flex-col items-center gap-2">
                          <div
                            className="w-12 h-12 rounded-lg overflow-hidden border border-slate-800 cursor-pointer hover:border-amber-500/50 transition-colors"
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
                            className="text-[10px] text-amber-500 hover:underline font-semibold"
                          >
                            Download
                          </button>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        {sub.paymentScreenshot ? (
                          <div className="flex flex-col items-center gap-2">
                            <div
                              className="w-12 h-12 rounded-lg overflow-hidden border border-slate-800 cursor-pointer hover:border-amber-500/50 transition-colors"
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
                              className="text-[10px] text-amber-500 hover:underline font-semibold"
                            >
                              Download
                            </button>
                            <div className="text-[9px] text-slate-400 mt-1 max-w-[100px] truncate text-center" title={sub.payeeNameFromReceipt}>
                              To: <span className="font-semibold text-slate-300">{sub.payeeNameFromReceipt || 'Not detected'}</span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-500">None</span>
                        )}
                      </td>
                      <td className="py-4 px-6 flex flex-col gap-1 items-start">
                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase ${isApproved ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400' :
                          isRejected ? 'bg-red-500/15 border border-red-500/30 text-red-400' :
                            isRefunded ? 'bg-purple-500/15 border border-purple-500/30 text-purple-400' :
                              isInquiry ? 'bg-blue-500/15 border border-blue-500/30 text-blue-400' :
                                'bg-amber-500/15 border border-amber-500/30 text-amber-400'
                          }`}>
                          {sub.status ? sub.status : 'pending'}
                        </span>
                        {isRefunded && sub.refundReason && (
                          <span className="text-[10px] text-purple-300 italic max-w-[120px] truncate block" title={sub.refundReason}>
                            Reason: {sub.refundReason}
                          </span>
                        )}
                        {isRejected && sub.rejectionReason && (
                          <span className="text-[10px] text-red-300 italic max-w-[120px] truncate block" title={sub.rejectionReason}>
                            Reason: {sub.rejectionReason}
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-xs text-slate-500 font-mono">
                        {new Date(sub.createdAt).toLocaleString()}
                      </td>
                      <td className="py-4 px-6 space-y-2">
                        {isPending && (
                          <div className="flex flex-col gap-2">
                            <button
                              onClick={() => handleApproveSubmission(sub.inquiryId)}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition-all"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleRejectSubmission(sub.inquiryId)}
                              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg text-xs transition-all"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                        {isInquiry && (
                          <div className="flex flex-col gap-2">
                            <a
                              href={`https://wa.me/${waPhone}?text=${encodeURIComponent(
                                `નમસ્તે ${sub.husbandName} & ${sub.wifeName}, તમે જે પ્રોગ્રામ (${sub.programName}) માટે ઇન્ક્વાયરી રજીસ્ટર કરી હતી તેની તારીખ નક્કી થઈ ગઈ છે.\n\nનક્કી થયેલ તારીખ: ${sub.programDate}\n\nકૃપા કરીને તમારી લિંક પર જઈને પેમેન્ટ કરી તમારી સીટ કન્ફર્મ કરો: ${typeof window !== 'undefined' ? window.location.origin.replace('localhost', '127.0.0.1') : ''}/pass/${sub.inquiryId}`
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-block px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs transition-all text-center"
                            >
                              💬 Request Pay
                            </a>
                            <button
                              onClick={() => handleRejectSubmission(sub.inquiryId)}
                              className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white font-semibold rounded-lg text-xs transition-all"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                        {isApproved && (() => {
                          const isSent = sentPassIds.includes(sub.inquiryId);
                          return (
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
                                ? 'bg-slate-800 hover:bg-slate-750 text-slate-400 border border-slate-700'
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                }`}
                            >
                              {isSent ? '💬 Sent' : '💬 Send Pass'}
                            </a>
                          );
                        })()}
                        {isRejected && (
                          <div className="flex flex-col gap-2">
                            <span className="text-xs text-red-500 block max-w-[120px] break-words font-bold">
                              Rejected
                            </span>
                            {sub.rejectionReason && (
                              <span className="text-[10px] text-red-400/80 block max-w-[120px] break-words bg-red-950/20 border border-red-950/30 p-1.5 rounded-md italic">
                                {sub.rejectionReason}
                              </span>
                            )}
                            <button
                              onClick={() => handleApproveSubmission(sub.inquiryId)}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition-all text-center"
                            >
                              Approve
                            </button>
                          </div>
                        )}
                        <div className="pt-2 border-t border-slate-800/40 flex flex-col gap-1.5">
                          <button
                            onClick={() => startEditing(sub)}
                            className="w-full px-3 py-1 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 font-bold rounded-lg text-[10px] transition-all"
                          >
                            ✏️ Edit
                          </button>
                          <button
                            onClick={() => handleDeleteSubmission(sub.inquiryId)}
                            className="w-full px-3 py-1 bg-red-950/20 hover:bg-red-900/30 border border-red-900/30 text-red-400 hover:text-red-300 font-bold rounded-lg text-[10px] transition-all"
                          >
                            🗑️ Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalSubmissions > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 p-4 bg-slate-950/20 border border-slate-800/80 rounded-2xl">
              <span className="text-xs text-slate-400 font-medium">
                Showing <span className="text-amber-500 font-bold">{totalSubmissions === 0 ? 0 : (currentPage - 1) * 10 + 1}</span> to{' '}
                <span className="text-amber-500 font-bold">{Math.min(currentPage * 10, totalSubmissions)}</span> of{' '}
                <span className="text-amber-500 font-bold">{totalSubmissions}</span> registrations
              </span>
              {totalPages > 1 && (
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <button
                      disabled={currentPage <= 1 || loading}
                      onClick={() => fetchSubmissions({ page: currentPage - 1 })}
                      className="px-4 py-2 border border-slate-800 hover:border-amber-500/30 hover:bg-slate-900/60 disabled:opacity-40 disabled:hover:border-slate-800 disabled:hover:bg-transparent text-slate-300 font-bold rounded-xl text-xs transition-all active:scale-[0.98]"
                    >
                      ◀ Previous
                    </button>
                    <span className="text-xs text-slate-300 font-semibold px-3 bg-slate-900 border border-slate-800/80 rounded-lg py-1.5 min-w-[80px] text-center">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      disabled={currentPage >= totalPages || loading}
                      onClick={() => fetchSubmissions({ page: currentPage + 1 })}
                      className="px-4 py-2 border border-slate-800 hover:border-amber-500/30 hover:bg-slate-900/60 disabled:opacity-40 disabled:hover:border-slate-800 disabled:hover:bg-transparent text-slate-300 font-bold rounded-xl text-xs transition-all active:scale-[0.98]"
                    >
                      Next ▶
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-400">Go to:</span>
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
                            fetchSubmissions({ page });
                          }
                        }
                      }}
                      className="w-14 px-2 py-1 bg-slate-900 border border-slate-800 text-slate-300 text-xs rounded-lg focus:outline-none focus:border-amber-500 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <button
                      onClick={() => {
                        const page = parseInt(goToPageInput, 10);
                        if (page >= 1 && page <= totalPages) {
                          fetchSubmissions({ page });
                        }
                      }}
                      className="px-2.5 py-1 bg-slate-900 border border-slate-800 hover:border-amber-500/30 text-slate-300 font-bold rounded-lg text-xs transition-all active:scale-[0.98]"
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
              <div className="text-center py-20 text-slate-400">Loading duplicate inquiries...</div>
            ) : duplicateGroups.length === 0 ? (
              <div className="text-center py-20 text-slate-400 border border-dashed border-slate-800 rounded-2xl">
                No duplicate inquiries found. (કોઈ ડુપ્લિકેટ ઇન્ક્વાયરી મળી નથી)
              </div>
            ) : (
              <>
                {/* Global Bulk Action Bar */}
                <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-950/40 border border-slate-800/80 rounded-2xl p-4">
                  <div className="text-xs md:text-sm font-semibold text-slate-350 flex items-center gap-2">
                    <span>✅</span>
                    <span>{selectedInquiryIds.length} submissions selected.</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {selectedInquiryIds.length > 0 && (
                      <button
                        onClick={handleBulkDeleteSubmissions}
                        className="px-4 py-2 bg-red-650 hover:bg-red-750 text-white font-bold rounded-xl text-xs transition-all active:scale-[0.98] shadow-lg shadow-red-500/10 cursor-pointer"
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
                      className="px-3 py-2 border border-slate-800 hover:bg-slate-900/60 text-slate-350 font-semibold rounded-xl text-xs transition-all active:scale-[0.98] cursor-pointer"
                    >
                      {selectedInquiryIds.length === duplicateGroups.flatMap(g => g.submissions.map(s => s.inquiryId)).length ? 'Deselect All' : 'Select All Duplicates'}
                    </button>
                  </div>
                </div>

                {duplicateGroups.map((group) => (
                  <div key={group.id} className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-6 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
                      <div className="flex items-center gap-2.5">
                        <span className="text-xl">⚠️</span>
                        <div>
                          <h3 className="font-bold text-slate-200 text-base">{group.label}</h3>
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
                          className="px-2.5 py-1.5 border border-slate-800 hover:bg-slate-900/60 text-slate-350 font-semibold rounded-xl text-xs transition-all active:scale-[0.98] cursor-pointer"
                        >
                          {group.submissions.map(s => s.inquiryId).every(id => selectedInquiryIds.includes(id)) ? 'Deselect Group' : 'Select Group'}
                        </button>
                        <span className="px-3 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-full text-xs font-bold uppercase tracking-wider">
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
                          <div key={sub.inquiryId} className={`border rounded-xl p-5 flex flex-col justify-between hover:border-slate-700/80 transition-all space-y-4 relative ${isSelected ? 'border-amber-500/40 bg-amber-500/[0.02]' : 'border-slate-800/80 bg-slate-900/40'}`}>
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
                                className="w-4.5 h-4.5 text-amber-500 bg-slate-950 border-slate-800 rounded focus:ring-amber-500 focus:ring-offset-slate-900 cursor-pointer"
                              />
                            </div>

                          <div className="space-y-3">
                            <div className="flex justify-between items-start gap-2 pr-8">
                              <div>
                                <span className="font-mono text-[10px] text-slate-500">Token ID</span>
                                <div className="font-mono text-sm text-amber-500 font-bold">{sub.inquiryId}</div>
                              </div>
                              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${isApproved ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : isRejected ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-400'}`}>
                                {sub.status || 'pending'}
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-3 text-xs border-t border-b border-slate-800/40 py-2.5">
                              <div>
                                <span className="text-slate-500 block uppercase text-[9px] tracking-wider font-semibold">Couple Names</span>
                                <span className="text-slate-200 font-semibold">{sub.husbandName} & {sub.wifeName}</span>
                              </div>
                              <div>
                                <span className="text-slate-500 block uppercase text-[9px] tracking-wider font-semibold">Surname</span>
                                <span className="text-slate-200 font-semibold">{sub.surname}</span>
                              </div>
                              <div>
                                <span className="text-slate-500 block uppercase text-[9px] tracking-wider font-semibold">Phone</span>
                                <span className="text-slate-200 font-mono">{sub.phoneNumber}</span>
                              </div>
                              <div>
                                <span className="text-slate-500 block uppercase text-[9px] tracking-wider font-semibold">Program Slot</span>
                                <span className="text-slate-200 font-semibold truncate block" title={sub.programName}>{sub.programName || 'N/A'}</span>
                                <span className="text-[10px] text-slate-500 block">{sub.programDate}</span>
                              </div>
                            </div>

                            <div className="flex gap-4">
                              <div className="flex-1 flex flex-col items-center gap-1.5">
                                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Couple Photo</span>
                                <div 
                                  className="w-full h-24 rounded-lg overflow-hidden border border-slate-800 cursor-pointer hover:border-amber-500/30 transition-all bg-slate-950/60 flex items-center justify-center"
                                  onClick={() => setSelectedImage(sub.couplePhoto)}
                                >
                                  {sub.couplePhoto ? (
                                    <img 
                                      src={(sub.couplePhoto.startsWith('data:') || sub.couplePhoto.startsWith('http://') || sub.couplePhoto.startsWith('https://')) ? sub.couplePhoto : `${API_BASE_URL}${sub.couplePhoto}`}
                                      alt="Couple" 
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <span className="text-slate-605 text-xs">No Photo</span>
                                  )}
                                </div>
                              </div>
                              <div className="flex-1 flex flex-col items-center gap-1.5">
                                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Payment Proof</span>
                                <div 
                                  className="w-full h-24 rounded-lg overflow-hidden border border-slate-800 cursor-pointer hover:border-amber-500/30 transition-all bg-slate-950/60 flex items-center justify-center relative"
                                  onClick={() => sub.paymentScreenshot && setSelectedImage(sub.paymentScreenshot)}
                                >
                                  {sub.paymentScreenshot ? (
                                    <img 
                                      src={(sub.paymentScreenshot.startsWith('data:') || sub.paymentScreenshot.startsWith('http://') || sub.paymentScreenshot.startsWith('https://')) ? sub.paymentScreenshot : `${API_BASE_URL}${sub.paymentScreenshot}`}
                                      alt="Payment Proof" 
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <span className="text-slate-605 text-xs">No Proof</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="pt-4 border-t border-slate-800/80 flex flex-wrap gap-2">
                            {isPending && (
                              <button
                                onClick={() => handleApproveSubmission(sub.inquiryId)}
                                className="flex-1 min-w-[70px] px-2.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-all active:scale-[0.98]"
                              >
                                Approve
                              </button>
                            )}
                            {isPending && (
                              <button
                                onClick={() => handleRejectSubmission(sub.inquiryId)}
                                className="flex-1 min-w-[70px] px-2.5 py-2 bg-red-950/30 hover:bg-red-900/30 border border-red-900/40 text-red-400 font-bold rounded-xl text-xs transition-all active:scale-[0.98]"
                              >
                                Reject
                              </button>
                            )}
                            <button
                              onClick={() => startEditing(sub)}
                              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl text-xs transition-all active:scale-[0.98]"
                            >
                              ✏️ Edit
                            </button>
                            <button
                              onClick={() => handleDeleteSubmission(sub.inquiryId)}
                              className="px-3 py-2 bg-red-950/20 hover:bg-red-900/30 border border-red-950 text-red-400 font-semibold rounded-xl text-xs transition-all active:scale-[0.98]"
                            >
                              🗑️ Delete
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                ))
              }
            </>
          )}
          </div>
        )}
    </div>
    </div>
  );
}
