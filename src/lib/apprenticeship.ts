// The apprenticeship year is derived from the start date so nobody has to
// update their profile every year.
export function apprenticeshipYear(
  start: string | Date,
  now: Date = new Date(),
): number {
  const startDate = new Date(start);
  let years = now.getFullYear() - startDate.getFullYear();
  const anniversaryPassed =
    now.getMonth() > startDate.getMonth() ||
    (now.getMonth() === startDate.getMonth() &&
      now.getDate() >= startDate.getDate());
  if (!anniversaryPassed) {
    years -= 1;
  }
  return Math.max(1, years + 1);
}

export function isProfileComplete(user: {
  role?: string | null;
  birthday?: string | null;
  apprenticeshipStart?: string | null;
}): boolean {
  if (!user.birthday) {
    return false;
  }
  if (user.role === "apprentice" && !user.apprenticeshipStart) {
    return false;
  }
  return true;
}
