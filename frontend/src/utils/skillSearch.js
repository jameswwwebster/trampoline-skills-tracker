// Normalize a search string for skill name / FIG notation matching. Converts
// the unicode fractions and English fraction words into a single ASCII form so
// "1/2 twist", "half twist" and "½ twist" all match the same skills.
export function normalizeSkillSearch(s) {
  return (s || '')
    .toLowerCase()
    .replace(/½/g, '1/2')
    .replace(/¼/g, '1/4')
    .replace(/¾/g, '3/4')
    .replace(/\bhalf\b/g, '1/2')
    .replace(/\bquarter\b/g, '1/4')
    .replace(/three[\s-]*quarters?\b/g, '3/4');
}

// Returns true if the (name, fig) pair matches a normalized query.
export function matchesSkillQuery(query, name, fig) {
  const nq = normalizeSkillSearch(query);
  if (!nq) return true;
  const hay = normalizeSkillSearch(`${name || ''} ${fig || ''}`);
  return hay.includes(nq);
}
