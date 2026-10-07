/**
 * Parse OCR full text from 승선자명부 into passenger rows.
 */

const BIRTH_PATTERNS = [
  /(\d{4})-(\d{2})-(\d{2})/,
  /(\d{4})\.(\d{2})\.(\d{2})/,
  /(\d{2})-(\d{2})-(\d{2})/,
  /(\d{6})/,
  /(\d{8})/,
];

const CREW_MARKERS = ['선장', '선원'];
const GENDER_PATTERN = /(남|여)/;

/**
 * @param {string} birthRaw
 * @param {Date} referenceDate
 * @returns {{ birthDate: Date | null, age: number | null }}
 */
function parseBirthAndAge(birthRaw, referenceDate) {
  const cleaned = birthRaw.replace(/\s/g, '');

  for (const pattern of BIRTH_PATTERNS) {
    const match = cleaned.match(pattern);
    if (!match) continue;

    let year;
    let month;
    let day;

    if (match[0].length === 6 && /^\d{6}$/.test(match[0])) {
      const yy = parseInt(match[0].slice(0, 2), 10);
      month = parseInt(match[0].slice(2, 4), 10);
      day = parseInt(match[0].slice(4, 6), 10);
      year = yy <= 30 ? 2000 + yy : 1900 + yy;
    } else if (match[0].length === 8 && /^\d{8}$/.test(match[0])) {
      year = parseInt(match[0].slice(0, 4), 10);
      month = parseInt(match[0].slice(4, 6), 10);
      day = parseInt(match[0].slice(6, 8), 10);
    } else if (match[1]?.length === 4) {
      year = parseInt(match[1], 10);
      month = parseInt(match[2], 10);
      day = parseInt(match[3], 10);
    } else {
      const yy = parseInt(match[1], 10);
      month = parseInt(match[2], 10);
      day = parseInt(match[3], 10);
      year = yy <= 30 ? 2000 + yy : 1900 + yy;
    }

    if (!year || month < 1 || month > 12 || day < 1 || day > 31) continue;

    const birthDate = new Date(year, month - 1, day);
    if (Number.isNaN(birthDate.getTime())) continue;

    let age = referenceDate.getFullYear() - birthDate.getFullYear();
    const monthDiff = referenceDate.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && referenceDate.getDate() < birthDate.getDate())) {
      age -= 1;
    }

    if (age < 0 || age > 120) continue;
    return { birthDate, age };
  }

  return { birthDate: null, age: null };
}

/**
 * @param {number | null} age
 * @returns {string}
 */
function ageToBucket(age) {
  if (age == null) return 'unknown';
  if (age < 10) return '10세 미만';
  if (age >= 70) return '70대 이상';
  const decade = Math.floor(age / 10) * 10;
  return `${decade}대`;
}

/**
 * @param {string} text
 * @returns {string}
 */
function extractTableBody(text) {
  const startMarkers = ['성명', '생년월일'];
  const endMarkers = ['입항시간', '선상', '** 선내'];

  let body = text;
  const startIndices = startMarkers.map((m) => body.indexOf(m)).filter((i) => i >= 0);
  if (startIndices.length > 0) {
    body = body.slice(Math.max(...startIndices));
  }

  let endIdx = body.length;
  for (const marker of endMarkers) {
    const idx = body.indexOf(marker);
    if (idx > 50 && idx < endIdx) endIdx = idx;
  }
  return body.slice(0, endIdx);
}

/**
 * @param {string} chunk
 * @returns {boolean}
 */
function isCrew(chunk) {
  return CREW_MARKERS.some((marker) => {
    const idx = chunk.indexOf(marker);
    if (idx < 0) return false;
    const after = chunk.slice(idx + marker.length, idx + marker.length + 2);
    return !/[가-힣]/.test(after);
  });
}

/**
 * @param {string} preBirth Text immediately before birth date in OCR body
 * @returns {string | null}
 */
function extractName(preBirth) {
  const tokens = preBirth
    .replace(/\|/g, ' ')
    .split(/[\s\n]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  for (let i = tokens.length - 1; i >= 0; i -= 1) {
    const token = tokens[i];
    if (/^\d+$/.test(token)) continue;
    if (/^(남|여|성명|생년월일|주소|전화번호|비상연락처|비고)$/.test(token)) continue;
    if (/^[가-힣]{2,5}$/.test(token)) return token;
  }

  return null;
}

/**
 * @param {string} ocrText
 * @param {string} tripDateStr YYYY-MM-DD
 * @returns {import('./types').ParsedPassenger[]}
 */
function parseRosterOcrText(ocrText, tripDateStr) {
  if (!ocrText?.trim()) return [];

  const referenceDate = new Date(`${tripDateStr}T12:00:00`);
  const body = extractTableBody(ocrText);
  const passengers = [];
  const seen = new Set();

  const birthRegex =
    /(\d{4}-\d{2}-\d{2}|\d{4}\.\d{2}\.\d{2}|\d{2}-\d{2}-\d{2})/g;
  let match;

  while ((match = birthRegex.exec(body)) !== null) {
    const birthRaw = match[0];
    const matchStartInBody = match.index;
    const postBirth = body.slice(matchStartInBody + birthRaw.length, matchStartInBody + birthRaw.length + 180);

    if (isCrew(postBirth)) continue;

    const preBirth = body.slice(Math.max(0, matchStartInBody - 40), matchStartInBody);
    const name = extractName(preBirth);

    const { age } = parseBirthAndAge(birthRaw, referenceDate);
    const genderMatch = postBirth.match(GENDER_PATTERN) || preBirth.match(GENDER_PATTERN);
    const gender = genderMatch ? genderMatch[1] : 'unknown';

    const key = `${name || ''}|${birthRaw}|${gender}|${matchStartInBody}`;
    if (seen.has(key)) continue;
    seen.add(key);

    passengers.push({
      name,
      birth: birthRaw,
      gender,
      age,
      ageBucket: ageToBucket(age),
    });
  }

  return passengers;
}

module.exports = {
  parseRosterOcrText,
  parseBirthAndAge,
  ageToBucket,
};
