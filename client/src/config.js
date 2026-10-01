
/**
 * Troha's page settings: everything you might want to tweak lives here, grouped by
 * what it's for. Colours and sizes are in styles/tokens.css; what Troha says is in
 * messages.js. The night and sleep times and the Theme, Brightness and Screen
 * choices are set in the app itself (and saved with each account).
 */

export const config = {
	/** Language for dates and weekday names, e.g. 'en-GB', 'en-US', 'lt-LT'. */
	locale: 'en-US',

	/** Habit colours, in the order new habits cycle through. Each needs a `.c-<name>` in styles/tokens.css. */
	colors: ['sky', 'pistachio', 'peach', 'lilac', 'butter', 'mint', 'blush', 'periwinkle'],

	/** The habit editor: the "every N weeks" choices, and the longest name, in characters. */
	editor: { repeatChoices: [1, 2, 3, 4], nameMaxLength: 60 },

	/** The clock pop-up: minutes snap to steps of this many (5: 00, 05, 10, 15…). */
	timePicker: { minuteStep: 5 },

	/** Today view: 3 columns hold `threeColumnLimit` habits; beyond that, 4 columns and smaller rows. */
	today: { threeColumnLimit: 21, minRows: 7 },

	/**
	 * Screen care.
	 *   dimLevel     Dim is this much darker: 0 = not at all, 1 = black (the page darkens itself).
	 *   offAfterMs   "Off when idle": black after this long without a touch. A tap wakes
	 *                it and does nothing else.
	 *   shiftPx, shiftEveryMinutes   The whole page moves by up to shiftPx pixels every
	 *                so often, so nothing burns in.
	 */
	screen: { dimLevel: 0.4, offAfterMs: 2 * 60 * 1000, shiftPx: 2, shiftEveryMinutes: 60 },

	/** PIN pad: allowed length (the server checks the same, and counts the wrong tries). */
	pin: { minLength: 4, maxLength: 8 },

	/** Accounts: the shortest password (the server checks the same) and the longest email. */
	account: { minPasswordLength: 8, emailMaxLength: 254, passwordMaxLength: 200 },

	/** Timings, in milliseconds. */
	timing: {
		idleReturnMs: 2 * 60 * 1000,  // no touch this long: close pop-ups, back to Today (and catch up with other devices)
		// Hidden habits: the server decides how long they stay unlocked (a minute without a touch, see
		// server/troha_server/pin.py); the page tells it they're in use, and asks before they lock.
		lockConfirmMs: 10 * 1000,     // ask "Lock them?" this long before the server locks them (tapped: answers Yes after this long)
		unlockTouchMs: 5 * 1000,      // while unlocked and in use, tell the server so at most this often
		undoMs: 6 * 1000,             // how long "Undo" stays offered after deleting a habit
		saveDelayMs: 600,             // typing a name saves after this pause
		celebrateDelayMs: 400,        // let the last card's wiggle finish before celebrating
		loadRetryMs: 5 * 1000,        // retry loading if the server can't read the data
		serverCheckMs: 5000,          // check this often that the server still answers (also while it's down)
		serverTimeoutMs: 10 * 1000,   // a request not answered in this long means the server is down
	},

	/** How long messages at the bottom (toasts) stay, in milliseconds, by length of message. */
	toastMs: { short: 1600, normal: 2400, long: 3600 },

	/** Easter eggs. */
	playful: {
		tickleTaps: 5,       // quick taps on the big date that tickle the cards...
		tickleGapMs: 700,    // ...each within this long of the one before
		wishTimes: ['11:11', '22:22'],                // the clock shimmers: "make a wish" (once a day at each)
		nightOwl: { from: '00:00', until: '04:00' },  // a habit ticked then gets a sleepy remark (once a night)
		earlyBird: { from: '04:00', until: '08:00' }, // everything done then: a sunrise celebration
	},
};
