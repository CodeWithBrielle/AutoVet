/**
 * Standard currency formatter for Philippine Peso (PHP).
 */
export const currencyFormatter = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Formats a number as PHP currency string.
 * @param {number|string} value - The value to format.
 * @returns {string} The formatted currency string.
 */
export const formatCurrency = (value) => {
  const num = Number(value || 0);
  return currencyFormatter.format(num);
};

/**
 * Formats a number as PHP currency string with no decimals if it is a whole number.
 * @param {number|string} value - The value to format.
 * @returns {string} The formatted currency string.
 */
export const formatCurrencyShort = (value) => {
  const num = Number(value || 0);
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
};
