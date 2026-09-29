
/**
 * Troha settings: everything you might want to tweak lives here, grouped by what
 * it's for. Colours and sizes are in styles/tokens.css; what Troha says is in
 * messages.js. The night and sleep times and the Theme, Brightness, Screen and
 * Motion choices are set in the app itself (and saved in the data file).
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
	 *   dimLevel     Dim is this much darker: 0 = not at all, 1 = black. On a screen whose
	 *                backlight Troha can control (a Pi touch display) the backlight is
	 *                turned down; elsewhere the page darkens itself.
	 *   offAfterMs   "Off when idle": black after this long without a touch. A tap wakes
	 *                it and does nothing else.
	 *   shiftPx, shiftEveryMinutes   The whole page moves by up to shiftPx pixels every
	 *                so often, so nothing burns in.
	 */
	screen: { dimLevel: 0.4, offAfterMs: 2 * 60 * 1000, shiftPx: 2, shiftEveryMinutes: 60 },

	/** PIN pad: allowed length, wrong tries before each further try must wait, and how long. */
	pin: { minLength: 4, maxLength: 8, freeTries: 3, lockoutMs: 60 * 1000 },

	/** Timings, in milliseconds. */
	timing: {
		idleReturnMs: 2 * 60 * 1000,  // no touch this long: close pop-ups, back to Today
		logoutAfterMs: 60 * 1000,     // logged in, no touch this long: ask "Log out?"
		logoutConfirmMs: 10 * 1000,   // "Log out?" answers Yes by itself after this long
		clearModeIdleMs: 10 * 1000,   // Calendar clear mode turns itself off after this long without a touch
		undoMs: 6 * 1000,             // how long "Undo" stays offered after deleting a habit or clearing days
		saveDelayMs: 600,             // typing a name saves after this pause
		celebrateDelayMs: 400,        // let the last card's wiggle finish before celebrating
		loadRetryMs: 5 * 1000,        // retry loading if the server can't read the data file
		serverCheckMs: 1000,          // check this often that the server still answers
		serverTimeoutMs: 10 * 1000,   // a request not answered in this long means the server is down
	},

	/** How long messages at the bottom (toasts) stay, in milliseconds, by length of message. */
	toastMs: { short: 1600, normal: 2400, long: 3600 },

	/** Easter eggs. */
	playful: {
		tickleTaps: 5,       // quick taps on the big date that tickle the cards...
		tickleGapMs: 700,    // ...each within this long of the one before
		offendedGapMs: 1200, // an empty calendar day forgets taps further apart than this
		shakeFromTap: 3,     // it wobbles at first, and shakes from this tap on...
		heyAtTap: 5,         // ...and says "hey!" at this one
		waveTaps: 3,         // quick taps on the Calendar's month name that send a wave across the days...
		waveGapMs: 700,      // ...each within this long of the one before
		wishTimes: ['11:11', '22:22'],                // the clock shimmers: "make a wish" (once a day at each)
		nightOwl: { from: '00:00', until: '04:00' },  // a habit ticked then gets a sleepy remark (once a night)
		earlyBird: { from: '04:00', until: '08:00' }, // everything done then: a sunrise celebration
	},
};
