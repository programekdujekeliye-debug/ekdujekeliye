'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAdmin } from '../context/AdminContext';
import { apiClient } from '../../../services/apiClient';
import { API_BASE_URL } from '../../../config';
import { Submission } from '../../../types';
import {
  SparklesIcon,
  TicketIcon,
  CheckIcon,
  CheckCircleIcon,
  SearchIcon,
  PhoneIcon,
  ExternalLinkIcon,
  TrashIcon,
  AlertTriangleIcon,
  DownloadIcon,
  WhatsappIcon,
  MapPinIcon,
  ClockIcon,
  XIcon,
  EditIcon
} from '../../../components/Icons';
import { BatchExportModal } from '../reports/BatchExportModal';
import { getOptimizedPhotoUrl, resolveDisplayImageUrl } from '../../../utils/mediaPresets';
import { EditRegistrationModal } from '../registrations/EditRegistrationModal';
import { registrationsApi } from '../../../services/admin/registrationsApi';
import { LuxurySelect } from '../../../components/LuxurySelect';
import toast from 'react-hot-toast';

export interface VipLinkItem {
  _id: string;
  name: string;
  code: string;
  programId?: string;
  programName?: string;
  programDate?: string;
  maxSeats: number;
  usedSeats: number;
  approvedSeats: number;
  status: 'ACTIVE' | 'HOUSEFULL' | 'CLOSED';
  isDefault: boolean;
  notes?: string;
  createdAt?: string;
}

