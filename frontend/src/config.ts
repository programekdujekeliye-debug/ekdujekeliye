export const API_BASE_URL =
  process.env.NEXT_PUBLIC_FORCE_DIRECT_API === 'true'
    ? (process.env.NEXT_PUBLIC_API_URL || 'https://ekdujekeliye-s9fx.onrender.com')
    : (typeof window !== 'undefined'
        ? '' // Same-origin in browser: eliminates CORS preflight latency & uses HTTP/2 multiplexing via Next.js rewrites
        : (process.env.NEXT_PUBLIC_API_URL ||
           (process.env.NODE_ENV === 'development'
             ? 'http://localhost:5001'
             : 'https://ekdujekeliye-s9fx.onrender.com')));
