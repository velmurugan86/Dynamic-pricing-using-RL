/**
 * Format a number as Indian Rupees, e.g. 8999 -> "₹8,999.00",
 * 1234567 -> "₹12,34,567.00" (Indian lakh/crore grouping).
 */
export function formatINR(value) {
  return `₹${Number(value ?? 0).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  })}`
}
