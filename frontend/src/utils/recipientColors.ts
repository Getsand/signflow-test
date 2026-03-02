/**
 * Recipient colors - Zoho Sign style: each signer has a unique color.
 * Used on Prepare page for field overlays and sidebar.
 */

export interface RecipientColor {
  border: string;
  bg: string;
  bgLight: string;
  text: string;
  /** Tailwind-style ring for focus/selected */
  ring: string;
}

const PALETTE: RecipientColor[] = [
  { border: '#6366f1', bg: '#6366f1', bgLight: '#EEF2FF', text: '#4338ca', ring: 'ring-indigo-500' },   // Me - indigo
  { border: '#2563eb', bg: '#2563eb', bgLight: '#DBEAFE', text: '#1d4ed8', ring: 'ring-blue-500' },   // Signer 1 - blue
  { border: '#059669', bg: '#059669', bgLight: '#D1FAE5', text: '#047857', ring: 'ring-emerald-500' }, // Signer 2 - emerald
  { border: '#d97706', bg: '#d97706', bgLight: '#FEF3C7', text: '#b45309', ring: 'ring-amber-500' },   // Signer 3 - amber
  { border: '#e11d48', bg: '#e11d48', bgLight: '#FFE4E6', text: '#be123c', ring: 'ring-rose-500' },    // Signer 4 - rose
  { border: '#7c3aed', bg: '#7c3aed', bgLight: '#EDE9FE', text: '#6d28d9', ring: 'ring-violet-500' }, // Signer 5 - violet
  { border: '#0284c7', bg: '#0284c7', bgLight: '#E0F2FE', text: '#0369a1', ring: 'ring-sky-500' },   // Signer 6 - sky
  { border: '#ea580c', bg: '#ea580c', bgLight: '#FFEDD5', text: '#c2410c', ring: 'ring-orange-500' }, // Signer 7 - orange
  { border: '#0d9488', bg: '#0d9488', bgLight: '#CCFBF1', text: '#0f766e', ring: 'ring-teal-500' },   // Signer 8 - teal
  { border: '#c026d3', bg: '#c026d3', bgLight: '#FDF4FF', text: '#a21caf', ring: 'ring-fuchsia-500' }, // Signer 9 - fuchsia
  { border: '#475569', bg: '#475569', bgLight: '#F1F5F9', text: '#334155', ring: 'ring-slate-500' },    // Signer 10 - slate
];

function roleToIndex(role: string): number {
  if (role === 'Me') return 0;
  const m = role.match(/^Signer\s*(\d+)$/i);
  if (m) return Math.min(parseInt(m[1], 10), PALETTE.length - 1);
  return 0;
}

/**
 * Get a consistent color for a recipient role (Me, Signer 1, Signer 2, ...).
 * Same role always gets the same color.
 */
export function getRecipientColor(role: string): RecipientColor {
  const index = roleToIndex(role);
  return PALETTE[index] ?? PALETTE[0];
}
