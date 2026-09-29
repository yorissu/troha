
/**
 * Confirm sheet: a question with No / Yes buttons, and an optional countdown that
 * answers Yes by itself (used for "Log out?"). Reused for every yes/no question.
 */

import { h, replayAnimation } from '../../../core/dom.js';
import { Sheet } from '../../base/sheet/sheet.js';
import { Button } from '../../base/button/button.js';

export class ConfirmSheet extends Sheet {
	#title = h('h2');
	#note = h('p', { className: 'note' });
	#countdown = h('div', { className: 'countdown', hidden: true });
	#countdownFill = h('div', { className: 'countdown-fill' });
	#noButton = new Button({ className: 'button', label: 'No', onTap: () => this.#answer(false) });
	#yesButton = new Button({ className: 'button', label: 'Yes', onTap: () => this.#answer(true) });
	#question = null;
	#timer;
	#ticker;

	/** @param {import('../../base/sheet/sheet.js').SheetHost} host */
	constructor(host) {
		super(host, { className: 'sheet-small confirm-sheet' });
		this.#countdown.append(this.#countdownFill);
		this.element.append(this.#title, this.#note, this.#countdown,
			h('div', { className: 'sheet-actions' }, h('span', { className: 'spacer' }), this.#noButton.element, this.#yesButton.element));
	}

	/**
	 * Asks a question.
	 * @param {object} question
	 * @param {string} question.title
	 * @param {string} [question.note]
	 * @param {string} [question.noLabel]
	 * @param {string} [question.yesLabel]
	 * @param {'danger'|'primary'} [question.yesStyle]
	 * @param {boolean} [question.poof] Close with the "deleted" exit on Yes.
	 * @param {number} [question.countdownMs] Answer Yes by itself after this long.
	 * @param {(secondsLeft: number) => string} [question.countdownNote] Note text during the countdown.
	 * @param {Element} [question.origin] The element it grows out of.
	 * @param {() => void} [question.onYes]
	 * @param {() => void} [question.onNo] Default: just close.
	 */
	ask(question) {
		this.#stopCountdown();
		this.#question = question;
		this.#title.textContent = question.title;
		this.#note.textContent = question.note ?? '';
		this.#noButton.setLabel(question.noLabel ?? 'No');
		this.#yesButton.setLabel(question.yesLabel ?? 'Yes');
		this.#yesButton.element.classList.toggle('danger', (question.yesStyle ?? 'danger') === 'danger');
		this.#yesButton.element.classList.toggle('primary', question.yesStyle === 'primary');
		this.#countdown.hidden = !question.countdownMs;
		this.open(question.origin);
		if (question.countdownMs) this.#startCountdown(question);
	}

	onOutsideTap() {
		this.#answer(false);
	}

	onHide() {
		this.#stopCountdown();
		this.#question = null;
	}

	#answer(yes) {
		const question = this.#question;
		if (!question) return;
		this.#question = null;
		this.#stopCountdown();
		if (yes) {
			this.close({ poof: question.poof });
			question.onYes?.();
		} else if (question.onNo) {
			question.onNo();
		} else {
			this.close();
		}
	}

	#startCountdown({ countdownMs, countdownNote }) {
		const endsAt = performance.now() + countdownMs; // the steady timer, like the setTimeout below
		const showSecondsLeft = () => {
			if (countdownNote) this.#note.textContent = countdownNote(Math.max(0, Math.ceil((endsAt - performance.now()) / 1000)));
		};
		this.#countdownFill.style.animationDuration = `${countdownMs}ms`;
		replayAnimation(this.#countdownFill, 'draining');
		showSecondsLeft();
		this.#ticker = setInterval(showSecondsLeft, 250);
		this.#timer = setTimeout(() => this.#answer(true), countdownMs);
	}

	#stopCountdown() {
		clearTimeout(this.#timer);
		clearInterval(this.#ticker);
	}
}
