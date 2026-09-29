
/**
 * Component: the base of every view. A component owns one root element
 * (`element`), builds its own contents, and reports what the user does through
 * callbacks given to its constructor. Components never change the data themselves.
 */

export class Component {
	/** @param {HTMLElement} element The root element. */
	constructor(element) {
		this.element = element;
	}

	get hidden() {
		return this.element.hidden;
	}

	set hidden(hidden) {
		this.element.hidden = hidden;
	}
}
