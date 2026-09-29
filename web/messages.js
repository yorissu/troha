
/**
 * Troha's wording: the things it says. Each is a list of remarks; one is picked
 * at random every time, never the same one twice in a row (say() in core/text.js).
 * A remark is a text, or a function that fills in details, like a habit's name.
 *
 * Add, change or remove remarks freely; each list needs at least one. Messages
 * that report a fact (e.g. "Theme: Dark", or an error) are written where they're
 * used, and stay the same every time.
 */

import { plural } from './core/text.js';

export const messages = {
	/* ---------- A new day, shown at midnight (weekday e.g. "Tuesday", count: habits due) ---------- */

	greeting: [
		(weekday, count) => `It's ${weekday}. ${plural(count, 'habit')} today`,
		(weekday, count) => `Welcome to ${weekday}! ${plural(count, 'habit')} to go`,
		(weekday, count) => `A fresh ${weekday}. ${plural(count, 'habit')} waiting`,
		(weekday, count) => `Hello, ${weekday}! ${plural(count, 'habit')} on the list`,
		(weekday, count) => `New day, new ticks: ${plural(count, 'habit')} today`,
		(weekday, count) => `${weekday} is here. ${plural(count, 'habit')} lined up`,
		(weekday, count) => `Onwards to ${weekday}. ${plural(count, 'habit')} ahead`,
		(weekday, count) => `It's ${weekday}. ${plural(count, 'habit')}, one at a time`,
	],
	greetingFree: [
		(weekday) => `It's ${weekday}. Nothing planned today`,
		(weekday) => `A free ${weekday}. Nothing planned`,
		(weekday) => `${weekday} off. Enjoy it`,
		(weekday) => `Nothing on the list this ${weekday}. Rest up`,
		(weekday) => `Happy ${weekday}! A day with nothing to tick`,
	],

	/* ---------- Habits ---------- */

	added: [
		(name) => `Added “${name}”`,
		(name) => `“${name}” is on the board`,
		(name) => `Say hello to “${name}”`,
		(name) => `“${name}” added. You've got this`,
		(name) => `New habit: “${name}”`,
		(name) => `“${name}” joins the team`,
		(name) => `Here's to “${name}”`,
		(name) => `“${name}”, welcome aboard`,
	],
	addedPrivate: [
		'Added a private habit',
		'A private habit, safely added',
		'Added. Your secret is safe',
		'Private habit added. Mum’s the word',
		'Added, and kept to yourself',
	],

	/* ---------- Progress ---------- */

	halfway: [
		'Halfway there',
		'Half done. Nice pace',
		'Halfway! Keep going',
		'Half the list, ticked',
		'Over the hump',
		'Halfway. You’re on a roll',
		'Fifty percent. Looking good',
		'Half done, half to go',
		'Halfway! The rest is downhill',
		'Nice, that’s half of it',
		'Halfway. Steady does it',
		'Half there. Keep the rhythm',
	],
	allDone: [
		'All done for today. Well done!',
		'Everything done. Enjoy the rest of the day!',
		'All done. Nice work!',
		'Clean sweep! Every habit ticked',
		'That’s the lot. Take a bow',
		'All ticked. Treat yourself',
		'Done and dusted!',
		'Every single one. Brilliant!',
		'Full house! Well played',
		'All done. Your future self says thanks',
		'Nothing left to tick. Lovely',
		'The whole list, done. Superb!',
		'All done. Time to put your feet up',
		'Perfect day!',
	],
	/** Added after "all done", for 2 or more perfect days in a row. */
	streak: [
		(days) => `${days} perfect days in a row.`,
		(days) => `That's ${days} perfect days running.`,
		(days) => `${days} days of everything done.`,
		(days) => `Streak: ${days} perfect days.`,
		(days) => `${days} in a row. Keep it going!`,
	],

	/* ---------- Logging in and out ---------- */

	loggedIn: [
		'Logged in',
		'Welcome back',
		'Unlocked',
		'Hello again',
		'You’re in',
		'Private habits, unlocked',
		'Come on in',
	],
	pinSet: [
		'PIN set. You’re logged in',
		'PIN saved. You’re logged in',
		'All set: your PIN is ready and you’re in',
		'New PIN, all set. You’re logged in',
	],
	loggedOut: [
		'Logged out',
		'Locked up',
		'See you later',
		'Private habits, tucked away',
		'All locked. Bye for now',
		'Logged out. Your secrets are safe',
	],
	/** The PIN pad's note after a wrong PIN. */
	wrongPin: [
		'Wrong PIN',
		'Not quite. Try again',
		'That’s not it',
		'Hmm, wrong PIN',
		'Nope, try again',
		'Wrong PIN. Take your time',
	],
	/** The PIN pad's note after 0000 (an easter egg: it doesn't count as a wrong try). */
	niceTry: [
		'Nice try',
		'Ha, nice try',
		'0000? Really?',
		'Oldest trick in the book',
		'Not today',
		'Good guess. Wrong, though',
		'Cute. No',
		'Worth a shot',
		'Bold move',
		'I see what you did there',
		'Almost! Not even close',
		'Try harder than that',
		'Zero chance',
		'Four zeros, zero luck',
		'Classic. Still no',
		'Nice try, sneaky',
	],

	/* ---------- Calendar ---------- */

	clearModeOn: [
		'Tap days to clear them',
		'Clear mode: tap a day to clear it',
		'Eraser ready. Tap a day',
	],
	clearModeOff: [
		'Clear mode off',
		'Eraser put away',
		'Done clearing',
	],
	/** The little bubble when an empty day is tapped again and again (an easter egg). */
	hey: [
		'hey!',
		'ouch',
		'rude.',
		'stop it',
		'I’m empty!',
		'nothing here',
		'that tickles',
		'excuse me?',
		'hey, quit it',
		'poke poke',
		'I felt that',
		'go away',
		'still empty',
		'ow!',
	],
};
