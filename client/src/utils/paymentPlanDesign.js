// Payment Plan Tracker — status vocabulary + chip colors. Mirrors the
// approval-stage color coding from the source spreadsheet. Kept in sync with
// the `status` enum on server/models/PaymentPlan.js.

export const PAYMENT_PLAN_STATUSES = [
    'Pending from TL',
    'Pending from SM',
    'Pending from FD',
    'Submitted',
    'Pending from Student',
    'Drop Out',
];

// { color: text/border, bg: chip background }
export const STATUS_META = {
    'Pending from TL': { color: '#B45309', bg: 'rgba(217,119,6,0.14)' }, // amber
    'Pending from SM': { color: '#92600A', bg: 'rgba(202,138,4,0.16)' }, // amber (darker)
    'Pending from FD': { color: '#6E40C9', bg: 'rgba(110,64,201,0.14)' }, // purple
    Submitted: { color: '#1F7A35', bg: 'rgba(31,122,53,0.14)' }, // green
    'Pending from Student': { color: '#DC2626', bg: 'rgba(220,38,38,0.14)' }, // red
    'Drop Out': { color: '#57564E', bg: 'rgba(87,86,78,0.14)' }, // grey
};

export const statusMeta = (s) =>
    STATUS_META[s] || { color: 'var(--d-text-3, #57564E)', bg: 'var(--d-surface-muted, #F1EFEA)' };
