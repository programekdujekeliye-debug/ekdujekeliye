'use client';

import React, { useState, useEffect } from 'react';
import { whatsappApi } from '../../../services/admin/whatsappApi';
import { WhatsappTemplate } from '../../../types';
import { MessageCircleIcon } from '../../../components/Icons';

export const WhatsAppPage = () => {
  const [tab, setTab] = useState<'pass_delivery' | 'payment_request' | 'photo_delivery'>('pass_delivery');
  const [templates, setTemplates] = useState<WhatsappTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState('');
  const [newText, setNewText] = useState('');

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const data = await whatsappApi.getTemplates();
      setTemplates(data || []);
    } catch (err) {
      console.error('Failed to load templates:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newText) return;

    try {
      await whatsappApi.createTemplate({
        name: newName,
        text: newText,
        type: tab
      });
      setNewName('');
      setNewText('');
      fetchTemplates();
    } catch (err) {
      alert('Failed to create template.');
    }
  };

  const handleActivate = async (id: string) => {
    try {
      await whatsappApi.activateTemplate(id);
      fetchTemplates();
    } catch (err) {
      alert('Failed to activate template.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;
    try {
      await whatsappApi.deleteTemplate(id);
      fetchTemplates();
    } catch (err) {
      alert('Failed to delete template.');
    }
  };

  const filteredTemplates = templates.filter((t) => t.type === tab);

  return (
    <div className="bg-white border border-slate-200/90 shadow-xs rounded-2xl p-4 sm:p-5 lg:p-6 space-y-6 min-w-0 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 min-w-0 w-full">
        <div className="min-w-0 flex-1 w-full">
          <h2 className="text-base sm:text-lg md:text-xl font-extrabold text-slate-900 tracking-tight flex flex-wrap items-center gap-2 leading-tight break-words">
            <MessageCircleIcon className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <span>WhatsApp Message Templates &amp; Automation</span>
          </h2>
          <p className="text-slate-500 text-[11px] sm:text-xs mt-1 font-medium leading-normal break-words">
            Manage message templates sent to users for pass distribution, payment confirmations, and photos.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setTab('pass_delivery')}
            className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer truncate ${
              tab === 'pass_delivery'
                ? 'bg-white text-rose-700 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Pass Delivery
          </button>
          <button
            type="button"
            onClick={() => setTab('payment_request')}
            className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer truncate ${
              tab === 'payment_request'
                ? 'bg-white text-rose-700 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Payment Request
          </button>
          <button
            type="button"
            onClick={() => setTab('photo_delivery')}
            className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer truncate ${
              tab === 'photo_delivery'
                ? 'bg-white text-rose-700 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Photo Delivery
          </button>
        </div>
      </div>

      {/* Add Template Form */}
      <form onSubmit={handleCreate} className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 sm:p-4 space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
          Create New {tab === 'pass_delivery' ? 'Pass Delivery' : tab === 'payment_request' ? 'Payment Request' : 'Photo Delivery'} Template
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 items-end">
          <div className="md:col-span-1">
            <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">Template Name</label>
            <input
              type="text"
              required
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Gujarati Pass Msg"
              className="w-full px-3 py-2.5 min-h-[42px] bg-white border border-slate-300 rounded-xl text-slate-900 text-xs sm:text-sm focus:outline-none focus:border-rose-500 transition-colors"
            />
          </div>

          <div className="md:col-span-2 flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
            <div className="flex-grow">
              <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">Message Text</label>
              <input
                type="text"
                required
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                placeholder="Hello! Download your pass here: {passUrl}"
                className="w-full px-3 py-2.5 min-h-[42px] bg-white border border-slate-300 rounded-xl text-slate-900 text-xs sm:text-sm focus:outline-none focus:border-rose-500 transition-colors"
              />
            </div>
            <button
              type="submit"
              className="px-5 py-2.5 min-h-[42px] bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-700 hover:to-amber-700 text-white font-bold rounded-xl text-xs transition-all shadow-md cursor-pointer whitespace-nowrap"
            >
              Create Template
            </button>
          </div>
        </div>

        {/* Variables Chip list */}
        <div className="text-[10px] text-slate-500 flex flex-wrap items-center gap-1.5">
          <span className="font-bold text-slate-700">Variables:</span>
          {tab === 'pass_delivery' ? (
            <>
              <code className="bg-slate-200/80 px-1.5 py-0.5 rounded">{`{husbandName}`}</code>
              <code className="bg-slate-200/80 px-1.5 py-0.5 rounded">{`{wifeName}`}</code>
              <code className="bg-slate-200/80 px-1.5 py-0.5 rounded">{`{surname}`}</code>
              <code className="bg-slate-200/80 px-1.5 py-0.5 rounded">{`{inquiryId}`}</code>
              <code className="bg-slate-200/80 px-1.5 py-0.5 rounded">{`{passUrl}`}</code>
            </>
          ) : (
            <>
              <code className="bg-slate-200/80 px-1.5 py-0.5 rounded">{`{husbandName}`}</code>
              <code className="bg-slate-200/80 px-1.5 py-0.5 rounded">{`{wifeName}`}</code>
              <code className="bg-slate-200/80 px-1.5 py-0.5 rounded">{`{programName}`}</code>
              <code className="bg-slate-200/80 px-1.5 py-0.5 rounded">{`{photoLink}`}</code>
            </>
          )}
        </div>
      </form>

      {/* Available Templates List */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
          Available Templates ({filteredTemplates.length})
        </h3>

        {filteredTemplates.length === 0 ? (
          <p className="text-xs text-slate-500 italic py-4">No custom templates. The standard template will be used by default.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {filteredTemplates.map((t) => (
              <div
                key={t._id}
                className={`flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 bg-slate-50 border rounded-xl gap-4 ${
                  t.isActive ? 'border-rose-300 bg-rose-50/40' : 'border-slate-200'
                }`}
              >
                <div className="space-y-1 flex-grow">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm">{t.name}</span>
                    {t.isActive && (
                      <span className="px-2 py-0.5 bg-rose-100 text-rose-700 text-[10px] font-bold rounded-full border border-rose-200 uppercase">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 font-mono whitespace-pre-wrap">{t.text}</p>
                </div>

                <div className="flex gap-2 self-end sm:self-center">
                  {!t.isActive && (
                    <button
                      onClick={() => handleActivate(t._id)}
                      className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold border border-emerald-200 cursor-pointer"
                    >
                      Set Active
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(t._id)}
                    className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-xs font-bold border border-red-200 cursor-pointer"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
