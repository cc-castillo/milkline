// Shared utility functions

/**
 * Get the color scheme for a status badge
 */
export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    // RFQ statuses
    open: 'cyan',
    quoted: 'purple',
    ordered: 'orange',
    fulfilled: 'green',
    cancelled: 'red',
    // Quote statuses
    pending: 'yellow',
    accepted: 'green',
    rejected: 'red',
    // Order statuses
    confirmed: 'cyan',
    in_transit: 'purple',
    delivered: 'green',
    created: 'blue',
  };
  return colors[status.toLowerCase()] || 'gray';
}

/**
 * Capitalize the first letter of a string
 */
export function capitalizeFirstLetter(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Format a date string to a readable format
 */
export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString();
}

/**
 * Format a date string to a readable date and time format
 */
export function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString();
}

/**
 * Format currency amount
 */
export function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString()}`;
}

