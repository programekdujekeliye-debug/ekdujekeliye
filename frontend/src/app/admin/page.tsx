'use client';

import React, { useEffect, useState } from 'react';
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
  payeeNameFromReceipt?: string;
  photoZoom?: number;
  photoOffsetY?: number;
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
  cardTemplate?: string;
  heartX?: number;
  heartY?: number;
  heartWidth?: number;
  heartHeight?: number;
  photoZoom?: number;
  photoOffsetY?: number;
}

export default function AdminDashboard() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Security States
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [role, setRole] = useState<'admin' | 'superadmin' | null>(null);

  // Programs Management States
  const [programs, setPrograms] = useState<Program[]>([]);
  const [newProgramName, setNewProgramName] = useState('');
  const [newProgramDate, setNewProgramDate] = useState('');
  const [newProgramCapacity, setNewProgramCapacity] = useState<number | ''>('');
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
  const [zipProgress, setZipProgress] = useState('');
  const [sentPassIds, setSentPassIds] = useState<string[]>([]);

  // Editing States
  const [editingProgram, setEditingProgram] = useState<Program | null>(null);
  const [editProgramName, setEditProgramName] = useState('');
  const [editProgramDate, setEditProgramDate] = useState('');
  const [editProgramCapacity, setEditProgramCapacity] = useState<number | ''>('');
  const [editProgramCardTemplate, setEditProgramCardTemplate] = useState<string | null>(null);
  const [editProgramHeartX, setEditProgramHeartX] = useState<number>(144);
  const [editProgramHeartY, setEditProgramHeartY] = useState<number>(112);
  const [editProgramHeartWidth, setEditProgramHeartWidth] = useState<number>(288);
  const [editProgramHeartHeight, setEditProgramHeartHeight] = useState<number>(260);
  const [editProgramPhotoZoom, setEditProgramPhotoZoom] = useState<number>(1.0);
  const [editProgramPhotoOffsetY, setEditProgramPhotoOffsetY] = useState<number>(0);
  const [editProgramError, setEditProgramError] = useState('');
  const [editProgramSuccess, setEditProgramSuccess] = useState('');

  // Bulk Review States
  const [reviewingProgramForFrames, setReviewingProgramForFrames] = useState<Program | null>(null);

  const updateSubmissionCoordInState = (inquiryId: string, field: 'photoZoom' | 'photoOffsetY', value: number) => {
    setSubmissions(prev => prev.map(sub => {
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
  // Payment Settings States
  const [upiId, setUpiId] = useState('');
  const [payeeName, setPayeeName] = useState('');
  const [amount, setAmount] = useState('');
  const [settingsSuccess, setSettingsSuccess] = useState('');
  const [settingsError, setSettingsError] = useState('');

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

  const fetchSettings = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/settings`);
      if (res.ok) {
        const data = await res.json();
        setUpiId(data.upiId);
        setPayeeName(data.payeeName);
        setAmount(data.amount);
      }
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    }
  };

  const fetchSubmissions = async (passVal?: string, showSpinner = true) => {
    const activePassword = passVal || password || sessionStorage.getItem('adminPassword') || '';
    if (!activePassword) {
      setLoading(false);
      return;
    }
    try {
      if (showSpinner) setLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/submissions`, {
        headers: {
          'Authorization': activePassword
        }
      });
      if (res.ok) {
        const data = await res.json();
        setSubmissions(data);
        setIsAuthenticated(true);
        sessionStorage.setItem('adminPassword', activePassword);
        setError('');
        fetchPrograms();
        fetchSettings();
        fetchDbStats(activePassword);

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

  const handleCreateProgram = async (e: React.FormEvent) => {
    e.preventDefault();
    const activePassword = password || sessionStorage.getItem('adminPassword') || '';
    if (!newProgramName || !newProgramDate || !newProgramCapacity) {
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
    if (!editProgramName || !editProgramDate || !editProgramCapacity) {
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
        body: JSON.stringify({ upiId, payeeName, amount })
      });
      if (res.ok) {
        setSettingsSuccess('Payment settings updated successfully.');
      } else {
        const data = await res.json();
        setSettingsError(data.error || 'Failed to update settings.');
      }
    } catch (err) {
      setSettingsError('Network error updating settings.');
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
        fetchSubmissions(undefined, false);
      } else {
        alert('Failed to approve submission.');
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
        fetchSubmissions(undefined, false);
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
        fetchSubmissions(undefined, false);
        fetchPrograms();
      } else {
        const errData = await res.json();
        alert(errData.error || 'Failed to delete submission.');
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
        fetchSubmissions(undefined, false);
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
    setEditCouplePhoto(null);
    setEditPaymentScreenshot(null);
    setEditError('');
  };


  useEffect(() => {
    const savedPassword = sessionStorage.getItem('adminPassword');
    if (savedPassword) {
      fetchSubmissions(savedPassword);
    } else {
      setLoading(false);
      fetchSettings();
    }
  }, []);

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
        ctx.fillStyle = 'rgba(26, 6, 6, 0.95)';
        ctx.strokeStyle = '#D4AF37';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(385, 230, 176, 135, 8);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#D4AF37';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('COUPLE ENTRY', 385 + 176 / 2, 230 + 20);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 13px sans-serif';
        ctx.fillText('HUSBAND NAME', 385 + 176 / 2, 230 + 45);
        ctx.fillText('& WIFE NAME', 385 + 176 / 2, 230 + 65);
        ctx.fillText('SURNAME', 385 + 176 / 2, 230 + 85);

        ctx.strokeStyle = 'rgba(212, 175, 55, 0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(385 + 15, 230 + 98);
        ctx.lineTo(385 + 176 - 15, 230 + 98);
        ctx.stroke();

        ctx.fillStyle = '#D4AF37';
        ctx.font = 'bold 12px monospace';
        ctx.fillText('CPL-SAMPLE', 385 + 176 / 2, 230 + 118);
        ctx.restore();
      };
      coupleImg.onerror = () => {
        // Draw template anyway if couple photo fails to load
        ctx.drawImage(tempCanvas, 0, 0);

        ctx.save();
        ctx.fillStyle = 'rgba(26, 6, 6, 0.95)';
        ctx.strokeStyle = '#D4AF37';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(385, 230, 176, 135, 8);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#D4AF37';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('COUPLE ENTRY', 385 + 176 / 2, 230 + 20);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 13px sans-serif';
        ctx.fillText('HUSBAND NAME', 385 + 176 / 2, 230 + 45);
        ctx.fillText('& WIFE NAME', 385 + 176 / 2, 230 + 65);
        ctx.fillText('SURNAME', 385 + 176 / 2, 230 + 85);

        ctx.strokeStyle = 'rgba(212, 175, 55, 0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(385 + 15, 230 + 98);
        ctx.lineTo(385 + 176 - 15, 230 + 98);
        ctx.stroke();

        ctx.fillStyle = '#D4AF37';
        ctx.font = 'bold 12px monospace';
        ctx.fillText('CPL-SAMPLE', 385 + 176 / 2, 230 + 118);
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
    fetchSubmissions(password);
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
        fetchSubmissions();
      } else {
        alert('Failed to clear data.');
      }
    } catch (err) {
      alert('Network error.');
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

  // Live Frame Previews in Review Modal
  useEffect(() => {
    if (!reviewingProgramForFrames) return;

    const frameImg = new Image();
    frameImg.crossOrigin = 'anonymous';
    frameImg.onload = () => {
      const progSubmissions = submissions.filter(sub => sub.programId === reviewingProgramForFrames.id && sub.couplePhoto && sub.status === 'approved');

      progSubmissions.forEach(sub => {
        const canvas = document.getElementById(`review-canvas-${sub.inquiryId}`) as HTMLCanvasElement;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = 384; 
        canvas.height = 512; 

        const coupleImg = new Image();
        coupleImg.crossOrigin = 'anonymous';
        coupleImg.onload = () => {
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
          ctx.save();
          ctx.beginPath();
          ctx.rect(startX, startY, drawWidth, drawHeight);
          ctx.clip();
          ctx.drawImage(coupleImg, startX + ox, startY + oy, w, h);
          ctx.restore();

          // Draw frame over it
          ctx.drawImage(frameImg, 0, 0, canvas.width, canvas.height);

          // Draw inquiryId below the logo
          ctx.save();
          ctx.fillStyle = '#7a0c0c';
          ctx.font = 'bold 11px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(sub.inquiryId, canvas.width / 2, canvas.height * 0.95);
          ctx.restore();
        };
        coupleImg.src = sub.couplePhoto.startsWith('data:') ? sub.couplePhoto : `${API_BASE_URL}${sub.couplePhoto}`;
      });
    };
    frameImg.src = '/frame_template.png';
  }, [reviewingProgramForFrames, submissions]);

  const handleDownloadFramedZip = async (specificProg?: Program) => {
    const prog = specificProg || programs.find(p => p.id === selectedProgramIdForFrames);
    if (!prog) return;

    const progSubmissions = submissions.filter(sub => sub.programId === prog.id && sub.couplePhoto && sub.status === 'approved');
    if (progSubmissions.length === 0) {
      alert('No approved registrations with couple photos found for this program.');
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
          const coupleImg = await loadImage(sub.couplePhoto.startsWith('data:') ? sub.couplePhoto : `${API_BASE_URL}${sub.couplePhoto}`);

          // Clear canvas
          ctx.clearRect(0, 0, canvas.width, canvas.height);

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

          // Add to zip
          const filename = `${sub.surname}_${sub.husbandName}_${sub.wifeName}_${sub.inquiryId}.png`;
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

  const handleSaveAndDownloadZip = async () => {
    if (!reviewingProgramForFrames) return;
    const activePassword = password || sessionStorage.getItem('adminPassword') || '';
    const progSubmissions = submissions.filter(sub => sub.programId === reviewingProgramForFrames.id && sub.couplePhoto && sub.status === 'approved');

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
      const response = await fetch(`${API_BASE_URL}${imagePath}`);
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
      window.open(imagePath.startsWith('data:') ? imagePath : `${API_BASE_URL}${imagePath}`, '_blank');
    }
  };

  const filteredSubmissions = submissions.filter((sub) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      sub.inquiryId.toLowerCase().includes(searchLower) ||
      sub.husbandName.toLowerCase().includes(searchLower) ||
      sub.wifeName.toLowerCase().includes(searchLower) ||
      sub.surname.toLowerCase().includes(searchLower) ||
      sub.phoneNumber.includes(searchLower)
    );
  });

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
                  <div className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-400 text-xs font-semibold capitalize">
                    {editingSubmission.status}
                  </div>
                </div>
              </div>

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
                  required
                  value={editProgramDate}
                  onChange={(e) => setEditProgramDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-amber-500 transition-colors"
                />
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
              {submissions.filter(sub => sub.programId === reviewingProgramForFrames.id && sub.couplePhoto && sub.status === 'approved').length === 0 ? (
                <p className="text-center text-slate-500 text-sm py-12">No approved couple registrations with photos found in this program slot.</p>
              ) : (
                submissions.filter(sub => sub.programId === reviewingProgramForFrames.id && sub.couplePhoto && sub.status === 'approved').map((sub) => (
                  <div key={sub.inquiryId} className="flex flex-col sm:flex-row items-center gap-6 bg-slate-900/40 border border-slate-850 rounded-2xl p-4 shadow-sm">
                    {/* Live Preview canvas */}
                    <div className="w-[120px] h-[160px] overflow-hidden rounded-xl border border-slate-800 bg-slate-950 flex items-center justify-center flex-shrink-0">
                      <canvas
                        id={`review-canvas-${sub.inquiryId}`}
                        style={{ width: '120px', height: '160px' }}
                        className="bg-slate-950 shadow-inner"
                      />
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
                  disabled={zipping || submissions.filter(sub => sub.programId === reviewingProgramForFrames.id && sub.couplePhoto && sub.status === 'approved').length === 0}
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

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="p-6 bg-slate-950/60 border border-slate-800/80 rounded-2xl backdrop-blur-md">
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider block">Total Inquiries</span>
            <span className="text-4xl font-extrabold text-slate-100 mt-2 block">{submissions.length}</span>
          </div>
          <div className="p-6 bg-slate-950/60 border border-slate-800/80 rounded-2xl backdrop-blur-md">
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider block">Latest Token ID</span>
            <span className="text-4xl font-extrabold text-amber-500 mt-2 block">
              {submissions.length > 0 ? submissions[submissions.length - 1].inquiryId : 'N/A'}
            </span>
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
                  required
                  value={newProgramDate}
                  onChange={(e) => setNewProgramDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-amber-500 transition-colors"
                />
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
                          <span>👥 Booked Couples: <strong className={isSoldOut ? "text-red-400" : "text-amber-500"}>{Math.floor(prog.bookingsCount / 2)}</strong> / {Math.floor(prog.capacity / 2)}</span>
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

          <form onSubmit={handleUpdateSettings} className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">UPI ID</label>
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

            <div className="flex gap-4">
              <div className="flex-grow">
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
              <button
                type="submit"
                className="px-6 py-2 bg-amber-500 hover:bg-amber-600 active:scale-[0.99] text-slate-950 font-bold rounded-xl text-sm transition-all h-[38px] self-end"
              >
                Save Settings
              </button>
            </div>
          </form>
        </div>

        {/* Frame Download Option Section */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-6 space-y-6">
          <div>
            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <span>🖼️</span> Frame Download Option
            </h2>
            <p className="text-slate-400 text-xs mt-1">Select a program to view registrations and batch download all couple photos pre-rendered inside the custom frame.</p>
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
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-slate-900/40 border border-slate-800/80 rounded-xl">
              <div>
                <p className="text-sm font-semibold text-slate-200">
                  Total Approved Couples with Photo: <span className="text-amber-500 font-bold">{submissions.filter(sub => sub.programId === selectedProgramIdForFrames && sub.couplePhoto && sub.status === 'approved').length}</span>
                </p>
                <p className="text-xs text-slate-500 mt-1">Review registrations line by line, slide to adjust their photo zoom/position, and download all framed photos in a single ZIP file.</p>
              </div>
              <button
                onClick={() => {
                  const prog = programs.find(p => p.id === selectedProgramIdForFrames);
                  if (prog) setReviewingProgramForFrames(prog);
                }}
                disabled={zipping}
                className="w-full sm:w-auto px-5 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-bold rounded-xl text-sm transition-all shadow-lg shadow-amber-500/20 text-center"
              >
                {zipping ? `Processing (${zipProgress})` : 'Review & Download ZIP'}
              </button>
            </div>
          )}
        </div>

        {/* Filters and Search */}
        <div className="flex items-center bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 gap-3">
          <span className="text-slate-500 pl-2">🔍</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by token, names, surname, or phone..."
            className="w-full bg-transparent border-none text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-0 text-sm py-1"
          />
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
                  const isPending = !isApproved && !isRejected;

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
                              src={sub.couplePhoto.startsWith('data:') ? sub.couplePhoto : `${API_BASE_URL}${sub.couplePhoto}`}
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
                                src={sub.paymentScreenshot.startsWith('data:') ? sub.paymentScreenshot : `${API_BASE_URL}${sub.paymentScreenshot}`}
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
                      <td className="py-4 px-6">
                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase ${isApproved ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400' :
                          isRejected ? 'bg-red-500/15 border border-red-500/30 text-red-400' :
                            'bg-amber-500/15 border border-amber-500/30 text-amber-400'
                          }`}>
                          {sub.status ? sub.status : 'pending'}
                        </span>
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
                        {isApproved && (() => {
                          const isSent = sentPassIds.includes(sub.inquiryId);
                          return (
                            <a
                              href={`https://wa.me/${waPhone}?text=${encodeURIComponent(`Hello! Your payment has been verified. You can view and download your pass here: ${typeof window !== 'undefined' ? window.location.origin : 'https://ekdujekeliye.vercel.app'}/pass/${sub.inquiryId}`)}`}
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
                          <span className="text-xs text-red-500 block max-w-[120px] break-words">
                            Rejected
                          </span>
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
        )}
      </div>
    </div>
  );
}
