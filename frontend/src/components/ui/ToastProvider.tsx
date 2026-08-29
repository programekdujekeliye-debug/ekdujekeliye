'use client';

import React from 'react';
import { Toaster } from 'react-hot-toast';

export const ToastProvider = () => {
  return (
    <Toaster
      position="top-right"
      reverseOrder={false}
      gutter={8}
      toastOptions={{
        duration: 4000,
        style: {
          background: 'rgba(255, 255, 255, 0.96)',
          backdropFilter: 'blur(8px)',
          color: '#0f172a',
          borderRadius: '16px',
          padding: '12px 18px',
          fontSize: '13px',
          fontWeight: '600',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
          border: '1px solid #e2e8f0',
          maxWidth: '420px',
        },
        success: {
          duration: 3500,
          style: {
            border: '1px solid #a7f3d0',
            background: '#ffffff',
            color: '#065f46',
          },
          iconTheme: {
            primary: '#059669',
            secondary: '#ecfdf5',
          },
        },
        error: {
          duration: 5000,
          style: {
            border: '1px solid #fecdd3',
            background: '#ffffff',
            color: '#9f1239',
          },
          iconTheme: {
            primary: '#e11d48',
            secondary: '#fff1f2',
          },
        },
        loading: {
          style: {
            border: '1px solid #cbd5e1',
            background: '#ffffff',
            color: '#334155',
          },
        },
      }}
    />
  );
};
