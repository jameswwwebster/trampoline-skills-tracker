const { getNextNWeeksDates, isDateInClosure } = require('../services/sessionGenerator');

describe('getNextNWeeksDates', () => {
  test('returns correct dates for a given day of week', () => {
    // Tuesday = dayOfWeek 2
    // From 2026-03-07 (Saturday), next 4 Tuesdays should be Mar 10, 17, 24, 31
    const from = new Date('2026-03-07');
    const dates = getNextNWeeksDates(2, from, 4);
    expect(dates).toHaveLength(4);
    expect(dates[0].toISOString().slice(0, 10)).toBe('2026-03-10');
    expect(dates[1].toISOString().slice(0, 10)).toBe('2026-03-17');
  });

  test('includes today if it matches the day', () => {
    // Sunday = 0, from a Sunday
    const sunday = new Date('2026-03-08');
    const dates = getNextNWeeksDates(0, sunday, 1);
    expect(dates[0].toISOString().slice(0, 10)).toBe('2026-03-08');
  });
});

describe('isDateInClosure', () => {
  const closures = [
    { startDate: new Date('2026-12-23'), endDate: new Date('2026-12-31') },
  ];

  test('returns true for date inside closure', () => {
    expect(isDateInClosure(new Date('2026-12-25'), closures)).toBe(true);
  });

  test('returns false for date outside closure', () => {
    expect(isDateInClosure(new Date('2026-12-22'), closures)).toBe(false);
  });
});
