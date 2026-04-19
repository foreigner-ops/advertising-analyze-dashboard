/**
 * Normalizes various Amazon date formats into YYYY-MM-DD
 * Handles:
 * - "Apr 10, 2026"
 * - "04/10/2026" or "4/10/26"
 * - "10.04.2026"
 * - "2026-04-10"
 */
function normalizeDate(dateStr) {
  if (!dateStr) return null;
  
  // If it's already a Date object (common in XLSX), format to YYYY-MM-DD
  if (dateStr instanceof Date) {
    const y = dateStr.getFullYear();
    const m = String(dateStr.getMonth() + 1).padStart(2, '0');
    const d = String(dateStr.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // Ensure it's a string, then trim
  dateStr = String(dateStr).trim();

  // Handle "YYYY-MM-DD" directly
  if (dateStr.match(/^\d{4}-\d{1,2}-\d{1,2}$/)) {
    const parts = dateStr.split('-');
    return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
  }

  // Try DD.MM.YYYY, DD/MM/YYYY, or MM/DD/YYYY
  const match = dateStr.match(/^(\d{1,2})([./-])(\d{1,2})[./-](\d{2,4})$/);
  if (match) {
    const p1 = match[1].padStart(2, '0');
    const sep = match[2];
    const p2 = match[3].padStart(2, '0');
    let year = match[4];
    if (year.length === 2) year = `20${year}`;

    // If separator is '.', it's almost certainly DD.MM.YYYY (EU/German)
    if (sep === '.') {
      return `${year}-${p2}-${p1}`;
    }
    
    // If p1 > 12, it must be DD/MM/YYYY
    if (parseInt(p1) > 12) {
      return `${year}-${p2}-${p1}`;
    }

    // Default to MM/DD for slashes unless p1 > 12 (standard US/Amazon default)
    // We'll let the standard constructor handle the rest if no specific match
  }

  let date = new Date(dateStr);
  if (isNaN(date.getTime())) return null;

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  
  return `${y}-${m}-${d}`;
}

function normalizeAsin(asin) {
  return asin ? asin.trim().toUpperCase() : null;
}

module.exports = {
  normalizeDate,
  normalizeAsin
};