export const VipPassesPage = () => {
  const { programs, password, selectedProgramId: globalProgramId, setSelectedProgramId: setGlobalProgramId } = useAdmin();

  const [vipGuests, setVipGuests] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProgramId, setSelectedProgramId] = useState<string>(globalProgramId || 'all');
  const [attendanceFilter, setAttendanceFilter] = useState('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [editingGuest, setEditingGuest] = useState<Submission | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [approvalFilter, setApprovalFilter] = useState<'all' | 'approved' | 'pending'>('all');

  // Dynamic VIP Links state
  const [vipLinks, setVipLinks] = useState<VipLinkItem[]>([]);
  const [loadingLinks, setLoadingLinks] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showCustomLinksSection, setShowCustomLinksSection] = useState(false);
  const [editingLink, setEditingLink] = useState<VipLinkItem | null>(null);
  const [linkName, setLinkName] = useState('');
  const [linkCode, setLinkCode] = useState('');
  const [linkProgramId, setLinkProgramId] = useState('');
  const [linkMaxSeats, setLinkMaxSeats] = useState<number>(0);
  const [linkStatus, setLinkStatus] = useState<'ACTIVE' | 'HOUSEFULL' | 'CLOSED'>('ACTIVE');
  const [linkNotes, setLinkNotes] = useState('');
  const [savingLink, setSavingLink] = useState(false);
  const [togglingLinkId, setTogglingLinkId] = useState<string | null>(null);
  const [deletingLinkId, setDeletingLinkId] = useState<string | null>(null);
  const [copiedLinkCode, setCopiedLinkCode] = useState<string | null>(null);

  // Sync with global topbar event selector
  useEffect(() => {
    if (globalProgramId) {
      setSelectedProgramId(globalProgramId);
    }
  }, [globalProgramId]);

  const handleSelectProgram = (val: string) => {
    setSelectedProgramId(val);
    if (setGlobalProgramId) {
      setGlobalProgramId(val);
    }
  };

  const formatSubmissionTime = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return 'N/A';
      return d.toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return 'N/A';
    }
  };

  const getWhatsAppMessageUrl = (g: Submission) => {
    const digits = g.phoneNumber.replace(/\D/g, '').slice(-10);
    if (!digits) return '#';
    const text = `નમસ્તે ${g.husbandName} & ${g.wifeName}, એક દુજે કે લિયે સેમિનાર (${g.inquiryId}) માટે તમારો VIP પાસ તૈયાર છે.\n\nતમારો ડિજિટલ એન્ટ્રી પાસ: https://www.ekdujekeliye.in/pass/${g.inquiryId}\n\nતમારું પર્સનલાઇઝ્ડ ઇન્વિટેશન કાર્ડ: https://www.ekdujekeliye.in/invitation/${g.inquiryId}`;
    return `https://wa.me/91${digits}?text=${encodeURIComponent(text)}`;
  };

  const handleAttendance = async (inquiryId: string, attendance: 'present' | 'absent' | 'unmarked') => {
    try {
      await registrationsApi.markAttendance(inquiryId, attendance);
      setVipGuests((prev) =>
        prev.map((g) => (g.inquiryId === inquiryId ? { ...g, attendance } : g))
      );
      toast.success(`Attendance updated to ${attendance}.`);
    } catch (err: any) {
      toast.error('Failed to update attendance.');
    }
  };


  // Modal State for Issuing VIP Pass
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [husbandName, setHusbandName] = useState('');
  const [wifeName, setWifeName] = useState('');
  const [surname, setSurname] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [programId, setProgramId] = useState('');
  const [couplePhoto, setCouplePhoto] = useState<File | null>(null);
  const [couplePhotoPreview, setCouplePhotoPreview] = useState<string | null>(null);
  const [issuing, setIssuing] = useState(false);
  const [issueError, setIssueError] = useState('');
  const [issueSuccess, setIssueSuccess] = useState('');
  const [newPassUrl, setNewPassUrl] = useState('');

  // Resend WhatsApp state
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [resendStatus, setResendStatus] = useState<{ id: string; message: string; success: boolean } | null>(null);

  const fetchVipGuests = useCallback(async () => {
    try {
      setLoading(true);
      const timestamp = Date.now();
      const url = selectedProgramId && selectedProgramId !== 'all'
        ? `/api/submissions?isVip=true&programId=${selectedProgramId}&limit=500&_t=${timestamp}`
        : `/api/submissions?isVip=true&limit=500&_t=${timestamp}`;
      const res: any = await apiClient(url, { skipCache: true });
      const rawList = res?.submissions || res?.data || (Array.isArray(res) ? res : []);

      const selectedProg = programs.find((p) => p.id === selectedProgramId);
      const list = rawList.filter((g: Submission) => {
        if (!selectedProgramId || selectedProgramId === 'all') return true;
        return (
          g.programId === selectedProgramId ||
          (selectedProg?.slug && g.programId === selectedProg.slug) ||
          (selectedProg?.date && g.programDate === selectedProg.date)
        );
      });
      setVipGuests(list);
    } catch (err) {
      console.error('Failed to fetch VIP guests:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedProgramId, programs]);

  const fetchVipLinks = useCallback(async () => {
    try {
      setLoadingLinks(true);
      const res: any = await apiClient('/api/admin/vip-links?_t=' + Date.now(), { skipCache: true });
      if (res?.data && Array.isArray(res.data)) {
        setVipLinks(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch VIP links:', err);
    } finally {
      setLoadingLinks(false);
    }
  }, []);

  useEffect(() => {
    fetchVipGuests();
    fetchVipLinks();
  }, [fetchVipGuests, fetchVipLinks]);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCouplePhoto(file);
      const reader = new FileReader();
      reader.onload = () => {
        setCouplePhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleIssueSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!husbandName || !wifeName || !surname || !phoneNumber || !programId) {
      setIssueError('All fields are required.');
      return;
    }

    try {
      setIssuing(true);
      setIssueError('');
      setIssueSuccess('');
      setNewPassUrl('');

      const formData = new FormData();
      formData.append('husbandName', husbandName);
      formData.append('wifeName', wifeName);
      formData.append('surname', surname);
      formData.append('phoneNumber', phoneNumber);
      formData.append('programId', programId);
      if (couplePhoto) formData.append('couplePhoto', couplePhoto);

      const activePassword = password || sessionStorage.getItem('adminPassword') || '';
      const res = await fetch(`${API_BASE_URL}/api/submissions/manual`, {
        method: 'POST',
        headers: { Authorization: activePassword.startsWith('Bearer ') ? activePassword : `Bearer ${activePassword}` },
        body: formData
      });

      const data = await res.json();
      if (res.ok && data.data) {
        const passLink = `${window.location.origin}/pass/${data.data.inquiryId}`;
        setNewPassUrl(passLink);
        setIssueSuccess(`VIP Pass for ${husbandName} & ${wifeName} generated successfully!`);
        setHusbandName('');
        setWifeName('');
        setSurname('');
        setPhoneNumber('');
        setCouplePhoto(null);
        setCouplePhotoPreview(null);
        fetchVipGuests();
      } else {
        setIssueError(data.error || 'Failed to issue VIP pass.');
      }
    } catch (err: any) {
      setIssueError(err.message || 'Error issuing VIP pass.');
    } finally {
      setIssuing(false);
    }
  };

  const handleResendWhatsApp = async (guest: Submission) => {
    try {
      setResendingId(guest.inquiryId);
      setResendStatus(null);
      const res = await apiClient<{ success: boolean; message: string }>('/api/whatsapp/send-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientPhone: guest.phoneNumber,
          submissionId: guest._id || guest.inquiryId,
          templateKey: 'edkl_personal_invitation_24h_v2'
        })
      });

      setResendStatus({
        id: guest.inquiryId,
        message: res.message || 'VIP Pass & Invitation sent to WhatsApp!',
        success: true
      });
      toast.success(`VIP pass & invitation sent to ${guest.phoneNumber}!`);
    } catch (err: any) {
      setResendStatus({
        id: guest.inquiryId,
        message: err.message || 'Failed to send VIP pass & invitation.',
        success: false
      });
      toast.error(err.message || 'Failed to send VIP pass & invitation.');
    } finally {
      setResendingId(null);
    }
  };

  const handleDeleteVip = async (id: string, name: string) => {
    if (!id) return;
    if (!confirm(`Are you sure you want to revoke / delete VIP pass for ${name}?`)) return;
    try {
      await apiClient(`/api/submissions/${id}`, { method: 'DELETE' });
      toast.success(`VIP pass for ${name} deleted.`);
      setVipGuests((prev) => prev.filter((g) => g._id !== id && g.inquiryId !== id));
      fetchVipGuests();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete VIP pass.');
    }
  };

  const handleApproveVip = async (inquiryId: string, name: string) => {
    try {
      setApprovingId(inquiryId);
      await apiClient(`/api/submissions/${inquiryId}/approve`, {
        method: 'POST'
      });
      toast.success(`VIP Pass for ${name} approved successfully!`);
      // Optimistically update local state immediately so user sees instant approval
      setVipGuests((prev) =>
        prev.map((g) =>
          g.inquiryId === inquiryId
            ? {
                ...g,
                status: 'approved',
                payment: {
                  ...g.payment,
                  status: 'captured',
                  provider: 'manual_invite',
                  amount: 0
                }
              }
            : g
        )
      );
      fetchVipGuests();
    } catch (err: any) {
      toast.error(err.message || 'Failed to approve VIP pass.');
    } finally {
      setApprovingId(null);
    }
  };

  const handleToggleLinkStatus = async (link: VipLinkItem) => {
    try {
      setTogglingLinkId(link._id);
      const res: any = await apiClient(`/api/admin/vip-links/${link._id}/toggle`, {
        method: 'POST'
      });
      if (res?.data) {
        setVipLinks((prev) => prev.map((l) => (l._id === link._id ? res.data : l)));
        const newStatus = res.data.status;
        if (newStatus === 'HOUSEFULL') {
          toast.success(`VIP Link "${link.name}" is now marked HOUSEFULL! Registration closed.`);
        } else {
          toast.success(`VIP Link "${link.name}" is now OPEN & ACTIVE!`);
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to toggle VIP link status.');
    } finally {
      setTogglingLinkId(null);
    }
  };

  const handleDeleteLink = async (link: VipLinkItem) => {
    if (link.isDefault || link.code === 'default') {
      toast.error('The default VIP entry link cannot be deleted.');
      return;
    }
    if (!confirm(`Are you sure you want to delete VIP link "${link.name}" (${link.code})? Any visitor using this link will see page closed.`)) {
      return;
    }
    try {
      setDeletingLinkId(link._id);
      await apiClient(`/api/admin/vip-links/${link._id}`, { method: 'DELETE' });
      setVipLinks((prev) => prev.filter((l) => l._id !== link._id));
      toast.success(`VIP link "${link.name}" deleted.`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete VIP link.');
    } finally {
      setDeletingLinkId(null);
    }
  };

  const handleOpenCreateLinkModal = () => {
    setEditingLink(null);
    setLinkName('');
    setLinkCode('');
    setLinkProgramId(selectedProgramId && selectedProgramId !== 'all' ? selectedProgramId : (programs[0]?.id || ''));
    setLinkMaxSeats(0);
    setLinkStatus('ACTIVE');
    setLinkNotes('');
    setShowLinkModal(true);
  };

  const handleOpenEditLinkModal = (link: VipLinkItem) => {
    setEditingLink(link);
    setLinkName(link.name);
    setLinkCode(link.code);
    setLinkProgramId(link.programId || (programs[0]?.id || ''));
    setLinkMaxSeats(link.maxSeats || 0);
    setLinkStatus(link.status || 'ACTIVE');
    setLinkNotes(link.notes || '');
    setShowLinkModal(true);
  };

  const handleSaveLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkName.trim() || !linkCode.trim()) {
      toast.error('Link name and code are required.');
      return;
    }
    try {
      setSavingLink(true);
      const selectedProg = programs.find((p) => p.id === linkProgramId);
      const payload = {
        name: linkName.trim(),
        code: linkCode.trim().toLowerCase().replace(/[^a-z0-9_-]/g, ''),
        programId: linkProgramId || undefined,
        programName: selectedProg?.name || undefined,
        programDate: selectedProg?.date || undefined,
        maxSeats: Number(linkMaxSeats) || 0,
        status: linkStatus,
        notes: linkNotes.trim()
      };

      if (editingLink) {
        const res: any = await apiClient(`/api/admin/vip-links/${editingLink._id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res?.data) {
          setVipLinks((prev) => prev.map((l) => (l._id === editingLink._id ? res.data : l)));
          toast.success(`VIP link "${res.data.name}" updated!`);
        }
      } else {
        const res: any = await apiClient('/api/admin/vip-links', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res?.data) {
          setVipLinks((prev) => [res.data, ...prev]);
          toast.success(`New VIP link "${res.data.name}" created!`);
        }
      }
      setShowLinkModal(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save VIP link.');
    } finally {
      setSavingLink(false);
    }
  };

  const handleCopySpecificLink = (code: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://www.ekdujekeliye.in';
    const url = code === 'default'
      ? `${origin}/vip-entry`
      : `${origin}/vip-entry?code=${encodeURIComponent(code)}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
      setCopiedLinkCode(code);
      setTimeout(() => setCopiedLinkCode(null), 2500);
      toast.success(`VIP link copied! (${url})`);
    } else {
      prompt('Copy VIP link:', url);
    }
  };

  // Filter VIP list by search, attendance, and approval status
  const filteredGuests = vipGuests.filter((g) => {
    const q = searchQuery.toLowerCase();
    const matchSearch =
      !q ||
      g.inquiryId?.toLowerCase().includes(q) ||
      g.husbandName?.toLowerCase().includes(q) ||
      g.wifeName?.toLowerCase().includes(q) ||
      g.surname?.toLowerCase().includes(q) ||
      g.phoneNumber?.includes(q);

    const matchAttendance =
      attendanceFilter === 'all' ||
      (attendanceFilter === 'unmarked' && (!g.attendance || g.attendance === 'unmarked')) ||
      g.attendance === attendanceFilter;

    const matchApproval =
      approvalFilter === 'all' ||
      (approvalFilter === 'approved' && g.status !== 'pending') ||
      (approvalFilter === 'pending' && g.status === 'pending');

    return matchSearch && matchAttendance && matchApproval;
  });

  const totalVipCount = vipGuests.length;
  const pendingApprovalCount = vipGuests.filter((g) => g.status === 'pending').length;
  const approvedVipCount = totalVipCount - pendingApprovalCount;
  const presentCount = vipGuests.filter((g) => g.attendance === 'present').length;
  const pendingCheckinCount = totalVipCount - presentCount;

  const exportVipCsv = () => {
    if (filteredGuests.length === 0) {
      toast.error('No VIP guests to export.');
      return;
    }
    const headers = ['Pass ID', 'Husband Name', 'Wife Name', 'Surname', 'Phone Number', 'Event Slot', 'Attendance', 'Pass URL'];
    const rows = filteredGuests.map((g) => [
      g.inquiryId,
      `"${g.husbandName}"`,
      `"${g.wifeName}"`,
      `"${g.surname}"`,
      `'${g.phoneNumber}`,
      `"${g.programName || ''} (${g.programDate || ''})"`,
      g.attendance === 'present' ? 'Present' : 'Pending',
      `${window.location.origin}/pass/${g.inquiryId}`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `EDKL_VIP_Guest_List_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('VIP CSV exported successfully!');
  };

  const exportVipPdf = () => {
    if (filteredGuests.length === 0) {
      toast.error('No VIP guests to export.');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Pop-up blocked. Please allow pop-ups for this site to view the PDF report.');
      return;
    }

    const rowsHtml = filteredGuests
      .map(
        (g, idx) => `
      <tr style="border-bottom: 1px solid #e2e8f0; height: 24px;">
        <td style="padding: 5px 8px; text-align: center; border: 1px solid #cbd5e1; font-size: 10px;">${idx + 1}</td>
        <td style="padding: 5px 8px; font-weight: bold; border: 1px solid #cbd5e1; color: #d97706; font-family: monospace; font-size: 11px;">${g.inquiryId}</td>
        <td style="padding: 5px 8px; border: 1px solid #cbd5e1; font-size: 12px;"><strong>${g.husbandName} & ${g.wifeName}</strong> ${g.surname}</td>
        <td style="padding: 5px 8px; text-align: center; border: 1px solid #cbd5e1; font-family: monospace; font-size: 11px;">${g.phoneNumber}</td>
        <td style="padding: 5px 8px; border: 1px solid #cbd5e1; font-size: 10px;">${g.programName || 'VIP Special Guest'}</td>
        <td style="padding: 5px 8px; text-align: center; border: 1px solid #cbd5e1; font-weight: bold; font-size: 10px; color: ${g.attendance === 'present' ? '#059669' : '#d97706'};">
          ${g.attendance === 'present' ? '✓ Present' : 'Awaiting Entry'}
        </td>
      </tr>
    `
      )
      .join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Ek Duje Ke Liye - VIP Guest Roster</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; font-size: 11px; margin: 20px; color: #0f172a; }
          table { width: 100%; border-collapse: collapse; margin-top: 14px; }
          th { background-color: #fffbeb; color: #92400e; font-weight: bold; padding: 6px 8px; border: 1px solid #fde68a; font-size: 10px; text-transform: uppercase; }
          @media print { button { display: none; } }
        </style>
      </head>
      <body>
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #d97706; padding-bottom: 8px;">
          <div>
            <h2 style="margin: 0; color: #92400e; font-size: 18px;">Ek Duje Ke Liye &bull; VIP Guest Roster</h2>
            <p style="margin: 3px 0 0 0; color: #475569; font-size: 11px;">Total VIP Guests: <strong>${filteredGuests.length}</strong> &bull; Present: <strong>${presentCount}</strong></p>
          </div>
          <button onclick="window.print()" style="padding: 8px 16px; background-color: #d97706; color: white; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 12px;">
            Print / Save as PDF
          </button>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 30px;">#</th>
              <th style="width: 100px;">Pass ID</th>
              <th>VIP Couple Name</th>
              <th style="width: 110px;">Phone Number</th>
              <th>Event Slot</th>
              <th style="width: 95px;">Gate Status</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6 w-full min-w-0">
      {/* Top Header */}
      <div className="bg-white border border-slate-200/90 shadow-xs rounded-2xl p-4 sm:p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <SparklesIcon className="w-5 h-5 text-amber-500 flex-shrink-0" />
              <span>VIP &amp; Honorary Guest Passes</span>
            </h2>
            <span className="px-2.5 py-0.5 bg-amber-50 text-amber-900 border border-amber-300 text-[10px] font-extrabold rounded-full uppercase tracking-wider">
              VIP Admission
            </span>
          </div>
          <p className="text-slate-500 text-xs mt-1 font-medium">
            Manage honorary guests, invitees, and special passes with instant digital pass issuance and gate verification.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <button
            onClick={() => {
              setShowIssueModal(true);
              setIssueSuccess('');
              setIssueError('');
              setNewPassUrl('');
              setCouplePhoto(null);
              setCouplePhotoPreview(null);
              setProgramId(selectedProgramId && selectedProgramId !== 'all' ? selectedProgramId : (programs[0]?.id || ''));
            }}
            className="flex-1 sm:flex-none px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-extrabold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap active:scale-95"
          >
            <span>+ Issue New VIP Pass</span>
          </button>
          <button
            onClick={() => setShowExportModal(true)}
            className="flex-1 sm:flex-none px-4 py-2.5 bg-rose-700 hover:bg-rose-800 text-white rounded-xl text-xs font-extrabold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap active:scale-95"
            title="Open Master Export Center for VIP Passes"
          >
            <DownloadIcon className="w-4 h-4 flex-shrink-0" />
            <span>Export Center</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs space-y-1">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
            Total VIP Passes Issued
          </span>
          <div className="flex items-center justify-between">
            <span className="text-2xl sm:text-3xl font-black text-slate-900">{totalVipCount}</span>
            <TicketIcon className="w-6 h-6 text-amber-500 opacity-80" />
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs space-y-1">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700">
            VIP Guests Checked-In (Gate)
          </span>
          <div className="flex items-center justify-between">
            <span className="text-2xl sm:text-3xl font-black text-emerald-600">{presentCount}</span>
            <CheckCircleIcon className="w-6 h-6 text-emerald-600 opacity-80" />
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs space-y-1">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700">
            Awaiting Gate Entry
          </span>
          <div className="flex items-center justify-between">
            <span className="text-2xl sm:text-3xl font-black text-amber-600">{pendingCheckinCount}</span>
            <SparklesIcon className="w-6 h-6 text-amber-500 opacity-80" />
          </div>
        </div>
      </div>

      {/* VIP Public Self-Registration Share Banner & Dynamic VIP Links */}
      {(() => {
        const defaultLink = vipLinks.find((l) => l.isDefault || l.code === 'default') || {
          _id: '',
          name: "Today's VIP Entry Link",
          code: 'default',
          status: 'HOUSEFULL' as const,
          maxSeats: 0,
          usedSeats: 0,
          approvedSeats: approvedVipCount,
          isDefault: true
        };
        const customLinks = vipLinks.filter((l) => !l.isDefault && l.code !== 'default');
        const isDefaultHousefull = defaultLink.status === 'HOUSEFULL' || defaultLink.status === 'CLOSED';

        return (
          <div className="space-y-3">
            {/* Main Default VIP Link Banner */}
            <div className={`border rounded-2xl p-4 sm:p-5 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 shadow-xs transition-all ${
              isDefaultHousefull 
                ? 'bg-gradient-to-r from-rose-50/90 via-amber-50/40 to-white border-rose-200' 
                : 'bg-gradient-to-r from-emerald-50/90 via-amber-50/40 to-white border-emerald-200'
            }`}>
              <div className="flex items-start sm:items-center gap-3.5 flex-1 min-w-0">
                <div className={`w-12 h-12 rounded-2xl text-white flex items-center justify-center shadow-xs flex-shrink-0 ${
                  isDefaultHousefull ? 'bg-gradient-to-br from-rose-600 to-amber-600' : 'bg-gradient-to-br from-emerald-600 to-teal-600'
                }`}>
                  <SparklesIcon className="w-6 h-6 text-white" />
                </div>
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-900">
                      Today&apos;s VIP Entry Link &bull; મહેમાન રજીસ્ટ્રેશન લિંક
                    </span>
                    {isDefaultHousefull ? (
                      <span className="px-2.5 py-0.5 bg-rose-100 text-rose-800 border border-rose-300 text-[10px] font-black rounded-full uppercase tracking-wider flex items-center gap-1.5 shadow-2xs">
                        <span className="w-2 h-2 rounded-full bg-rose-600 animate-pulse" />
                        🔴 HOUSEFULL &bull; હાલ બંધ છે (Closed)
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-black rounded-full uppercase tracking-wider flex items-center gap-1.5 shadow-2xs">
                        <span className="w-2 h-2 rounded-full bg-emerald-600" />
                        🟢 ACTIVE &bull; એન્ટ્રી ચાલુ છે (Open)
                      </span>
                    )}
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-900 text-[10px] font-bold rounded-full border border-amber-300">
                      Approved: {defaultLink.approvedSeats || approvedVipCount} VIPs
                    </span>
                  </div>
                  <p className="text-xs text-stone-600 font-medium">
                    {isDefaultHousefull
                      ? 'આ લિંક હાલમાં હાઉસફુલ (Housefull) છે. જાહેર મહેમાનો ફોર્મ ભરી શકશે નહીં.'
                      : 'આ લિંક હાલમાં એક્ટિવ છે. મહેમાનો ફોર્મ ભરી શકશે અને અહીં Pending Approval માં આવશે.'}
                  </p>
                  <div className="text-xs font-mono font-bold text-stone-800 select-all bg-white px-2.5 py-1 rounded-lg border border-slate-200 inline-block shadow-2xs break-all">
                    {typeof window !== 'undefined' ? `${window.location.origin}/vip-entry` : 'https://www.ekdujekeliye.in/vip-entry'}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
                {/* 1-Click Toggle Default Status */}
                {defaultLink._id ? (
                  <button
                    type="button"
                    disabled={togglingLinkId === defaultLink._id}
                    onClick={() => handleToggleLinkStatus(defaultLink)}
                    className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-xs font-black transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap active:scale-95 disabled:opacity-50 ${
                      isDefaultHousefull
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        : 'bg-rose-600 hover:bg-rose-700 text-white'
                    }`}
                    title={isDefaultHousefull ? 'Open this link to accept VIP entries' : 'Close this link and show Housefull'}
                  >
                    {togglingLinkId === defaultLink._id ? (
                      <span>Updating...</span>
                    ) : isDefaultHousefull ? (
                      <span>🟢 Re-open Link (ચાલુ કરો)</span>
                    ) : (
                      <span>🔴 Mark Housefull (બંધ કરો)</span>
                    )}
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={() => handleCopySpecificLink('default')}
                  className="flex-1 sm:flex-none px-4 py-2.5 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-700 hover:to-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer whitespace-nowrap"
                >
                  <CheckIcon className="w-4 h-4" />
                  <span>{copiedLinkCode === 'default' ? 'Copied!' : 'Copy VIP Link'}</span>
                </button>

                <a
                  href="/vip-entry"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 sm:flex-none px-4 py-2.5 bg-white hover:bg-stone-50 text-stone-800 border border-stone-300 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 whitespace-nowrap"
                >
                  <span>Open Form</span>
                  <ExternalLinkIcon className="w-3.5 h-3.5 text-stone-500" />
                </a>

                <button
                  type="button"
                  onClick={handleOpenCreateLinkModal}
                  className="flex-1 sm:flex-none px-4 py-2.5 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 rounded-xl text-xs font-extrabold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <span>+ Create Specific Link</span>
                </button>
              </div>
            </div>

            {/* Custom / Specific VIP Links Accordion & Manager */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    <TicketIcon className="w-4 h-4 text-amber-500" />
                    <span>Specific VIP Links &amp; Quotas &bull; ખાસ મહેમાન/ટ્રસ્ટી લિંક્સ ({customLinks.length})</span>
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium">
                    (Create links with seat quotas for sponsors, committee, or trustees)
                  </span>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setShowCustomLinksSection((prev) => !prev)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1"
                  >
                    <span>{showCustomLinksSection ? 'Hide Details ▲' : `Manage Custom Links (${customLinks.length}) ▼`}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenCreateLinkModal}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1"
                  >
                    <span>+ New Link</span>
                  </button>
                </div>
              </div>

              {showCustomLinksSection && (
                <div className="pt-3 space-y-3">
                  {loadingLinks ? (
                    <div className="py-6 text-center text-xs text-slate-400 font-medium">
                      Loading VIP links...
                    </div>
                  ) : customLinks.length === 0 ? (
                    <div className="py-6 text-center space-y-2 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                      <p className="text-xs font-bold text-slate-600">
                        No custom VIP links created yet.
                      </p>
                      <p className="text-[11px] text-slate-400 max-w-md mx-auto">
                        Create a specific link for a group (e.g. &quot;Diamond Sponsors&quot; or &quot;Trustee Family&quot;) with a max seat limit. Once seats are approved, it automatically closes!
                      </p>
                      <button
                        type="button"
                        onClick={handleOpenCreateLinkModal}
                        className="mt-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                      >
                        + Create First Specific Link
                      </button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-500 bg-slate-50/80">
                            <th className="py-2.5 px-3">Link Name &amp; Code</th>
                            <th className="py-2.5 px-3">Event Slot</th>
                            <th className="py-2.5 px-3 text-center">Seat Quota</th>
                            <th className="py-2.5 px-3 text-center">Status</th>
                            <th className="py-2.5 px-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {customLinks.map((link) => {
                            const isLinkHousefull = link.status === 'HOUSEFULL' || link.status === 'CLOSED';
                            const isQuotaReached = link.maxSeats > 0 && link.approvedSeats >= link.maxSeats;

                            return (
                              <tr key={link._id} className="hover:bg-amber-50/30 transition-colors">
                                <td className="py-3 px-3">
                                  <div className="font-bold text-slate-900 text-xs">{link.name}</div>
                                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                    <span className="font-mono text-[10px] text-amber-900 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 font-bold">
                                      code={link.code}
                                    </span>
                                    {link.notes && (
                                      <span className="text-[10px] text-slate-400 italic">
                                        &bull; {link.notes}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-3 px-3 text-slate-600">
                                  <div className="font-medium text-xs">{link.programName || 'Any / All Event Slots'}</div>
                                  {link.programDate && (
                                    <div className="text-[10px] text-slate-400">{link.programDate}</div>
                                  )}
                                </td>
                                <td className="py-3 px-3 text-center">
                                  <div className="inline-flex flex-col items-center">
                                    <span className={`text-xs font-black ${isQuotaReached ? 'text-rose-600' : 'text-slate-800'}`}>
                                      {link.approvedSeats || 0} / {link.maxSeats > 0 ? link.maxSeats : '∞'}
                                    </span>
                                    <span className="text-[9px] uppercase font-bold text-slate-400">
                                      {link.maxSeats > 0 ? (isQuotaReached ? 'Quota Full' : `${link.maxSeats - (link.approvedSeats || 0)} left`) : 'Unlimited'}
                                    </span>
                                  </div>
                                </td>
                                <td className="py-3 px-3 text-center">
                                  {isLinkHousefull ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-full text-[10px] font-black uppercase">
                                      <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
                                      Housefull
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[10px] font-black uppercase">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                                      Active
                                    </span>
                                  )}
                                </td>
                                <td className="py-3 px-3 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    {/* 1-Click Toggle */}
                                    <button
                                      type="button"
                                      disabled={togglingLinkId === link._id}
                                      onClick={() => handleToggleLinkStatus(link)}
                                      className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all cursor-pointer ${
                                        isLinkHousefull
                                          ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800'
                                          : 'bg-rose-100 hover:bg-rose-200 text-rose-800'
                                      }`}
                                      title={isLinkHousefull ? 'Re-open this VIP link' : 'Close this link (Mark Housefull)'}
                                    >
                                      {togglingLinkId === link._id ? '...' : isLinkHousefull ? 'Open' : 'Close'}
                                    </button>

                                    {/* Copy */}
                                    <button
                                      type="button"
                                      onClick={() => handleCopySpecificLink(link.code)}
                                      className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors cursor-pointer"
                                      title="Copy Link URL"
                                    >
                                      <CheckIcon className={`w-3.5 h-3.5 ${copiedLinkCode === link.code ? 'text-emerald-600' : 'text-slate-500'}`} />
                                    </button>

                                    {/* Open Link */}
                                    <a
                                      href={`/vip-entry?code=${encodeURIComponent(link.code)}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors"
                                      title="Open in new tab"
                                    >
                                      <ExternalLinkIcon className="w-3.5 h-3.5 text-slate-500" />
                                    </a>

                                    {/* Edit */}
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEditLinkModal(link)}
                                      className="p-1.5 hover:bg-amber-100 rounded-lg text-amber-700 transition-colors cursor-pointer"
                                      title="Edit Link & Seats"
                                    >
                                      <EditIcon className="w-3.5 h-3.5" />
                                    </button>

                                    {/* Delete */}
                                    <button
                                      type="button"
                                      disabled={deletingLinkId === link._id}
                                      onClick={() => handleDeleteLink(link)}
                                      className="p-1.5 hover:bg-rose-100 rounded-lg text-rose-600 transition-colors cursor-pointer disabled:opacity-50"
                                      title="Delete Link"
                                    >
                                      <TrashIcon className="w-3.5 h-3.5" />
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
              )}
            </div>
          </div>
        );
      })()}

      {/* Approval Status Filter Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold w-fit">
        <button
          type="button"
          onClick={() => setApprovalFilter('all')}
          className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${approvalFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
        >
          All VIPs ({totalVipCount})
        </button>
        <button
          type="button"
          onClick={() => setApprovalFilter('approved')}
          className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${approvalFilter === 'approved' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
        >
          Approved Passes ({approvedVipCount})
        </button>
        <button
          type="button"
          onClick={() => setApprovalFilter('pending')}
          className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${approvalFilter === 'pending' ? 'bg-white text-amber-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
        >
          <span>Pending Approval ({pendingApprovalCount})</span>
          {pendingApprovalCount > 0 && (
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
          )}
        </button>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1">
          <SearchIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by VIP name, phone, or Pass ID (e.g. EK06-IP-01)..."
            className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:bg-white focus:outline-none focus:border-amber-500 font-medium"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <XIcon className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full sm:w-auto">
          <div className="w-full sm:w-56 min-w-0">
            <LuxurySelect
              label="Filter Event Slot"
              value={selectedProgramId}
              onChange={(val) => handleSelectProgram(val)}
              options={[
                { value: 'all', label: 'All Event Slots' },
                ...programs.map((p) => ({
                  value: p.id,
                  label: p.name,
                  sublabel: p.date
                }))
              ]}
            />
          </div>

          <div className="w-full sm:w-44 min-w-0">
            <LuxurySelect
              label="Gate Attendance"
              value={attendanceFilter}
              onChange={(val) => setAttendanceFilter(val)}
              options={[
                { value: 'all', label: 'All Attendance' },
                { value: 'present', label: 'Present (Checked In)' },
                { value: 'unmarked', label: 'Unmarked' },
                { value: 'absent', label: 'Absent' }
              ]}
            />
          </div>
        </div>
      </div>


      {/* VIP Passes Container */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-xs text-slate-500 font-medium">
            Loading VIP Guest List...
          </div>
        ) : filteredGuests.length === 0 ? (
          <div className="py-16 text-center space-y-3 p-6">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto text-amber-500">
              <SparklesIcon className="w-7 h-7" />
            </div>
            <h3 className="font-extrabold text-sm text-slate-800">No VIP Passes Found</h3>
            <p className="text-xs text-slate-500 font-medium max-w-sm mx-auto">
              Issue honorary passes for special invitees, family members, or sponsors.
            </p>
            <button
              onClick={() => setShowIssueModal(true)}
              className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-600 hover:to-rose-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer inline-block"
            >
              + Issue First VIP Pass
            </button>
          </div>
        ) : (
          <div>
            {/* Desktop Table View (md and above) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                    <th className="py-3.5 px-4">Pass ID &amp; Submitted</th>
                    <th className="py-3.5 px-4">Invited VIP Couple</th>
                    <th className="py-3.5 px-4">Phone &amp; WhatsApp</th>
                    <th className="py-3.5 px-4">Program Slot</th>
                    <th className="py-3.5 px-4">Payment / Type</th>
                    <th className="py-3.5 px-4">Gate Attendance</th>
                    <th className="py-3.5 px-4">Couple Photo</th>
                    <th className="py-3.5 px-4 text-right">Pass Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-medium">
                  {filteredGuests.map((g) => {
                    const cleanDigits = g.phoneNumber.replace(/\D/g, '').slice(-10);

                    return (
                      <tr key={g._id || g.inquiryId} className="hover:bg-slate-50/60 transition-colors">
                        {/* Pass ID & Submitted */}
                        <td className="py-3.5 px-4 font-mono font-bold">
                          <div className="space-y-0.5">
                            <span className="px-2.5 py-0.5 bg-amber-50 text-amber-900 border border-amber-300 rounded-lg text-xs font-mono font-extrabold tracking-wide inline-flex items-center gap-1">
                              <SparklesIcon className="w-3 h-3 text-amber-600 flex-shrink-0" />
                              <span>{g.inquiryId}</span>
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium block whitespace-nowrap">
                              {formatSubmissionTime(g.createdAt)}
                            </span>
                          </div>
                        </td>

                        {/* Couple Name */}
                        <td className="py-3.5 px-4">
                          <span className="font-extrabold text-slate-900 block truncate">
                            {g.husbandName} &amp; {g.wifeName}
                          </span>
                          <span className="text-[11px] text-slate-500 font-semibold">{g.surname}</span>
                        </td>

                        {/* Phone & WhatsApp */}
                        <td className="py-3.5 px-4">
                          <div className="flex flex-col gap-1 items-start">
                            <a
                              href={`tel:+91${cleanDigits}`}
                              className="font-mono font-bold text-slate-900 hover:text-rose-600 flex items-center gap-1 group transition-colors"
                              title="Click to Call Mobile Number"
                            >
                              <PhoneIcon className="w-3 h-3 text-slate-400 group-hover:text-rose-600 transition-colors" />
                              <span>{g.phoneNumber}</span>
                            </a>
                            <a
                              href={`https://wa.me/91${cleanDigits}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[10px] text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-1.5 py-0.5 rounded transition-colors"
                              title="Direct WhatsApp Chat"
                            >
                              <WhatsappIcon className="w-2.5 h-2.5 text-emerald-600" />
                              <span>WhatsApp</span>
                            </a>
                          </div>
                        </td>

                        {/* Program Slot */}
                        <td className="py-3.5 px-4 text-slate-600">
                          <div className="font-bold text-slate-800 truncate">{g.programName || 'VIP Seminar Slot'}</div>
                          <div className="text-[10px] text-slate-500">{g.programDate} &bull; {g.programTime || '8:30 PM'}</div>
                        </td>

                        {/* Payment Pill */}
                        <td className="py-3.5 px-4">
                          {g.status === 'pending' ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-amber-100 border border-amber-300 text-amber-900 inline-flex items-center gap-1 whitespace-nowrap animate-pulse">
                              <ClockIcon className="w-3 h-3 text-amber-700" />
                              <span>⏳ Pending Approval</span>
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-amber-50 border border-amber-300 text-amber-900 inline-flex items-center gap-1 whitespace-nowrap">
                              <SparklesIcon className="w-3 h-3 text-amber-600" />
                              <span>Paid (₹0) MANUAL_INVITE</span>
                            </span>
                          )}
                        </td>

                        {/* Attendance Dropdown */}
                        <td className="py-3.5 px-4">
                          <div className="w-36">
                            <LuxurySelect
                              size="sm"
                              variant="subtle"
                              value={g.attendance || 'unmarked'}
                              onChange={(val) => handleAttendance(g.inquiryId, val as any)}
                              options={[
                                { value: 'unmarked', label: 'Unmarked' },
                                { value: 'present', label: 'Present', badge: 'IN' },
                                { value: 'absent', label: 'Absent' }
                              ]}
                            />
                          </div>
                        </td>


                        {/* Photo Thumbnail */}
                        <td className="py-3.5 px-4">
                          {g.couplePhoto ? (
                            <button
                              type="button"
                              onClick={() => setSelectedImage(resolveDisplayImageUrl(g.couplePhoto || g.photoThumbnailUrl, 'normal'))}
                              className="w-10 h-10 rounded-xl overflow-hidden border border-slate-200 bg-white cursor-pointer shadow-xs hover:scale-105 transition-transform"
                              title="Click to zoom couple photo"
                            >
                              <img
                                src={resolveDisplayImageUrl(g.photoThumbnailUrl || g.couplePhoto, 'thumbnail')}
                                alt="VIP Couple"
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            </button>
                          ) : (
                            <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 text-[9px] font-bold">
                              No Pic
                            </div>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {g.status === 'pending' ? (
                              <>
                                <button
                                  type="button"
                                  disabled={approvingId === g.inquiryId}
                                  onClick={() => handleApproveVip(g.inquiryId, `${g.husbandName} & ${g.wifeName}`)}
                                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-lg text-xs font-black transition-all shadow-xs flex items-center gap-1 cursor-pointer whitespace-nowrap disabled:opacity-50"
                                  title="Approve and activate this VIP pass"
                                >
                                  {approvingId === g.inquiryId ? (
                                    <span>Approving...</span>
                                  ) : (
                                    <>
                                      <CheckIcon className="w-3.5 h-3.5" />
                                      <span>Approve Pass</span>
                                    </>
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteVip(g._id || g.inquiryId, `${g.husbandName} & ${g.wifeName}`)}
                                  className="px-2 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition-all cursor-pointer"
                                  title="Decline / Delete Request"
                                >
                                  <span>✕</span>
                                </button>
                              </>
                            ) : (
                              <>
                                <a
                                  href={`/pass/${g.inquiryId}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-[11px] font-bold transition-all whitespace-nowrap"
                                  title="Open Gate Entry Pass"
                                >
                                  Pass ↗
                                </a>
                                <a
                                  href={`/invitation/${g.inquiryId}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[11px] font-bold transition-all whitespace-nowrap"
                                  title="Open Personalized Invitation Card"
                                >
                                  Card ↗
                                </a>
                                <button
                                  type="button"
                                  onClick={() => handleResendWhatsApp(g)}
                                  disabled={resendingId === g.inquiryId}
                                  className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 whitespace-nowrap disabled:opacity-50"
                                  title="Send VIP Pass & Invitation via WhatsApp"
                                >
                                  <WhatsappIcon className="w-3 h-3 text-emerald-600" />
                                  <span>{resendingId === g.inquiryId ? 'Sending...' : 'WhatsApp'}</span>
                                </button>
                              </>
                            )}
                            <a
                              href={getWhatsAppMessageUrl(g)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 rounded-lg cursor-pointer transition-colors"
                              title="Open in WhatsApp Web (wa.me)"
                            >
                              <ExternalLinkIcon className="w-3.5 h-3.5 text-emerald-600" />
                            </a>
                            <button
                              type="button"
                              onClick={() => setEditingGuest(g)}
                              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 rounded-lg transition-all cursor-pointer"
                              title="Edit VIP details & slot"
                            >
                              <EditIcon className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteVip(g._id || '', `${g.husbandName} & ${g.wifeName}`)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                              title="Revoke / Delete VIP Pass"
                            >
                              <TrashIcon className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View (< md screens) */}
            <div className="md:hidden p-3 sm:p-4 space-y-3.5">
              {filteredGuests.map((g) => {
                const cleanDigits = g.phoneNumber.replace(/\D/g, '').slice(-10);

                return (
                  <div
                    key={g._id || g.inquiryId}
                    className="bg-white border border-amber-200/90 rounded-2xl p-3.5 sm:p-4 shadow-xs space-y-3.5"
                  >
                    {/* Row 1: Pass ID Chip, Date/Time, and Trash */}
                    <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="px-2.5 py-0.5 bg-amber-50 text-amber-900 border border-amber-300 rounded-lg text-xs font-mono font-extrabold tracking-wide inline-flex items-center gap-1">
                          <SparklesIcon className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                          <span>{g.inquiryId}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(g.inquiryId);
                            setCopiedId(g.inquiryId);
                            setTimeout(() => setCopiedId(null), 2000);
                          }}
                          className="text-[10px] text-slate-400 hover:text-slate-700 font-bold px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 transition-colors"
                          title="Copy Pass ID"
                        >
                          {copiedId === g.inquiryId ? '✓' : 'Copy'}
                        </button>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0 text-slate-400 text-[10px]">
                        {g.createdAt && (
                          <span className="font-medium text-slate-500 whitespace-nowrap">
                            {formatSubmissionTime(g.createdAt)}
                          </span>
                        )}
                        <button
                          onClick={() => handleDeleteVip(g._id || '', `${g.husbandName} & ${g.wifeName}`)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                          title="Revoke VIP Pass"
                        >
                          <TrashIcon className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Row 2: Status Chips */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {g.status === 'pending' ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-100 border border-amber-300 text-amber-900 inline-flex items-center gap-1 animate-pulse">
                          <ClockIcon className="w-3 h-3 text-amber-700" />
                          <span>⏳ Pending Approval</span>
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-50 border border-amber-300 text-amber-900 inline-flex items-center gap-1">
                          <SparklesIcon className="w-3 h-3 text-amber-600" />
                          <span>Paid (₹0) MANUAL_INVITE</span>
                        </span>
                      )}
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-100 text-amber-900 border border-amber-200">
                        Honorary VIP
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border whitespace-nowrap ${
                        g.attendance === 'present'
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                          : g.attendance === 'absent'
                          ? 'bg-slate-100 border-slate-300 text-slate-600'
                          : 'bg-slate-50 border-slate-200 text-slate-500'
                      }`}>
                        {g.attendance === 'present' ? '✓ Present' : g.attendance === 'absent' ? 'Absent' : 'Unmarked'}
                      </span>
                    </div>

                    {/* Row 3: VIP Couple Information + Photo */}
                    <div className="flex items-start gap-3 bg-amber-50/50 border border-amber-200/60 rounded-xl p-3">
                      {/* Photo / Avatar */}
                      <div className="flex flex-col items-center gap-1 flex-shrink-0">
                        {g.couplePhoto ? (
                          <button
                            type="button"
                            onClick={() => setSelectedImage(resolveDisplayImageUrl(g.couplePhoto || g.photoThumbnailUrl, 'normal'))}
                            className="w-14 h-14 rounded-xl overflow-hidden border border-amber-200 bg-white cursor-pointer shadow-xs active:scale-95 transition-transform"
                            title="Tap to enlarge photo"
                          >
                            <img
                              src={resolveDisplayImageUrl(g.photoThumbnailUrl || g.couplePhoto, 'thumbnail')}
                              alt="Couple"
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          </button>
                        ) : (
                          <div className="w-14 h-14 rounded-xl bg-amber-100/80 border border-amber-300 flex items-center justify-center text-amber-800 text-[11px] font-bold">
                            <SparklesIcon className="w-6 h-6 text-amber-500" />
                          </div>
                        )}
                      </div>

                      {/* Info Details */}
                      <div className="flex-1 min-w-0 space-y-1">
                        <h4 className="font-extrabold text-slate-900 text-sm leading-snug break-words">
                          {g.husbandName} &amp; {g.wifeName}
                        </h4>
                        <p className="text-xs text-slate-600 font-semibold">{g.surname}</p>
                        <div className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5 pt-0.5">
                          <MapPinIcon className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                          <span className="truncate">{g.programName || 'VIP Special Guest'} ({g.programDate})</span>
                        </div>
                      </div>
                    </div>

                    {/* Row 4: Communication Bar */}
                    <div className="grid grid-cols-2 gap-2">
                      <a
                        href={`tel:+91${cleanDigits}`}
                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-900 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                        title="Call VIP Guest"
                      >
                        <PhoneIcon className="w-3.5 h-3.5 text-slate-700 flex-shrink-0" />
                        <span className="truncate font-mono">{g.phoneNumber}</span>
                      </a>

                      <a
                        href={`https://wa.me/91${cleanDigits}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-xs transition-colors"
                        title="Chat on WhatsApp"
                      >
                        <WhatsappIcon className="w-3.5 h-3.5 text-white flex-shrink-0" />
                        <span>WhatsApp</span>
                      </a>
                    </div>

                    {/* Row 5: Attendance Selector & Actions Strip */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-2 border-t border-slate-100">
                      {/* Attendance LuxurySelect Dropdown */}
                      <div className="flex-1 min-w-0">
                        <LuxurySelect
                          size="sm"
                          variant="card"
                          value={g.attendance || 'unmarked'}
                          onChange={(val) => handleAttendance(g.inquiryId, val as any)}
                          options={[
                            { value: 'unmarked', label: 'Unmarked Attendance' },
                            { value: 'present', label: 'Present (Checked In)', badge: 'IN' },
                            { value: 'absent', label: 'Absent' }
                          ]}
                        />
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {g.status === 'pending' ? (
                          <>
                            <button
                              type="button"
                              disabled={approvingId === g.inquiryId}
                              onClick={() => handleApproveVip(g.inquiryId, `${g.husbandName} & ${g.wifeName}`)}
                              className="px-3 py-1.5 min-h-[34px] bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-xs rounded-xl flex items-center gap-1 shadow-xs cursor-pointer disabled:opacity-50 whitespace-nowrap"
                              title="Approve and activate this VIP pass"
                            >
                              {approvingId === g.inquiryId ? (
                                <span>Approving...</span>
                              ) : (
                                <>
                                  <CheckIcon className="w-3.5 h-3.5" />
                                  <span>Approve Pass</span>
                                </>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteVip(g._id || g.inquiryId, `${g.husbandName} & ${g.wifeName}`)}
                              className="px-2.5 py-1.5 min-h-[34px] bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-xl cursor-pointer"
                              title="Decline / Delete Request"
                            >
                              <span>✕</span>
                            </button>
                          </>
                        ) : (
                          <>
                            <a
                              href={`/pass/${g.inquiryId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1.5 min-h-[34px] bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 font-bold text-xs rounded-xl flex items-center gap-1 shadow-2xs"
                              title="Open Gate Entry Pass"
                            >
                              <span>Pass</span>
                              <span>↗</span>
                            </a>

                            <a
                              href={`/invitation/${g.inquiryId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1.5 min-h-[34px] bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold text-xs rounded-xl flex items-center gap-1 shadow-2xs"
                              title="Open Personalized Invitation Card"
                            >
                              <span>Card</span>
                              <span>↗</span>
                            </a>

                            <button
                              type="button"
                              onClick={() => handleResendWhatsApp(g)}
                              disabled={resendingId === g.inquiryId}
                              className="px-2.5 py-1.5 min-h-[34px] bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl flex items-center gap-1 shadow-xs cursor-pointer disabled:opacity-50"
                              title="Send Official VIP Pass & Invitation Card via Meta WhatsApp API"
                            >
                              <WhatsappIcon className={`w-3.5 h-3.5 ${resendingId === g.inquiryId ? 'animate-spin' : ''}`} />
                            </button>
                          </>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <a
                          href={getWhatsAppMessageUrl(g)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1.5 min-h-[34px] bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 font-bold text-xs rounded-xl flex items-center gap-1"
                          title="Open in WhatsApp Web (wa.me)"
                        >
                          <span>wa.me ↗</span>
                        </a>

                        <button
                          type="button"
                          onClick={() => setEditingGuest(g)}
                          className="px-2.5 py-1.5 min-h-[34px] bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl flex items-center gap-1 cursor-pointer transition-colors"
                          title="Edit VIP details & slot"
                        >
                          <EditIcon className="w-3.5 h-3.5 text-slate-600" />
                          <span>Edit</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>



      {/* Modal: Issue New VIP Pass */}
      {showIssueModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in-50 zoom-in-95 my-auto max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center">
                  <SparklesIcon className="w-5 h-5 flex-shrink-0" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">
                    Issue Honorary VIP Guest Pass
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">Generate digital couple admission pass with zero payment requirement.</p>
                </div>
              </div>
              <button
                onClick={() => setShowIssueModal(false)}
                className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors cursor-pointer"
                aria-label="Close"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>

            {issueError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-bold flex items-center gap-2">
                <AlertTriangleIcon className="w-4 h-4 flex-shrink-0" />
                <span>{issueError}</span>
              </div>
            )}

            {issueSuccess && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs space-y-2.5">
                <span className="font-bold block">{issueSuccess}</span>
                {newPassUrl && (
                  <div className="pt-2 border-t border-emerald-200 space-y-2">
                    <span className="font-mono text-xs text-emerald-950 select-all break-all block bg-white p-2 rounded-xl border border-emerald-300">
                      {newPassUrl}
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(newPassUrl);
                          toast.success('VIP Pass URL copied!');
                        }}
                        className="flex-1 py-2 bg-emerald-200 hover:bg-emerald-300 text-emerald-950 text-xs font-bold rounded-xl"
                      >
                        Copy Pass Link
                      </button>
                      <a
                        href={newPassUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl text-center"
                      >
                        Open Digital Pass →
                      </a>
                    </div>
                  </div>
                )}
              </div>
            )}

            <form onSubmit={handleIssueSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                    Partner 1 / Husband Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={husbandName}
                    onChange={(e) => setHusbandName(e.target.value)}
                    placeholder="Partner 1 name"
                    className="w-full px-3.5 py-3 bg-slate-50 border border-slate-300 focus:bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 rounded-xl text-base text-slate-900 font-medium outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                    Partner 2 / Wife Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={wifeName}
                    onChange={(e) => setWifeName(e.target.value)}
                    placeholder="Partner 2 name"
                    className="w-full px-3.5 py-3 bg-slate-50 border border-slate-300 focus:bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 rounded-xl text-base text-slate-900 font-medium outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                    Family Surname *
                  </label>
                  <input
                    type="text"
                    required
                    value={surname}
                    onChange={(e) => setSurname(e.target.value)}
                    placeholder="e.g. Shah, Patel, Vaghasiya"
                    className="w-full px-3.5 py-3 bg-slate-50 border border-slate-300 focus:bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 rounded-xl text-base text-slate-900 font-medium outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                    WhatsApp Mobile Number *
                  </label>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                    placeholder="10-digit mobile number"
                    className="w-full px-3.5 py-3 bg-slate-50 border border-slate-300 focus:bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 rounded-xl text-base text-slate-900 font-medium outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <LuxurySelect
                  label="Event Program Slot *"
                  value={programId}
                  onChange={(val) => setProgramId(val)}
                  placeholder="-- Select Event Slot --"
                  options={programs.map((p) => ({
                    value: p.id,
                    label: p.name,
                    sublabel: `${p.date} • ${p.time || '8:30 PM'}`
                  }))}
                />
              </div>

              {/* Photo Upload */}
              <div>
                <label className="block text-[10px] font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                  Couple Photo (Optional)
                </label>
                <div className="flex items-center gap-3">
                  {couplePhotoPreview && (
                    <img
                      src={couplePhotoPreview}
                      alt="Preview"
                      className="w-14 h-14 rounded-xl object-cover border border-amber-300 shadow-xs flex-shrink-0"
                    />
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoSelect}
                    className="text-xs text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-amber-50 file:text-amber-800 hover:file:bg-amber-100 cursor-pointer"
                  />
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowIssueModal(false)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={issuing}
                  className="flex-1 py-3 bg-amber-600 hover:bg-amber-700 text-white font-extrabold rounded-2xl text-xs transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {issuing ? 'Generating Pass...' : 'Issue VIP Pass'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dynamic Batch Export Center Modal */}
      <BatchExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        defaultProgramId={selectedProgramId !== 'all' ? selectedProgramId : ''}
      />

      {/* Image Preview Lightbox Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-lg w-full bg-white rounded-3xl overflow-hidden shadow-2xl p-2 animate-in fade-in-50 zoom-in-95">
            <img
              src={resolveDisplayImageUrl(selectedImage, 'large')}
              alt="VIP Couple Full"
              className="w-full h-auto max-h-[80vh] object-contain rounded-2xl"
            />
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-4 right-4 bg-slate-900/80 text-white p-2 rounded-full hover:bg-slate-900 transition-colors"
            >
              <XIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
      {/* Edit VIP Guest Entry Modal */}
      <EditRegistrationModal
        submission={editingGuest}
        programs={programs}
        isOpen={!!editingGuest}
        onClose={() => setEditingGuest(null)}
        onSuccess={(updated) => {
          setVipGuests((prev) =>
            prev.map((item) => (item.inquiryId === updated.inquiryId ? updated : item))
          );
        }}
      />

      {/* Create / Edit Specific VIP Link Modal */}
      {showLinkModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 border border-amber-100 animate-in fade-in-50 zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <SparklesIcon className="w-5 h-5 text-amber-500" />
                <h3 className="text-base font-extrabold text-slate-900">
                  {editingLink ? 'Edit VIP Link & Quota' : 'Create Specific VIP Link'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowLinkModal(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveLink} className="space-y-4">
              <div>
                <label className="block text-[10px] font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                  Link Name / Title *
                </label>
                <input
                  type="text"
                  required
                  value={linkName}
                  onChange={(e) => setLinkName(e.target.value)}
                  placeholder="e.g. Trustee Quota, Diamond Sponsors"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 focus:bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 rounded-xl text-xs text-slate-900 font-medium outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-[10px] font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                  Custom Code (Slug) *
                </label>
                <input
                  type="text"
                  required
                  value={linkCode}
                  onChange={(e) => setLinkCode(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                  placeholder="e.g. trustees, sponsor10"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 focus:bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 rounded-xl text-xs font-mono text-slate-900 font-bold outline-none transition-all"
                />
                <span className="text-[10px] text-slate-400 block mt-1">
                  URL: <strong className="text-amber-700 font-mono">/vip-entry?code={linkCode || 'code'}</strong>
                </span>
              </div>

              <div>
                <label className="block text-[10px] font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                  Event Program Slot (Optional)
                </label>
                <select
                  value={linkProgramId}
                  onChange={(e) => setLinkProgramId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 focus:bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 rounded-xl text-xs text-slate-900 font-medium outline-none transition-all"
                >
                  <option value="">-- Any / All Event Slots --</option>
                  {programs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.date})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                    Max Seats Quota
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={linkMaxSeats}
                    onChange={(e) => setLinkMaxSeats(parseInt(e.target.value, 10) || 0)}
                    placeholder="0 = Unlimited"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 focus:bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 rounded-xl text-xs text-slate-900 font-bold outline-none transition-all"
                  />
                  <span className="text-[9px] text-slate-400 block mt-0.5">
                    (0 = unlimited seats)
                  </span>
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                    Status
                  </label>
                  <select
                    value={linkStatus}
                    onChange={(e) => setLinkStatus(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 focus:bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 rounded-xl text-xs text-slate-900 font-bold outline-none transition-all"
                  >
                    <option value="ACTIVE">ACTIVE (Open)</option>
                    <option value="HOUSEFULL">HOUSEFULL (Closed)</option>
                    <option value="CLOSED">CLOSED</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                  Admin Notes / Remarks (Optional)
                </label>
                <input
                  type="text"
                  value={linkNotes}
                  onChange={(e) => setLinkNotes(e.target.value)}
                  placeholder="e.g. Reserved for Shri ABC / Sponsor"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 focus:bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 rounded-xl text-xs text-slate-900 font-medium outline-none transition-all"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowLinkModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingLink}
                  className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-extrabold rounded-xl text-xs transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {savingLink ? 'Saving...' : editingLink ? 'Update Link' : 'Create VIP Link'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
