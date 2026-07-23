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

interface Program {
  id: string;
  name: string;
  date: string;
  capacity: number;
  bookingsCount: number;
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
  const [programError, setProgramError] = useState('');
  const [programSuccess, setProgramSuccess] = useState('');
  // Frame Zipping states
  const [selectedProgramIdForFrames, setSelectedProgramIdForFrames] = useState<string>('');
  const [zipping, setZipping] = useState(false);
  const [zipProgress, setZipProgress] = useState('');
  const [sentPassIds, setSentPassIds] = useState<string[]>([]);

  // Editing States
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
          capacity: Number(newProgramCapacity)
        })
      });
      if (res.ok) {
        setProgramSuccess('Program created successfully.');
        setProgramError('');
        setNewProgramName('');
        setNewProgramDate('');
        setNewProgramCapacity('');
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

  const handleDownloadFramedZip = async () => {
    const prog = programs.find(p => p.id === selectedProgramIdForFrames);
    if (!prog) return;

    const progSubmissions = submissions.filter(sub => sub.programId === selectedProgramIdForFrames && sub.couplePhoto);
    if (progSubmissions.length === 0) {
      alert('No registrations with couple photos found for this program.');
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

          // Convert canvas to blob
          const dataUrl = canvas.toDataURL('image/png');
          const base64Data = dataUrl.split(',')[1];

          // Add to zip
          const filename = `${sub.surname}_${sub.husbandName}_${sub.wifeName}_${sub.inquiryId}.png`;
          zip.file(filename, base64Data, { base64: true });
        } catch (err) {
          console.error(`Failed to process ${sub.inquiryId}:`, err);
        }
      }

      setZipProgress('Generating ZIP file...');
      const content = await zip.generateAsync({ type: 'blob' });

      setZipProgress('Downloading...');
      const url = window.URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${prog.name}_framed_photos.zip`.replace(/\s+/g, '_');
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      setZipProgress('Done!');
      setTimeout(() => {
        setZipping(false);
        setZipProgress('');
      }, 2000);
    } catch (error: any) {
      alert('Error creating zip: ' + error.message);
      setZipping(false);
      setZipProgress('');
    }
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
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Wife Name</label>
                  <input
                    type="text"
                    required
                    value={editWifeName}
                    onChange={(e) => setEditWifeName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Surname</label>
                  <input
                    type="text"
                    required
                    value={editSurname}
                    onChange={(e) => setEditSurname(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Phone Number</label>
                  <input
                    type="text"
                    required
                    value={editPhoneNumber}
                    onChange={(e) => setEditPhoneNumber(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Select Program Slot</label>
                <select
                  required
                  value={editProgramId}
                  onChange={(e) => setEditProgramId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-amber-500"
                >
                  <option value="">Choose an available slot</option>
                  {programs.map((prog) => (
                    <option key={prog.id} value={prog.id}>
                      {prog.name} ({prog.date})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Replace Couple Photo</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setEditCouplePhoto(e.target.files[0]);
                      }
                    }}
                    className="w-full text-xs text-slate-400 file:mr-2 file:py-1 file:px-2 file:rounded-lg file:border-0 file:text-[10px] file:font-semibold file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700 cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Replace Payment Receipt</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setEditPaymentScreenshot(e.target.files[0]);
                      }
                    }}
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                        <div className="text-xs text-slate-400 flex items-center gap-4">
                          <span>{prog.date}</span>
                          <span>👥 Booked Couples: <strong className={isSoldOut ? "text-red-400" : "text-amber-500"}>{Math.floor(prog.bookingsCount / 2)}</strong> / {Math.floor(prog.capacity / 2)}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteProgram(prog.id)}
                        className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-xs font-semibold transition-all border border-red-500/20"
                      >
                        Delete
                      </button>
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
                  Total Couples with Photo: <span className="text-amber-500 font-bold">{submissions.filter(sub => sub.programId === selectedProgramIdForFrames && sub.couplePhoto).length}</span>
                </p>
                <p className="text-xs text-slate-500 mt-1">Batch draws all couple photos into the custom template frame and downloads them together as a ZIP archive.</p>
              </div>
              <button
                onClick={handleDownloadFramedZip}
                disabled={zipping}
                className="w-full sm:w-auto px-5 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-bold rounded-xl text-sm transition-all shadow-lg shadow-amber-500/20 text-center"
              >
                {zipping ? `Zipping (${zipProgress})` : 'Download All Framed Photos (ZIP)'}
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
                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase ${
                          isApproved ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400' :
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
                              className={`inline-block px-3 py-1.5 font-bold rounded-lg text-xs transition-all text-center ${
                                isSent 
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
