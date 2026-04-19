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
  
  // Remove any extra whitespace
  dateStr = dateStr.trim();

  let date = new Date(dateStr);

  // If standard constructor fails, try custom patterns
  if (isNaN(date.getTime())) {
    // Try DD.MM.YYYY (German/EU)
    const euMatch = dateStr.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
    if (euMatch) {
      const year = euMatch[3].length === 2 ? `20${euMatch[3]}` : euMatch[3];
      date = new Date(`${year}-${euMatch[2]}-${euMatch[1]}`);
    }
  }

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
