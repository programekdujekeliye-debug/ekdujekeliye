export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== 'undefined'
    ? (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:5001'
        : '')
    : (process.env.NODE_ENV === 'development'
        ? 'http://localhost:5001'
        : 'https://ekdujekeliye-s9fx.onrender.com'));

