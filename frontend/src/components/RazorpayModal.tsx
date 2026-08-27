'use client';

/**
 * Utility to dynamically load the Razorpay Standard Checkout SDK script
 */
export const loadRazorpayScript = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      return resolve(false);
    }
    if ((window as any).Razorpay) {
      return resolve(true);
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

export interface RazorpayOptions {
  keyId: string;
  orderId: string;
  amount: number; // in paise
  currency?: string;
  name?: string;
  description?: string;
  prefill?: {
    name?: string;
    contact?: string;
    email?: string;
  };
  notes?: Record<string, string>;
  onSuccess: (response: {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }) => void;
  onFailure?: (error: any) => void;
  onDismiss?: () => void;
}

/**
 * Open Razorpay Standard Checkout modal
 */
export const openRazorpayModal = async (options: RazorpayOptions): Promise<boolean> => {
  const isLoaded = await loadRazorpayScript();
  if (!isLoaded || !(window as any).Razorpay) {
    alert('Failed to load Razorpay Checkout SDK. Please check your internet connection and try again.');
    return false;
  }

  const razorpayOptions = {
    key: options.keyId || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || '',
    amount: options.amount,
    currency: options.currency || 'INR',
    name: options.name || 'Ek Duje Ke Liye',
    description: options.description || 'Couple Event Registration Pass',
    image: '/logo.png',
    order_id: options.orderId,
    prefill: {
      name: options.prefill?.name || '',
      contact: options.prefill?.contact || '',
      email: options.prefill?.email || ''
    },
    notes: options.notes || {},
    theme: {
      color: '#f43f5e' // Rose-500 luxury accent
    },
    modal: {
      ondismiss: () => {
        if (options.onDismiss) {
          options.onDismiss();
        }
      }
    },
    handler: (response: any) => {
      if (options.onSuccess) {
        options.onSuccess({
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_order_id: response.razorpay_order_id,
          razorpay_signature: response.razorpay_signature
        });
      }
    }
  };

  try {
    const rzp = new (window as any).Razorpay(razorpayOptions);
    rzp.on('payment.failed', (response: any) => {
      console.error('[Razorpay Checkout Error]:', response.error);
      if (options.onFailure) {
        options.onFailure(response.error);
      }
    });
    rzp.open();
    return true;
  } catch (err) {
    console.error('Error opening Razorpay modal:', err);
    if (options.onFailure) {
      options.onFailure(err);
    }
    return false;
  }
};
