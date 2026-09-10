/**
 * Standardized Date Formatting Utilities for Ek Duje Ke Liye Frontend
 * Formats all dates to DD-MM-YYYY across passes, event cards, tickets, and tables.
 */

/**
 * Formats any date string (ISO YYYY-MM-DD or timestamp) into DD-MM-YYYY
 * @param dateInput - Date string or Date object
 * @param separator - Default '-' (e.g. 11-09-2026) or '/' (e.g. 11/09/2026)
 * @returns string in DD-MM-YYYY format
 */
export function formatToDDMMYYYY(dateInput?: string | Date | null, separator: '-' | '/' = '-'): string {
  if (!dateInput) return '';
  const str = String(dateInput).trim();
  if (str.toUpperCase() === 'TBD' || str.toUpperCase() === 'TBA') {
    return 'તારીખ ટૂંક સમયમાં (TBD)';
  }

  // Already DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    return `${day}${separator}${month}${separator}${year}`;
  }

  // ISO YYYY-MM-DD
  const ymdMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (ymdMatch) {
    const year = ymdMatch[1];
    const month = ymdMatch[2].padStart(2, '0');
    const day = ymdMatch[3].padStart(2, '0');
    return `${day}${separator}${month}${separator}${year}`;
  }

  try {
    const d = new Date(dateInput);
    if (!isNaN(d.getTime())) {
      const utcMs = d.getTime() + (d.getTimezoneOffset() * 60 * 1000);
      const istDate = new Date(utcMs + (5.5 * 60 * 60 * 1000));
      const day = String(istDate.getDate()).padStart(2, '0');
      const month = String(istDate.getMonth() + 1).padStart(2, '0');
      const year = istDate.getFullYear();
      return `${day}${separator}${month}${separator}${year}`;
    }
  } catch (_) {}

  return str;
}

/**
 * Format Indian date with DD-MM-YYYY and readable month
 * Example: 11-09-2026 (11 September 2026)
 */
export function formatIndianDate(dateStr?: string | null): string {
  if (!dateStr || dateStr.toLowerCase() === 'tbd') return 'તારીખ ટૂંક સમયમાં (TBD)';
  const dmy = formatToDDMMYYYY(dateStr, '-');
  if (dmy.includes('TBD')) return dmy;

  const parts = dmy.split('-');
  if (parts.length === 3) {
    const [day, month, year] = parts;
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const monthName = months[parseInt(month, 10) - 1] || month;
    return `${day}-${month}-${year} (${day} ${monthName} ${year})`;
  }
  return dateStr;
}
