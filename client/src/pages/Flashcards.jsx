import { useCallback, useEffect, useState } from 'react';
import { coursesApi, flashcardDecksApi } from '../lib/api.js';
import { btnDanger, btnGhost, btnPrimary, cardCls, inputCls, labelCls, selectCls, textareaCls } from '../lib/ui-classes.js';

const EMPTY_DECK = { title: '', description: '', courseId: '' };
const RATINGS = [
  { value: 'again', label: 'Again', hint: 'Due tomorrow' },
  { value: 'hard', label: 'Hard', hint: 'Short interval' },
  { value: 'good', label: 'Good', hint: 'A few days' },
  { value: 'easy', label: 'Easy', hint: 'Long interval' },
];

export default function Flashcards() {
  const [decks, setDecks] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [deckForm, setDeckForm] = useState(EMPTY_DECK);
  const [savingDeck, setSavingDeck] = useState(false);
  const [deletingDeckId, setDeletingDeckId] = useState(null);

  // Selected deck detail
  const [selected, setSelected] = useState(null);
  const [cards, setCards] = useState([]);
  const [cardsLoading, setCardsLoading] = useState(false);
  const [cardForm, setCardForm] = useState({ front: '', back: '' });
  const [savingCard, setSavingCard] = useState(false);
  const [deletingCardId, setDeletingCardId] = useState(null);

  // Study mode
  const [studying, setStudying] = useState(false);
  const [dueCards, setDueCards] = useState([]);
  const [studyIndex, setStudyIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [reviewing, setReviewing] = useState(false);

  const loadDecks = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [deckData, courseData] = await Promise.all([
        flashcardDecksApi.list({ limit: 100 }),
        coursesApi.list({ limit: 100 }),
      ]);
      setDecks(deckData.decks);
      setCourses(courseData.courses);
    } catch (err) {
      setError(err.message || 'Could not load decks.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDecks();
  }, [loadDecks]);

  const loadCards = useCallback(async (deckId) => {
    setCardsLoading(true);
    try {
      const data = await flashcardDecksApi.cards(deckId, { limit: 100 });
      setCards(data.cards);
    } catch (err) {
      setError(err.message || 'Could not load cards.');
    } finally {
      setCardsLoading(false);
    }
  }, []);

  async function openDeck(deck) {
    setSelected(deck);
    setStudying(false);
    setError('');
    await loadCards(deck._id);
  }

  async function handleCreateDeck(e) {
    e.preventDefault();
    setError('');
    if (!deckForm.title.trim()) {
      setError('Title is required.');
      return;
    }
    setSavingDeck(true);
    try {
      const data = await flashcardDecksApi.create({
        title: deckForm.title.trim(),
        description: deckForm.description.trim(),
        courseId: deckForm.courseId || null,
      });
      setDeckForm(EMPTY_DECK);
      await loadDecks();
      await openDeck(data.deck);
    } catch (err) {
      setError(err.message || 'Could not create the deck.');
    } finally {
      setSavingDeck(false);
    }
  }

  async function handleDeleteDeck(deck) {
    if (!window.confirm(`Delete the deck "${deck.title}"? All its cards and reviews will be deleted too.`)) return;
    setDeletingDeckId(deck._id);
    try {
      await flashcardDecksApi.remove(deck._id);
      if (selected && selected._id === deck._id) {
        setSelected(null);
        setCards([]);
        setStudying(false);
      }
      await loadDecks();
    } catch (err) {
      setError(err.message || 'Could not delete the deck.');
    } finally {
      setDeletingDeckId(null);
    }
  }

  async function handleAddCard(e) {
    e.preventDefault();
    if (!selected) return;
    setError('');
    if (!cardForm.front.trim() || !cardForm.back.trim()) {
      setError('Both the front and the back of the card are required.');
      return;
    }
    setSavingCard(true);
    try {
      await flashcardDecksApi.addCard(selected._id, {
        front: cardForm.front.trim(),
        back: cardForm.back.trim(),
      });
      setCardForm({ front: '', back: '' });
      await loadCards(selected._id);
      await loadDecks();
    } catch (err) {
      setError(err.message || 'Could not add the card.');
    } finally {
      setSavingCard(false);
    }
  }

  async function handleDeleteCard(card) {
    if (!selected) return;
    setDeletingCardId(card._id);
    try {
      await flashcardDecksApi.removeCard(selected._id, card._id);
      await loadCards(selected._id);
      await loadDecks();
    } catch (err) {
      setError(err.message || 'Could not delete the card.');
    } finally {
      setDeletingCardId(null);
    }
  }

  async function startStudy() {
    if (!selected) return;
    setError('');
    try {
      const data = await flashcardDecksApi.due(selected._id, { limit: 20 });
      setDueCards(data.cards);
      setStudyIndex(0);
      setFlipped(false);
      setReviewedCount(0);
      setStudying(true);
    } catch (err) {
      setError(err.message || 'Could not load the review queue.');
    }
  }

  async function submitReview(rating) {
    if (!selected || reviewing) return;
    const card = dueCards[studyIndex];
    if (!card) return;
    setReviewing(true);
    try {
      await flashcardDecksApi.review(selected._id, card._id, { rating });
      setReviewedCount((n) => n + 1);
      setFlipped(false);
      setStudyIndex((i) => i + 1);
    } catch (err) {
      setError(err.message || 'Could not save the review.');
    } finally {
      setReviewing(false);
    }
  }

  const currentCard = studying ? dueCards[studyIndex] : null;
  const studyDone = studying && studyIndex >= dueCards.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Flashcards</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Decks of front/back cards with spaced repetition: rate each card after you recall it,
          and the next due date is scheduled for you (again → tomorrow, good → a few days,
          easy → longer). The review queue is stored in the database.
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300" role="alert">
          {error}
        </div>
      )}

      {/* ---- Study mode ---- */}
      {studying && selected && (
        <section className={`${cardCls} space-y-4`} aria-label={`Study deck: ${selected.title}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Studying: {selected.title}</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {studyDone
                  ? `Queue clear — ${reviewedCount} card${reviewedCount === 1 ? '' : 's'} reviewed.`
                  : `Card ${studyIndex + 1} of ${dueCards.length} · ${reviewedCount} reviewed`}
              </p>
            </div>
            <button type="button" className={btnGhost} onClick={() => setStudying(false)}>Exit study</button>
          </div>

          {dueCards.length === 0 ? (
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Nothing is due right now — every card in this deck has been reviewed and is scheduled
              for a future day. Add a new card or come back later.
            </p>
          ) : studyDone ? (
            <div className="rounded-lg bg-brand-50 p-4 dark:bg-slate-800">
              <p className="font-semibold">All due cards reviewed. 🎉</p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Each card now has a new due date based on how you rated it.
              </p>
            </div>
          ) : (
            currentCard && (
              <div className="space-y-4">
                {/* Flip card — click to flip */}
                <button
                  type="button"
                  onClick={() => setFlipped((f) => !f)}
                  aria-label={flipped ? 'Show the front of the card' : 'Show the back of the card'}
                  className="block w-full text-left"
                >
                  <div style={{ perspective: '1000px' }}>
                    <div
                      className="relative min-h-44 rounded-xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-700 dark:bg-slate-800"
                      style={{
                        transformStyle: 'preserve-3d',
                        transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                        transition: 'transform 0.5s',
                      }}
                    >
                      <div style={{ backfaceVisibility: 'hidden' }}>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Front — tap to flip</p>
                        <p className="mt-2 text-lg font-semibold">{currentCard.front}</p>
                      </div>
                      <div
                        className="absolute inset-0 p-6"
                        style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                      >
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Back</p>
                        <p className="mt-2 text-lg">{currentCard.back}</p>
                      </div>
                    </div>
                  </div>
                </button>

                {flipped ? (
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">How well did you recall it?</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {RATINGS.map((r) => (
                        <button
                          key={r.value}
                          type="button"
                          className={btnPrimary}
                          disabled={reviewing}
                          onClick={() => submitReview(r.value)}
                          title={r.hint}
                        >
                          {r.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">Tap the card to reveal the answer, then rate yourself.</p>
                )}
              </div>
            )
          )}
        </section>
      )}

      {/* ---- Selected deck detail ---- */}
      {selected && !studying && (
        <section className={`${cardCls} space-y-4`} aria-label={`Deck: ${selected.title}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">{selected.title}</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {selected.description || 'No description.'} · {cards.length} card{cards.length === 1 ? '' : 's'}
              </p>
            </div>
            <div className="flex gap-2">
              <button type="button" className={btnPrimary} onClick={startStudy} disabled={cards.length === 0}>
                Study now
              </button>
              <button type="button" className={btnGhost} onClick={() => setSelected(null)}>Close deck</button>
            </div>
          </div>

          <form onSubmit={handleAddCard} className="space-y-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
            <h3 className="font-medium">Add a card</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="card-front" className={labelCls}>Front (question / term)</label>
                <textarea id="card-front" rows={2} value={cardForm.front} onChange={(e) => setCardForm({ ...cardForm, front: e.target.value })} className={textareaCls} placeholder="What is a process?" />
              </div>
              <div>
                <label htmlFor="card-back" className={labelCls}>Back (answer / definition)</label>
                <textarea id="card-back" rows={2} value={cardForm.back} onChange={(e) => setCardForm({ ...cardForm, back: e.target.value })} className={textareaCls} placeholder="A program in execution." />
              </div>
            </div>
            <button type="submit" disabled={savingCard} className={btnPrimary}>
              {savingCard ? 'Adding…' : 'Add card'}
            </button>
          </form>

          {cardsLoading ? (
            <p className="text-sm text-slate-500">Loading cards…</p>
          ) : cards.length === 0 ? (
            <p className="text-sm text-slate-600 dark:text-slate-400">No cards in this deck yet — add one above.</p>
          ) : (
            <ul className="space-y-2">
              {cards.map((card) => (
                <li key={card._id} className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700">
                  <span>
                    <span className="font-medium">{card.front}</span>
                    <span className="block text-slate-600 dark:text-slate-400">{card.back}</span>
                  </span>
                  <button
                    type="button"
                    className={btnDanger}
                    disabled={deletingCardId === card._id}
                    onClick={() => handleDeleteCard(card)}
                  >
                    {deletingCardId === card._id ? 'Deleting…' : 'Delete'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* ---- New deck form ---- */}
      <form onSubmit={handleCreateDeck} className={`${cardCls} space-y-4`} aria-label="New deck">
        <h2 className="font-semibold">New deck</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="deck-title" className={labelCls}>Title</label>
            <input id="deck-title" required value={deckForm.title} onChange={(e) => setDeckForm({ ...deckForm, title: e.target.value })} className={inputCls} placeholder="OS Terms" />
          </div>
          <div>
            <label htmlFor="deck-course" className={labelCls}>Course (optional)</label>
            <select id="deck-course" value={deckForm.courseId} onChange={(e) => setDeckForm({ ...deckForm, courseId: e.target.value })} className={selectCls}>
              <option value="">No course</option>
              {courses.map((c) => (
                <option key={c._id} value={c._id}>{c.title}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="deck-description" className={labelCls}>Description (optional)</label>
            <input id="deck-description" value={deckForm.description} onChange={(e) => setDeckForm({ ...deckForm, description: e.target.value })} className={inputCls} placeholder="Key terms for the operating systems exam" />
          </div>
        </div>
        <button type="submit" disabled={savingDeck} className={btnPrimary}>
          {savingDeck ? 'Creating…' : 'Create deck'}
        </button>
      </form>

      {/* ---- Deck list ---- */}
      {loading ? (
        <p className="text-sm text-slate-500">Loading decks…</p>
      ) : decks.length === 0 ? (
        <div className={`${cardCls} border-dashed`}>
          <h2 className="font-semibold">No decks yet</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Create your first deck above, add cards to it, then study them with spaced repetition.
          </p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {decks.map((deck) => (
            <li key={deck._id} className={cardCls}>
              <h2 className="font-semibold">{deck.title}</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {deck.cardCount} card{deck.cardCount === 1 ? '' : 's'}
                {deck.description ? ` · ${deck.description}` : ''}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" className={btnPrimary} onClick={() => openDeck(deck)}>Open deck</button>
                <button
                  type="button"
                  className={btnDanger}
                  disabled={deletingDeckId === deck._id}
                  onClick={() => handleDeleteDeck(deck)}
                >
                  {deletingDeckId === deck._id ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
