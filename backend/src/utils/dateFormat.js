/**
 * Centralized Date Formatting & Normalization Utility
 * Guarantees DD-MM-YYYY presentation across WhatsApp, PDFs, Passes, and UI
 * while preserving safe ISO 8601 sorting/queries in MongoDB.
 */

/**
 * Format any date input (YYYY-MM-DD, Date object, ISO timestamp) into DD-MM-YYYY
 * @param {string|Date|number} dateInput - Raw date string or Date object
 * @param {string} separator - Default '-' (e.g. 11-09-2026) or '/' (e.g. 11/09/2026)
 * @returns {string} Formatted date string in DD-MM-YYYY (or TBD/TBA)
 */
export function formatToDDMMYYYY(dateInput, separator = '-') {
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

  // Date instance or ISO datetime
  try {
    const d = new Date(dateInput);
    if (!isNaN(d.getTime())) {
      // Use IST offset (+05:30) for consistent Indian standard representation
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
 * Normalizes any DD-MM-YYYY, DD/MM/YYYY, or ISO input to standard ISO YYYY-MM-DD
 * Ensures MongoDB string queries and sorting always remain 100% stable.
 * @param {string} dateInput 
 * @returns {string} YYYY-MM-DD or original string if non-standard
 */
export function parseDateToISO(dateInput) {
  if (!dateInput) return '';
  const str = String(dateInput).trim();
  if (str.toUpperCase() === 'TBD' || str.toUpperCase() === 'TBA') {
    return str.toUpperCase();
  }

  // DD-MM-YYYY or DD/MM/YYYY -> YYYY-MM-DD
  const dmyMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }

  // Already YYYY-MM-DD
  const ymdMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (ymdMatch) {
    const year = ymdMatch[1];
    const month = ymdMatch[2].padStart(2, '0');
    const day = ymdMatch[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  return str;
}

/**
 * Format date for human display with Gujarati month name and DD-MM-YYYY format
 */
export function formatIndianDateDisplay(dateInput) {
  if (!dateInput) return '';
  const dmy = formatToDDMMYYYY(dateInput, '-');
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

  return dmy;
}
