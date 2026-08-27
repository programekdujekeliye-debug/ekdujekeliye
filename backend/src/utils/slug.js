export const generateEventSlug = (name, city, date) => {
  const base = `${city || name || 'event'}-${date || ''}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || `event-${Date.now()}`;
};
