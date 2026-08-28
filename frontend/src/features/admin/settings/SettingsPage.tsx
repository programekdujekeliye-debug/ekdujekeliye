'use client';

import React, { useState, useEffect } from 'react';
import { settingsApi } from '../../../services/admin/settingsApi';
import { ManualInviteeModal } from './ManualInviteeModal';
import {
  CreditCardIcon,
  PhoneIcon,
  LayersIcon,
  CheckIcon,
  AlertTriangleIcon
} from '../../../components/Icons';

type SettingsTab = 'payment' | 'brand_support' | 'social' | 'defaults';

export const SettingsPage = () => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('payment');

  // Form State
  const [upiId, setUpiId] = useState('');
  const [payeeName, setPayeeName] = useState('');
  const [amount, setAmount] = useState<number>(1500);
  const [upiIds, setUpiIds] = useState('');
  const [upiLimit, setUpiLimit] = useState<number>(50);

  const [brandName, setBrandName] = useState('Ek Duje Ke Liye');
  const [businessCategory, setBusinessCategory] = useState('Education & Training');
  const [businessDescription, setBusinessDescription] = useState('Relationship Education, Couple Communication, Life Skills Training and Educational Seminars/Workshops');
  const [supportPhone, setSupportPhone] = useState('');
  const [supportWhatsapp, setSupportWhatsapp] = useState('');
  const [supportEmail, setSupportEmail] = useState('');
  const [websiteEmail, setWebsiteEmail] = useState('');

  const [instagramUrl, setInstagramUrl] = useState('');
  const [facebookUrl, setFacebookUrl] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [linktreeUrl, setLinktreeUrl] = useState('');

  const [defaultCity, setDefaultCity] = useState('Surat');
  const [defaultCountry, setDefaultCountry] = useState('India');
  const [defaultCurrency, setDefaultCurrency] = useState('INR');
  const [defaultPrice, setDefaultPrice] = useState<number>(1500);
  const [defaultSpeakerName, setDefaultSpeakerName] = useState('Manish Vaghasiya');
  const [defaultSpeakerTitle, setDefaultSpeakerTitle] = useState('Couple Relationship Counselor & Life Coach');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const data = await settingsApi.getSettings();
      if (data) {
        setUpiId(data.upiId || '');
        setPayeeName(data.payeeName || 'Ek Duje Ke Liye');
        setAmount(Number(data.amount) || 1500);
        setUpiIds(Array.isArray(data.upiIds) ? data.upiIds.join(', ') : (data.upiIds || data.upiId || ''));
        setUpiLimit(data.upiLimit || 50);

        setBrandName(data.brandName || 'Ek Duje Ke Liye');
        setBusinessCategory(data.businessCategory || 'Education & Training');
        setBusinessDescription(data.businessDescription || 'Relationship Education, Couple Communication, Life Skills Training and Educational Seminars/Workshops');
        setSupportPhone(data.supportPhone || '');
        setSupportWhatsapp(data.supportWhatsapp || '');
        setSupportEmail(data.supportEmail || '');
        setWebsiteEmail(data.websiteEmail || '');

        setInstagramUrl(data.instagramUrl || '');
        setFacebookUrl(data.facebookUrl || '');
        setYoutubeUrl(data.youtubeUrl || '');
        setLinktreeUrl(data.linktreeUrl || '');

        setDefaultCity(data.defaultCity || 'Surat');
        setDefaultCountry(data.defaultCountry || 'India');
        setDefaultCurrency(data.defaultCurrency || 'INR');
        setDefaultPrice(data.defaultPrice || 1500);
        setDefaultSpeakerName(data.defaultSpeakerName || 'Manish Vaghasiya');
        setDefaultSpeakerTitle(data.defaultSpeakerTitle || 'Couple Relationship Counselor & Life Coach');
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setSubmitting(true);
      setError('');
      setSuccess('');
      await settingsApi.updateSettings({
        upiId,
        payeeName,
        amount,
        upiIds: upiIds.split(',').map((s) => s.trim()).filter(Boolean),
        upiLimit,
        brandName,
        businessCategory,
        businessDescription,
        supportPhone,
        supportWhatsapp,
        supportEmail,
        websiteEmail,
        instagramUrl,
        facebookUrl,
        youtubeUrl,
        linktreeUrl,
        defaultCity,
        defaultCountry,
        defaultCurrency,
        defaultPrice,
        defaultSpeakerName,
        defaultSpeakerTitle
      });
      setSuccess('Global configuration updated successfully.');
    } catch (err: any) {
      setError(err.message || 'Failed to update settings.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white border border-slate-200 shadow-xs rounded-2xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <LayersIcon className="w-5 h-5 text-rose-600 flex-shrink-0" />
              <span>Global Brand &amp; Business Configuration</span>
            </h2>
            <p className="text-slate-500 text-xs mt-0.5">
              Control global defaults, public support channels, social links, and UPI account rotation in MongoDB.
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 mt-5 overflow-x-auto gap-2">
          {[
            { id: 'payment', label: '1. Payment & UPI Rotation' },
            { id: 'brand_support', label: '2. Brand & Support Contacts' },
            { id: 'social', label: '3. Social Media Links' },
            { id: 'defaults', label: '4. Business Defaults' }
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id as SettingsTab)}
              className={`py-2.5 px-3.5 text-xs font-bold whitespace-nowrap border-b-2 transition-all cursor-pointer ${
                activeTab === t.id
                  ? 'border-rose-600 text-rose-700 bg-rose-50/50 rounded-t-lg'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-3.5 text-xs bg-rose-50 border border-rose-200 text-rose-800 rounded-xl font-bold flex items-center gap-2">
          <AlertTriangleIcon className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-3.5 text-xs bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl font-bold flex items-center gap-2">
          <CheckIcon className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Main Settings Form */}
      <form onSubmit={handleUpdate} className="bg-white border border-slate-200 shadow-xs rounded-2xl p-5 sm:p-6 space-y-6">
        {/* Tab 1: Payment & UPI Rotation */}
        {activeTab === 'payment' && (
          <div className="space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <CreditCardIcon className="w-4 h-4 text-rose-600" />
              <span>UPI Rotation &amp; Offline Payment Routing</span>
            </h3>
            <p className="text-xs text-slate-500">
              Configure dynamic UPI ID list for automatic round-robin load distribution.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  UPI ID List (Comma separated)
                </label>
                <input
                  type="text"
                  required
                  value={upiIds}
                  onChange={(e) => {
                    setUpiIds(e.target.value);
                    const first = e.target.value.split(',')[0]?.trim();
                    if (first) setUpiId(first);
                  }}
                  placeholder="upi1@okaxis, upi2@okicici"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs focus:bg-white focus:outline-none focus:border-rose-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Active UPI ID
                </label>
                <input
                  type="text"
                  required
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  placeholder="payee@upi"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs focus:bg-white focus:outline-none focus:border-rose-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Rotation Limit (Registrations / UPI)
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={upiLimit}
                  onChange={(e) => setUpiLimit(Number(e.target.value))}
                  placeholder="50"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs focus:bg-white focus:outline-none focus:border-rose-500 font-medium"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Payee Account Name
                </label>
                <input
                  type="text"
                  required
                  value={payeeName}
                  onChange={(e) => setPayeeName(e.target.value)}
                  placeholder="Ek Duje Ke Liye"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs focus:bg-white focus:outline-none focus:border-rose-500 font-medium"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Default Fallback Fee (₹)
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  placeholder="1500"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs focus:bg-white focus:outline-none focus:border-rose-500 font-medium"
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Brand & Support Contacts */}
        {activeTab === 'brand_support' && (
          <div className="space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <PhoneIcon className="w-4 h-4 text-rose-600" />
              <span>Public Brand Identity &amp; Support Channels</span>
            </h3>
            <p className="text-xs text-slate-500">
              These details are broadcasted to the public website footer, helpline widgets, and fallback emails.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Brand Name
                </label>
                <input
                  type="text"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  placeholder="Ek Duje Ke Liye"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs focus:bg-white focus:outline-none focus:border-rose-500 font-medium"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Business Category
                </label>
                <input
                  type="text"
                  value={businessCategory}
                  onChange={(e) => setBusinessCategory(e.target.value)}
                  placeholder="Education & Training"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs focus:bg-white focus:outline-none focus:border-rose-500 font-medium"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Business Description
                </label>
                <input
                  type="text"
                  value={businessDescription}
                  onChange={(e) => setBusinessDescription(e.target.value)}
                  placeholder="Relationship Education, Couple Communication, Life Skills Training and Educational Seminars/Workshops"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs focus:bg-white focus:outline-none focus:border-rose-500 font-medium"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Helpline Support Phone
                </label>
                <input
                  type="tel"
                  value={supportPhone}
                  onChange={(e) => setSupportPhone(e.target.value)}
                  placeholder="+91 98251 00000"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs focus:bg-white focus:outline-none focus:border-rose-500 font-medium"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Support WhatsApp Number
                </label>
                <input
                  type="tel"
                  value={supportWhatsapp}
                  onChange={(e) => setSupportWhatsapp(e.target.value)}
                  placeholder="+91 98251 00000"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs focus:bg-white focus:outline-none focus:border-rose-500 font-medium"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Public Support Email
                </label>
                <input
                  type="email"
                  value={supportEmail}
                  onChange={(e) => setSupportEmail(e.target.value)}
                  placeholder="support@ekdujekeliye.in"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs focus:bg-white focus:outline-none focus:border-rose-500 font-medium"
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Social Media Links */}
        {activeTab === 'social' && (
          <div className="space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <LayersIcon className="w-4 h-4 text-rose-600" />
              <span>Official Social Media &amp; Profiles</span>
            </h3>
            <p className="text-xs text-slate-500">
              Links shown on public website footer and registration confirmation pages.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Instagram URL
                </label>
                <input
                  type="url"
                  value={instagramUrl}
                  onChange={(e) => setInstagramUrl(e.target.value)}
                  placeholder="https://instagram.com/ekdujekeliye01"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs focus:bg-white focus:outline-none focus:border-rose-500 font-medium"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Linktree URL
                </label>
                <input
                  type="url"
                  value={linktreeUrl}
                  onChange={(e) => setLinktreeUrl(e.target.value)}
                  placeholder="https://linktr.ee/ekdujekeliye"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs focus:bg-white focus:outline-none focus:border-rose-500 font-medium"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Facebook URL (Optional)
                </label>
                <input
                  type="url"
                  value={facebookUrl}
                  onChange={(e) => setFacebookUrl(e.target.value)}
                  placeholder="https://facebook.com/..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs focus:bg-white focus:outline-none focus:border-rose-500 font-medium"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  YouTube Channel URL (Optional)
                </label>
                <input
                  type="url"
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  placeholder="https://youtube.com/@..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs focus:bg-white focus:outline-none focus:border-rose-500 font-medium"
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Business Defaults */}
        {activeTab === 'defaults' && (
          <div className="space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <LayersIcon className="w-4 h-4 text-rose-600" />
              <span>Event System Defaults</span>
            </h3>
            <p className="text-xs text-slate-500">
              Default values used when creating new events or rendering global fallbacks.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Default City
                </label>
                <input
                  type="text"
                  value={defaultCity}
                  onChange={(e) => setDefaultCity(e.target.value)}
                  placeholder="Surat"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs focus:bg-white focus:outline-none focus:border-rose-500 font-medium"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Default Event Fee (₹)
                </label>
                <input
                  type="number"
                  value={defaultPrice}
                  onChange={(e) => setDefaultPrice(Number(e.target.value))}
                  placeholder="1500"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs focus:bg-white focus:outline-none focus:border-rose-500 font-medium"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Default Speaker / Host Name
                </label>
                <input
                  type="text"
                  value={defaultSpeakerName}
                  onChange={(e) => setDefaultSpeakerName(e.target.value)}
                  placeholder="Manish Vaghasiya"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs focus:bg-white focus:outline-none focus:border-rose-500 font-medium"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Default Speaker Title
                </label>
                <input
                  type="text"
                  value={defaultSpeakerTitle}
                  onChange={(e) => setDefaultSpeakerTitle(e.target.value)}
                  placeholder="Couple Relationship Counselor & Life Coach"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs focus:bg-white focus:outline-none focus:border-rose-500 font-medium"
                />
              </div>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <div className="pt-4 border-t border-slate-200 flex items-center justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="w-full sm:w-auto px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-rose-600/20 cursor-pointer disabled:opacity-50"
          >
            {submitting ? 'Saving Configuration...' : 'Save Global Settings'}
          </button>
        </div>
      </form>

      {/* Manual Invitee Modal Component */}
      <ManualInviteeModal />
    </div>
  );
};
