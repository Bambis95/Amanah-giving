// Same minimum as the server (backend/routers/auth.py)
export const MIN_PASSWORD_LENGTH = 8;

/** 0 (too short) to 4: length first, then variety of characters */
export function passwordScore(password: string): number {
  if (password.length < MIN_PASSWORD_LENGTH) return 0;
  const variety = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length;
  let score = 1;
  if (variety >= 2) score++;
  if (variety >= 3 && password.length >= 10) score++;
  if (variety >= 3 && password.length >= 12) score++;
  return score;
}
