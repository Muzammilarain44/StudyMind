// Shared Tailwind class strings so the Phase 3 pages stay visually consistent
// with the Phase 1–2 pages. Plain constants only — no components, so the
// react-refresh lint rule stays quiet.
export const inputCls =
  'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800';
export const selectCls = inputCls;
export const textareaCls =
  'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800';
export const labelCls = 'block text-sm font-medium';
export const cardCls =
  'rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900';
export const btnPrimary =
  'rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60';
export const btnGhost =
  'rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800';
export const btnDanger =
  'rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950';
