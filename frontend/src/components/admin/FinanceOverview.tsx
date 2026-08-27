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

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(r => r.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `financial_summary_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white border border-slate-200 p-6 rounded-2xl shadow-xs">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2.5">
            <DollarSignIcon className="w-5 h-5 text-emerald-600" />
            Financial Ledger &amp; Revenue Overview
          </h2>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Authoritative revenue calculations computed directly from verified registration records and payment transactions.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCSV}
            disabled={!data}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-2 cursor-pointer transition-all"
          >
            <DownloadIcon className="w-4 h-4" />
            <span>Export Finance CSV</span>
          </button>
          <button
            onClick={fetchFinance}
            disabled={loading}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all cursor-pointer"
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
        <div className="p-6 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-xs font-bold">
          {error}
        </div>
      ) : data ? (
        <>
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-6 bg-white border border-slate-200 rounded-2xl space-y-2 shadow-xs">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Gross Revenue</span>
              <span className="text-3xl font-extrabold text-emerald-600 block">₹{data.grossRevenue.toLocaleString('en-IN')}</span>
              <span className="text-[11px] text-slate-500 font-medium block">From {data.totalTransactions} registered couples</span>
            </div>

            <div className="p-6 bg-white border border-slate-200 rounded-2xl space-y-2 shadow-xs">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Net Revenue</span>
              <span className="text-3xl font-extrabold text-slate-900 block">₹{data.netRevenue.toLocaleString('en-IN')}</span>
              <span className="text-[11px] text-slate-500 font-medium block">After ₹{data.totalRefunds} refunds</span>
            </div>

            <div className="p-6 bg-white border border-slate-200 rounded-2xl space-y-2 shadow-xs">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Average Ticket</span>
              <span className="text-3xl font-extrabold text-amber-600 block">₹{data.averageTicketValue.toLocaleString('en-IN')}</span>
              <span className="text-[11px] text-slate-500 font-medium block">Per registered couple pass</span>
            </div>

            <div className="p-6 bg-white border border-slate-200 rounded-2xl space-y-2 shadow-xs">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Pending Collections</span>
              <span className="text-3xl font-extrabold text-slate-600 block">₹{data.pendingAmount.toLocaleString('en-IN')}</span>
              <span className="text-[11px] text-slate-500 font-medium block">{data.pendingTransactionsCount} unconfirmed reservations</span>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
};
