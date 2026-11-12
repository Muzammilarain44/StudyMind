// Grading-scale helpers (Phase 5). Shared by the GPA routes and tests so the
// maths is defined once and verified in exactly one place.
//
// A grading scale maps a letter grade to grade points. The default is the
// common 4.0 scale; users may edit their own scale in Settings. A GPA is
// ALWAYS an estimate: universities use different scales and policies, and
// the API/client label every computed GPA as an estimate.

export const GRADE_LETTERS = ['A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'D', 'F'];

export const DEFAULT_SCALE = {
  A: 4.0,
  'A-': 3.7,
  'B+': 3.3,
  B: 3.0,
  'B-': 2.7,
  'C+': 2.3,
  C: 2.0,
  D: 1.0,
  F: 0,
};

function round2(n) {
  return Math.round(n * 100) / 100;
}

/**
 * Credit-weighted GPA over GPA records.
 * @param {Array} records - GpaRecord docs/objects with { grade, creditHours, semester }.
 * @param {Object} scale - letter -> points map (defaults to DEFAULT_SCALE).
 * @returns {{ gpa: number|null, totalCredits: number, totalPoints: number,
 *   bySemester: Array<{semester, gpa, totalCredits, records}> }}
 * gpa is null when there are no credited records (nothing to average).
 */
export function computeGpa(records, scale = DEFAULT_SCALE) {
  let totalPoints = 0;
  let totalCredits = 0;
  const perSemester = new Map();
  for (const r of records) {
    const credits = Number(r.creditHours) || 0;
    const points = scale?.[r.grade];
    if (!credits || credits <= 0 || points === undefined || points === null) continue;
    totalPoints += points * credits;
    totalCredits += credits;
    const key = r.semester || 'Unassigned';
    const entry = perSemester.get(key) || { semester: key, points: 0, credits: 0, records: 0 };
    entry.points += points * credits;
    entry.credits += credits;
    entry.records += 1;
    perSemester.set(key, entry);
  }
  const bySemester = [...perSemester.values()]
    .map((e) => ({
      semester: e.semester,
      gpa: e.credits ? round2(e.points / e.credits) : null,
      totalCredits: e.credits,
      records: e.records,
    }))
    .sort((a, b) => a.semester.localeCompare(b.semester));
  return {
    gpa: totalCredits ? round2(totalPoints / totalCredits) : null,
    totalCredits,
    totalPoints: round2(totalPoints),
    bySemester,
  };
}
