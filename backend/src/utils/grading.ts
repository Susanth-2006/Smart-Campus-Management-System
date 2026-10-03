// Weighted out of 100: internal 20 + assignment 10 + mid 20 + final 50
export const MAX_MARKS = { internal: 20, assignment: 10, midExam: 20, finalExam: 50 } as const;

type Parts = { internal?: number | null; assignment?: number | null; midExam?: number | null; finalExam?: number | null };

export const computeTotal = (m: Parts) =>
  Math.round(((m.internal ?? 0) + (m.assignment ?? 0) + (m.midExam ?? 0) + (m.finalExam ?? 0)) * 100) / 100;

export function computeGrade(total: number): string {
  if (total >= 90) return 'O';
  if (total >= 80) return 'A+';
  if (total >= 70) return 'A';
  if (total >= 60) return 'B+';
  if (total >= 50) return 'B';
  if (total >= 40) return 'C';
  return 'F';
}
