'use client';

import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../../config';
import { ShieldCheckIcon, RefreshCwIcon } from '../Icons';

interface IntegrationsData {
  razorpay: {
    name: string;
    configured: boolean;
    webhookConfigured: boolean;
    status: string;
    lastPaymentAt?: string | null;
    lastWebhookAt?: string | null;
  };
  whatsapp: {
    name: string;
    configured: boolean;
    webhookConfigured: boolean;
    status: string;
  };
  cloudinary: {
    name: string;
    configured: boolean;
    status: string;
  };
  googleDrive: {
    name: string;
    configured: boolean;
    status: string;
  };
  mongodb: {
    name: string;
    configured: boolean;
    status: string;
  };
}

export const IntegrationsCenter = ({ authPassword }: { authPassword: string }) => {
  const [data, setData] = useState<IntegrationsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchIntegrations = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE_URL}/api/admin/system/integrations`, {
        headers: { Authorization: `Bearer ${authPassword}` }
      });
      if (!res.ok) throw new Error('Failed to retrieve integrations status.');
      const result = await res.json();
      setData(result.integrations);
    } catch (err: any) {
      setError(err.message || 'Error fetching integrations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIntegrations();
  }, [authPassword]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white border border-slate-200 p-6 rounded-2xl shadow-xs">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2.5">
            <ShieldCheckIcon className="w-5 h-5 text-purple-600" />
            Integrations &amp; Infrastructure Health
          </h2>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Active vendor connections and security status. Raw API secrets and private keys are never exposed.
          </p>
        </div>
        <button
          onClick={fetchIntegrations}
          disabled={loading}
          className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all cursor-pointer"
          title="Refresh Status"
        >
          <RefreshCwIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading && !data ? (
        <div className="p-12 text-center text-slate-500 font-medium text-xs">
          Verifying third-party service connections...
        </div>
      ) : error ? (
        <div className="p-6 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-xs font-bold">
          {error}
        </div>
      ) : data ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Razorpay Gateway */}
          <div className="p-6 bg-white border border-slate-200 rounded-2xl space-y-4 shadow-xs">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Payment Gateway</span>
              <span className="px-2.5 py-1 text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md">
                {data.razorpay.status}
              </span>
            </div>
            <h3 className="text-base font-bold text-slate-900">{data.razorpay.name}</h3>
            <div className="space-y-1.5 text-xs text-slate-600 font-medium border-t border-slate-100 pt-3">
              <div className="flex justify-between">
                <span>Key ID &amp; Secret:</span>
                <span className="font-bold text-emerald-700">{data.razorpay.configured ? 'Configured' : 'Missing'}</span>
              </div>
              <div className="flex justify-between">
                <span>Webhook Signature:</span>
                <span className="font-bold text-emerald-700">{data.razorpay.webhookConfigured ? 'Active (HMAC-SHA256)' : 'Missing'}</span>
              </div>
              {data.razorpay.lastPaymentAt && (
                <div className="flex justify-between">
                  <span>Last Payment:</span>
                  <span>{new Date(data.razorpay.lastPaymentAt).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          </div>

          {/* Meta WhatsApp Cloud API */}
          <div className="p-6 bg-white border border-slate-200 rounded-2xl space-y-4 shadow-xs">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Messaging API</span>
              <span className="px-2.5 py-1 text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md">
                {data.whatsapp.status}
              </span>
            </div>
            <h3 className="text-base font-bold text-slate-900">{data.whatsapp.name}</h3>
            <div className="space-y-1.5 text-xs text-slate-600 font-medium border-t border-slate-100 pt-3">
              <div className="flex justify-between">
                <span>Phone ID &amp; WABA:</span>
                <span className="font-bold text-emerald-700">{data.whatsapp.configured ? 'Configured' : 'Pending Config'}</span>
              </div>
              <div className="flex justify-between">
                <span>Webhook Subscription:</span>
                <span className="font-bold text-emerald-700">{data.whatsapp.webhookConfigured ? 'Verified & Active' : 'Missing'}</span>
              </div>
            </div>
          </div>

          {/* Cloudinary */}
          <div className="p-6 bg-white border border-slate-200 rounded-2xl space-y-4 shadow-xs">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Operational Media</span>
              <span className="px-2.5 py-1 text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md">
                {data.cloudinary.status}
              </span>
            </div>
            <h3 className="text-base font-bold text-slate-900">{data.cloudinary.name}</h3>
            <div className="space-y-1.5 text-xs text-slate-600 font-medium border-t border-slate-100 pt-3">
              <div className="flex justify-between">
                <span>Cloudinary Account:</span>
                <span className="font-bold text-emerald-700">{data.cloudinary.configured ? 'Connected' : 'Missing'}</span>
              </div>
              <div className="flex justify-between">
                <span>Delivery Strategy:</span>
                <span className="font-bold text-slate-800">Direct CDN (Zero-Cost)</span>
              </div>
            </div>
          </div>

          {/* Google Drive Archive */}
          <div className="p-6 bg-white border border-slate-200 rounded-2xl space-y-4 shadow-xs">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Long-Term Storage</span>
              <span className="px-2.5 py-1 text-[10px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200 rounded-md">
                FOUNDATION_READY
              </span>
            </div>
            <h3 className="text-base font-bold text-slate-900">{data.googleDrive.name}</h3>
            <div className="space-y-1.5 text-xs text-slate-600 font-medium border-t border-slate-100 pt-3">
              <div className="flex justify-between">
                <span>Archive Pipeline:</span>
                <span className="font-bold text-blue-700">Google-Side Worker</span>
              </div>
              <div className="flex justify-between">
                <span>Grace Period:</span>
                <span>7 Days Default</span>
              </div>
            </div>
          </div>

          {/* MongoDB Atlas */}
          <div className="p-6 bg-white border border-slate-200 rounded-2xl space-y-4 shadow-xs">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Primary Database</span>
              <span className="px-2.5 py-1 text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md">
                {data.mongodb.status}
              </span>
            </div>
            <h3 className="text-base font-bold text-slate-900">{data.mongodb.name}</h3>
            <div className="space-y-1.5 text-xs text-slate-600 font-medium border-t border-slate-100 pt-3">
              <div className="flex justify-between">
                <span>Connection Pool:</span>
                <span className="font-bold text-emerald-700">10 Max (Render Guardrail)</span>
              </div>
              <div className="flex justify-between">
                <span>Backup Strategy:</span>
                <span className="font-bold text-slate-800">Gzip Compressed Daily</span>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
