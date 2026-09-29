
/**
 * Fuzzy matching, like a "fuzzy finder": the letters typed must appear in the
 * name in the same order, but not necessarily next to each other ("hbt" finds
 * "habits"). Of all the ways the letters could line up, the best one counts:
 * letters in a row score most, then letters that start a word (after _ - or a
 * space); exact names and names that start with what was typed come first.
 */

const LETTER = 1;
const IN_A_ROW = 4;
const WORD_START = 2;
const EXACT = 100;
const PREFIX = 10;

/**
 * @param {string} query What was typed (empty matches everything).
 * @param {string} text A name to match against.
 * @returns {{score: number, indexes: number[]}|null} null if it doesn't match;
 *   `indexes` are the matched letters' positions in `text` (for highlighting).
 */
export function fuzzyMatch(query, text) {
	const needle = query.toLowerCase();
	const haystack = text.toLowerCase();
	if (!needle) return { score: 0, indexes: [] };
	if (needle.length > haystack.length) return null;

	// best[i][j]: the best score for the first i+1 typed letters, with letter i at position j.
	const rows = needle.length;
	const columns = haystack.length;
	const best = Array.from({ length: rows }, () => new Array(columns).fill(-Infinity));
	const from = Array.from({ length: rows }, () => new Array(columns).fill(-1));
	const letterScore = (j) => LETTER + (j === 0 || /[_\-\s]/.test(haystack[j - 1]) ? WORD_START : 0);

	for (let j = 0; j < columns; j++) {
		if (haystack[j] === needle[0]) best[0][j] = letterScore(j);
	}
	for (let i = 1; i < rows; i++) {
		for (let j = i; j < columns; j++) {
			if (haystack[j] !== needle[i]) continue;
			for (let k = i - 1; k < j; k++) {
				if (best[i - 1][k] === -Infinity) continue;
				const score = best[i - 1][k] + letterScore(j) + (k === j - 1 ? IN_A_ROW : 0);
				if (score > best[i][j]) {
					best[i][j] = score;
					from[i][j] = k;
				}
			}
		}
	}

	let end = -1;
	for (let j = 0; j < columns; j++) {
		if (best[rows - 1][j] > (end < 0 ? -Infinity : best[rows - 1][end])) end = j;
	}
	if (end < 0) return null;

	const indexes = [];
	for (let i = rows - 1, j = end; i >= 0; j = from[i][j], i--) indexes.unshift(j);
	let score = best[rows - 1][end];
	if (haystack === needle) score += EXACT;
	else if (haystack.startsWith(needle)) score += PREFIX;
	return { score: score - columns * 0.01, indexes }; // shorter names first, all else equal
}

/**
 * The names that match `query`, best first (alphabetical when nothing is typed).
 * @param {string} query
 * @param {string[]} names
 * @returns {Array<{name: string, indexes: number[]}>}
 */
export function fuzzyFilter(query, names) {
	if (!query) return [...names].sort().map((name) => ({ name, indexes: [] }));
	return names
		.map((name) => ({ name, match: fuzzyMatch(query, name) }))
		.filter(({ match }) => match)
		.sort((a, b) => b.match.score - a.match.score || a.name.localeCompare(b.name))
		.map(({ name, match }) => ({ name, indexes: match.indexes }));
}
