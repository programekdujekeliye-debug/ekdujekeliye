'use client';

import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../../config';
import { DollarSignIcon, DownloadIcon, RefreshCwIcon } from '../Icons';

interface FinanceData {
  grossRevenue: number;
  totalRefunds: number;
  netRevenue: number;
  totalTransactions: number;
  averageTicketValue: number;
  pendingTransactionsCount: number;
  pendingAmount: number;
  eventBreakdown?: Array<{
    eventId: string;
    name: string;
    date: string;
    city: string;
    price: number;
    paidRegistrations: number;
    grossRevenue: number;
    refunds: number;
    netRevenue: number;
  }>;
}

export const FinanceOverview = ({ authPassword, selectedProgramId }: { authPassword: string; selectedProgramId?: string }) => {
  const [data, setData] = useState<FinanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFinance = async () => {
    try {
      setLoading(true);
      setError(null);
      const url = selectedProgramId && selectedProgramId !== 'all'
        ? `${API_BASE_URL}/api/finance/overview?programId=${encodeURIComponent(selectedProgramId)}`
        : `${API_BASE_URL}/api/finance/overview`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${authPassword}` }
      });
      if (!res.ok) throw new Error('Failed to load financial records.');
      const result = await res.json();
      const raw = result.summary || result;

      const gross = raw.totalCapturedRevenue ?? raw.grossRevenue ?? 0;
      const refunds = raw.totalRefunds ?? 0;
      const net = raw.netRevenue ?? (gross - refunds);
      const couples = raw.approvedCouples ?? raw.totalTransactions ?? 0;
      const avg = couples > 0 ? Math.round(gross / couples) : 1500;
      const pendingVal = raw.pendingExpectedValue ?? raw.pendingAmount ?? 0;
      const pendingCouples = raw.pendingCouples ?? raw.pendingTransactionsCount ?? 0;

      setData({
        grossRevenue: gross,
        totalRefunds: refunds,
        netRevenue: net,
        totalTransactions: couples,
        averageTicketValue: avg,
        pendingTransactionsCount: pendingCouples,
        pendingAmount: pendingVal,
        eventBreakdown: raw.eventBreakdown || []
      });
    } catch (err: any) {
      setError(err.message || 'Error fetching financial summary.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFinance();
  }, [authPassword, selectedProgramId]);

  const handleExportCSV = () => {
    if (!data) return;
    const rows = [
      ['Metric', 'Value'],
      ['Gross Revenue (INR)', data.grossRevenue],
      ['Total Refunds (INR)', data.totalRefunds],
      ['Net Revenue (INR)', data.netRevenue],
      ['Paid Registered Couples', data.totalTransactions],
      ['Average Ticket Value (INR)', data.averageTicketValue],
      ['Pending Expected Value (INR)', data.pendingAmount],
      ['Pending Registrations Count', data.pendingTransactionsCount]
    ];

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + rows.map(r => r.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `financial_summary_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = () => {
    if (!data) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Pop-up blocked. Please allow pop-ups for this site to view the financial statement.');
      return;
    }

    const breakdownRows = (data.eventBreakdown || [])
      .map(
        (ev, idx) => `
      <tr style="border-bottom: 1px solid #e2e8f0; height: 22px;">
        <td style="padding: 5px 8px; text-align: center; border: 1px solid #cbd5e1; font-size: 10px;">${idx + 1}</td>
        <td style="padding: 5px 8px; border: 1px solid #cbd5e1; font-size: 11px; font-weight: bold;">${ev.name}</td>
        <td style="padding: 5px 8px; text-align: center; border: 1px solid #cbd5e1; font-size: 10px;">${ev.date} (${ev.city})</td>
        <td style="padding: 5px 8px; text-align: center; border: 1px solid #cbd5e1; font-size: 10px;">₹${ev.price}</td>
        <td style="padding: 5px 8px; text-align: center; border: 1px solid #cbd5e1; font-weight: bold; font-size: 10px;">${ev.paidRegistrations}</td>
        <td style="padding: 5px 8px; text-align: right; border: 1px solid #cbd5e1; font-weight: bold; font-size: 10px; color: #059669;">₹${ev.grossRevenue.toLocaleString('en-IN')}</td>
      </tr>
    `
      )
      .join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Ek Duje Ke Liye - Financial Revenue Statement</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; font-size: 11px; margin: 20px; color: #0f172a; }
          table { width: 100%; border-collapse: collapse; margin-top: 14px; }
          th { background-color: #f8fafc; font-weight: bold; padding: 6px 8px; border: 1px solid #cbd5e1; font-size: 10px; text-transform: uppercase; }
          .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 16px; }
          .kpi-card { border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px; background: #f8fafc; }
          .kpi-label { font-size: 9px; text-transform: uppercase; font-weight: bold; color: #64748b; }
          .kpi-value { font-size: 18px; font-weight: 800; color: #0f172a; margin-top: 2px; }
          @media print { button { display: none; } }
        </style>
      </head>
      <body>
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #059669; padding-bottom: 8px;">
          <div>
            <h2 style="margin: 0; color: #065f46; font-size: 18px;">Ek Duje Ke Liye &bull; Financial Revenue Statement</h2>
            <p style="margin: 3px 0 0 0; color: #475569; font-size: 11px;">Authoritative Payment Ledger Statement &bull; Generated: ${new Date().toLocaleDateString()}</p>
          </div>
          <button onclick="window.print()" style="padding: 8px 16px; background-color: #059669; color: white; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 12px;">
            Print / Save as PDF
          </button>
        </div>

        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-label">Gross Revenue</div>
            <div class="kpi-value" style="color: #059669;">₹${data.grossRevenue.toLocaleString('en-IN')}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Paid Registered Couples</div>
            <div class="kpi-value">${data.totalTransactions} Couples</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Average Ticket Value</div>
            <div class="kpi-value">₹${data.averageTicketValue.toLocaleString('en-IN')}</div>
          </div>
        </div>

        ${data.eventBreakdown && data.eventBreakdown.length > 0 ? `
          <h3 style="margin: 20px 0 6px 0; font-size: 12px; text-transform: uppercase; color: #334155;">Revenue Breakdown by Seminar Batch</h3>
          <table>
            <thead>
              <tr>
                <th style="width: 30px;">#</th>
                <th>Seminar Batch</th>
                <th style="width: 130px;">Date & City</th>
                <th style="width: 70px;">Ticket Fee</th>
                <th style="width: 80px;">Paid Couples</th>
                <th style="width: 100px; text-align: right;">Gross Total</th>
              </tr>
            </thead>
            <tbody>${breakdownRows}</tbody>
          </table>
        ` : ''}
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 bg-white border border-slate-200 p-4 sm:p-5 lg:p-6 rounded-2xl shadow-xs min-w-0 w-full">
        <div className="min-w-0 flex-1 w-full">
          <h2 className="text-base sm:text-lg md:text-xl font-extrabold text-slate-900 flex flex-wrap items-center gap-2 leading-tight break-words">
            <DollarSignIcon className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <span>Financial Ledger &amp; Revenue Overview</span>
          </h2>
          <p className="text-[11px] sm:text-xs text-slate-500 mt-1 font-medium leading-normal break-words">
            Authoritative revenue calculations computed directly from verified registration records.
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={handleExportCSV}
            disabled={!data}
            className="flex-1 sm:flex-none px-3.5 py-2.5 min-h-[40px] bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 disabled:opacity-50 font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all whitespace-nowrap"
            title="Export Financial Ledger to Excel (.csv)"
          >
            <DownloadIcon className="w-4 h-4 text-emerald-700 flex-shrink-0" />
            <span>Export Excel</span>
          </button>
          <button
            onClick={handleExportPDF}
            disabled={!data}
            className="flex-1 sm:flex-none px-3.5 py-2.5 min-h-[40px] bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 disabled:opacity-50 font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all whitespace-nowrap"
            title="Export / Print Financial Revenue Statement (PDF)"
          >
            <DownloadIcon className="w-4 h-4 text-slate-700 flex-shrink-0" />
            <span>Export PDF</span>
          </button>
          <button
            onClick={fetchFinance}
            disabled={loading}
            className="p-2.5 min-h-[40px] min-w-[40px] bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all cursor-pointer flex items-center justify-center border border-slate-200"
            title="Refresh Finance Data"
          >
            <RefreshCwIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {loading && !data ? (
        <div className="p-12 text-center text-slate-500 font-medium text-xs">
          Computing financial analytics from payment ledger...
        </div>
      ) : error ? (
        <div className="p-4 sm:p-6 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-xs font-bold">
          {error}
        </div>
      ) : data ? (
        <>
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-5 lg:gap-6">
            <div className="p-4 sm:p-5 lg:p-6 bg-white border border-slate-200 rounded-2xl space-y-1 shadow-xs">
              <span className="text-[11px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider block">Gross Revenue</span>
              <span className="text-2xl sm:text-3xl font-extrabold text-emerald-600 block truncate">₹{data.grossRevenue.toLocaleString('en-IN')}</span>
              <span className="text-[10px] sm:text-[11px] text-slate-500 font-medium block truncate">From {data.totalTransactions} registered couples</span>
            </div>

            <div className="p-4 sm:p-5 lg:p-6 bg-white border border-slate-200 rounded-2xl space-y-1 shadow-xs">
              <span className="text-[11px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider block">Net Revenue</span>
              <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 block truncate">₹{data.netRevenue.toLocaleString('en-IN')}</span>
              <span className="text-[10px] sm:text-[11px] text-slate-500 font-medium block truncate">After ₹{data.totalRefunds} refunds</span>
            </div>

            <div className="p-4 sm:p-5 lg:p-6 bg-white border border-slate-200 rounded-2xl space-y-1 shadow-xs">
              <span className="text-[11px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider block">Average Ticket</span>
              <span className="text-2xl sm:text-3xl font-extrabold text-amber-600 block truncate">₹{data.averageTicketValue.toLocaleString('en-IN')}</span>
              <span className="text-[10px] sm:text-[11px] text-slate-500 font-medium block truncate">Per registered couple pass</span>
            </div>

            <div className="p-4 sm:p-5 lg:p-6 bg-white border border-slate-200 rounded-2xl space-y-1 shadow-xs">
              <span className="text-[11px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider block">Pending Collections</span>
              <span className="text-2xl sm:text-3xl font-extrabold text-slate-600 block truncate">₹{data.pendingAmount.toLocaleString('en-IN')}</span>
              <span className="text-[10px] sm:text-[11px] text-slate-500 font-medium block truncate">{data.pendingTransactionsCount} unconfirmed reservations</span>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
};
