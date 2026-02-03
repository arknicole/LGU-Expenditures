/**
 * Formats a number into a string with comma separators and two decimal places.
 * e.g., 12345.6 becomes "12,345.60"
 * @param {number | string} num The number to format.
 * @returns {string} The formatted number string.
 */
function formatCurrency(num) {
  // Ensure we are working with a valid number, default to 0 if not.
  const number = parseFloat(num) || 0;

  // Use the built-in Intl.NumberFormat for robust, locale-aware formatting.
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(number);
}