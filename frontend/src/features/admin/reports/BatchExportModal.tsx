'use client';

import React, { useState } from 'react';
import { useAdmin } from '../context/AdminContext';
import { registrationsApi } from '../../../services/admin/registrationsApi';
import { API_BASE_URL } from '../../../config';
import { Submission } from '../../../types';
import { DownloadIcon } from '../../../components/Icons';

interface BatchExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BatchExportModal: React.FC<BatchExportModalProps> = ({ isOpen, onClose }) => {
  const { programs, password } = useAdmin();
  const [exportProgramId, setExportProgramId] = useState('');
  const [exportStatus, setExportStatus] = useState('');
  const [exportType, setExportType] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  if (!isOpen) return null;

  const handleExportCSV = async () => {
    try {
      setIsExporting(true);
      const res = await registrationsApi.getSubmissions({
        programId: exportProgramId,
        status: exportStatus,
        limit: 5000
      });

      const list = res.submissions || [];
      if (list.length === 0) {
        alert('No records found for the selected export filters.');
        return;
      }

      const rows = [
        ['Token ID', 'Husband Name', 'Wife Name', 'Surname', 'Phone Number', 'Program Slot', 'Program Date', 'Status', 'Attendance'],
        ...list.map((s) => [
          s.inquiryId,
          `"${(s.husbandName || '').replace(/"/g, '""')}"`,
          `"${(s.wifeName || '').replace(/"/g, '""')}"`,
          `"${(s.surname || '').replace(/"/g, '""')}"`,
          `'${s.phoneNumber}`,
          `"${(s.programName || '').replace(/"/g, '""')}"`,
          s.programDate || '',
          s.status || 'pending',
          s.attendance || 'unmarked'
        ])
      ];

      const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((r) => r.join(',')).join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `registrations_export_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      alert('Error exporting CSV: ' + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPDF = async () => {
    try {
      setIsExporting(true);
      const res = await registrationsApi.getSubmissions({
        programId: exportProgramId,
        status: exportStatus,
        limit: 5000
      });

      const list: Submission[] = res.submissions || [];
      if (list.length === 0) {
        alert('No records found for the selected filters.');
        return;
      }

      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        alert('Pop-up blocked. Please allow pop-ups for this site.');
        return;
      }

      const progName = exportProgramId
        ? programs.find((p) => p.id === exportProgramId)?.name || exportProgramId
        : 'All Programs';

      const rowsHtml = list
        .map(
          (s, idx) => `
        <tr style="border-bottom: 1px solid #ddd; height: 18px;">
          <td style="padding: 3px; text-align: center; border: 1px solid #ddd;">${idx + 1}</td>
          <td style="padding: 3px; font-weight: bold; border: 1px solid #ddd; color: #be123c;">${s.inquiryId}</td>
          <td style="padding: 3px; border: 1px solid #ddd;">${s.husbandName} & ${s.wifeName} ${s.surname}</td>
          <td style="padding: 3px; text-align: center; border: 1px solid #ddd; font-family: monospace;">${s.phoneNumber}</td>
          <td style="padding: 3px; text-align: center; border: 1px solid #ddd; text-transform: uppercase; font-size: 9px;">${s.status}</td>
        </tr>
      `
        )
        .join('');

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Ek Duje Ke Liye - Registrations List</title>
          <style>
            body { font-family: Arial, sans-serif; font-size: 11px; margin: 20px; color: #111; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th { background-color: #f1f5f9; font-weight: bold; padding: 6px; border: 1px solid #cbd5e1; font-size: 10px; text-transform: uppercase; }
            @media print { button { display: none; } }
          </style>
        </head>
        <body>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <h2 style="margin: 0; color: #881337;">Ek Duje Ke Liye &bull; Registrations Report</h2>
              <p style="margin: 4px 0 0 0; color: #64748b; font-size: 10px;">Program: ${progName} | Total Records: ${list.length}</p>
            </div>
            <button onclick="window.print()" style="padding: 6px 12px; background-color: #059669; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer;">
              Print / Save PDF
            </button>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width: 40px;">#</th>
                <th style="width: 90px;">Token ID</th>
                <th>Couple Name</th>
                <th style="width: 110px;">Phone Number</th>
                <th style="width: 80px;">Status</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </body>
        </html>
      `);
      printWindow.document.close();
    } catch (err: any) {
      alert('Error generating print view: ' + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fade-in overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-lg w-full p-4 sm:p-6 shadow-2xl space-y-5 border border-slate-200 my-auto">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3 sm:pb-4">
          <h2 className="text-base sm:text-lg font-extrabold text-slate-900 flex items-center gap-2">
            <DownloadIcon className="w-5 h-5 text-rose-600 flex-shrink-0" />
            <span>Batch Export Center</span>
          </h2>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-full font-bold cursor-pointer transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Select Program Slot
            </label>
            <select
              value={exportProgramId}
              onChange={(e) => setExportProgramId(e.target.value)}
              className="w-full px-3 py-2.5 min-h-[42px] bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs sm:text-sm font-semibold focus:outline-none focus:border-rose-500 cursor-pointer"
            >
              <option value="">All Programs (બધા પ્રોગ્રામ)</option>
              {programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.date})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Status Filter
            </label>
            <select
              value={exportStatus}
              onChange={(e) => setExportStatus(e.target.value)}
              className="w-full px-3 py-2.5 min-h-[42px] bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs sm:text-sm font-semibold focus:outline-none focus:border-rose-500 cursor-pointer"
            >
              <option value="">All Statuses</option>
              <option value="approved">Approved Only</option>
              <option value="pending">Pending Only</option>
              <option value="rejected">Rejected Only</option>
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <button
              onClick={handleExportCSV}
              disabled={isExporting}
              className="w-full py-3 min-h-[44px] bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer transition-all flex items-center justify-center"
            >
              {isExporting ? 'Exporting...' : 'Export as CSV'}
            </button>
            <button
              onClick={handleExportPDF}
              disabled={isExporting}
              className="w-full py-3 min-h-[44px] bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer transition-all flex items-center justify-center"
            >
              {isExporting ? 'Generating...' : 'Print / Save PDF'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
