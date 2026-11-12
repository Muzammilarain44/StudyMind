/**
 * Spaced repetition for flashcards — "SM-2-lite".
 *
 * A deliberately simple, documented variant of the SM-2 algorithm. There is
 * no ease factor to tune and no hidden state: the next interval depends only
 * on the rating the user gave and the interval the card had before this
 * review. New cards (no previous review) start from the base intervals.
 *
 *   rating   | new card | card with previous interval N days
 *   ---------|----------|------------------------------------
 *   again    | 1 day    | 1 day (the card restarts)
 *   hard     | 1 day    | max(1, round(N * 1.2)) days
 *   good     | 3 days   | round(N * 2.5) days
 *   easy     | 7 days   | round(N * 3.5) days
 *
 * nextDue is always reviewedAt + intervalDays, in whole days, so the due
 * queue is stable and a card reviewed today is never due again today
 * (except "again", which is due tomorrow). The full schedule is stored on
 * each FlashcardReview row, so the algorithm can be audited from the data.
 */

export const SRS_RATINGS = ['again', 'hard', 'good', 'easy'];

export function nextIntervalDays(rating, prevIntervalDays) {
  const prev = prevIntervalDays && prevIntervalDays > 0 ? prevIntervalDays : 0;
  switch (rating) {
    case 'again':
      return 1;
    case 'hard':
      return Math.max(1, Math.round(prev * 1.2));
    case 'good':
      return prev <= 0 ? 3 : Math.round(prev * 2.5);
    case 'easy':
      return prev <= 0 ? 7 : Math.round(prev * 3.5);
    default:
      throw new Error(`Unknown SRS rating: ${rating}`);
  }
}

export function nextDueDate(rating, prevIntervalDays, from = new Date()) {
  const due = new Date(from);
  due.setDate(due.getDate() + nextIntervalDays(rating, prevIntervalDays));
  return due;
}
