
<!--
	Header: the view's title and the row of buttons: the lock, +, then the views
	(Notices, Account, Today, Your habits, Calendar, Settings). While there's a notice (services/notices.svelte.js), the Notices button
	has a dot: amber, or red if something has gone wrong.
	The views' buttons show which view is on (see controls/view_button.svelte); the
	one the page is about to go to by itself (`pending`) fills its ring meanwhile.

	Props:
		view        the view on screen: one of VIEWS below
		pending     a view the page is about to go to by itself: { view, fraction } (0 to 1), or null
		lock        the lock button's { state, timeLeft, onTap }
		onNavigate  a view's button was tapped (gets its id)
		onAdd       + was tapped (gets the button)
		limited     only the views marked `limited` work (while the license isn't running)
-->

<script>
	import { replayAnimation } from '../../core/dom.js';
	import { notices } from '../../services/notices.svelte.js';
	import IconButton from '../controls/icon_button.svelte';
	import LockButton from '../controls/lock_button.svelte';
	import ViewButton from '../controls/view_button.svelte';

	/**
	 * The views, in button order: the title shown, the button's spoken name and icon.
	 * `limited`: it works while the license isn't running too. To add a view, add it
	 * here and show it in board.svelte.
	 */
	const VIEWS = [
		{ id: 'notices', title: 'Notices', label: 'Notices', icon: 'bell', limited: true },
		{ id: 'account', title: 'Account', label: 'Account', icon: 'account', limited: true },
		{ id: 'today', title: 'Today', label: 'Today', icon: 'today' },
		{ id: 'manage', title: 'Your habits', label: 'Manage habits', icon: 'manage' },
		{ id: 'calendar', title: 'Calendar', label: 'Calendar', icon: 'calendar' },
		{ id: 'settings', title: 'Settings', label: 'Settings', icon: 'settings' },
	];

	let { view, pending = null, lock, onNavigate, onAdd, limited = false } = $props();

	let nav;
	const buttons = $state({}); // view id (and 'lock', 'add') -> its button element

	/** The buttons in the row, left to right (the tour points them out). */
	export function navButtons() {
		return [...nav.children];
	}

	/** The button of view `id`. */
	export function viewButton(id) {
		return buttons[id];
	}

	/** The lock button. */
	export function lockButton() {
		return buttons.lock;
	}

	/** The buttons pop one after another, left to right (the tour's flourish). */
	export function flare() {
		[...nav.children].forEach((button, i) => {
			button.style.setProperty('--pop-delay', `${150 + i * 110}ms`);
			replayAnimation(button, 'tour-pop');
		});
	}
</script>

<header class="header">
	<h1 class="title">{VIEWS.find((v) => v.id === view)?.title}</h1>
	<nav class="nav" bind:this={nav}>
		<LockButton state={lock.state} timeLeft={lock.timeLeft} disabled={limited} onTap={lock.onTap} bind:element={buttons.lock} />
		<IconButton icon="add" ariaLabel="Add habit" disabled={limited} onTap={onAdd} bind:element={buttons.add} />
		{#each VIEWS as item (item.id)}
			<ViewButton icon={item.icon} ariaLabel={item.label} selected={item.id === view} disabled={limited && !item.limited}
				progress={pending?.view === item.id ? pending.fraction : null}
				bind:element={buttons[item.id]} onTap={() => onNavigate(item.id)}>
				{#if item.id === 'notices' && notices.tone}<span class="alert-dot tone-{notices.tone}"></span>{/if}
			</ViewButton>
		{/each}
	</nav>
</header>

<style>
	.header {
		display: flex;
		align-items: center;
		margin-bottom: 2.25rem;
	}

	.title {
		font-size: 3.25rem;
	}

	.nav {
		display: flex;
		gap: 1.25rem;
		margin-left: auto;
	}

	/* On the Notices button (which its ring makes position: relative). */
	.alert-dot {
		position: absolute;
		top: .75rem;
		right: .75rem;
		width: 1.5rem;
		height: 1.5rem;
		border: .3rem solid var(--c-fill);
		border-radius: 50%;
	}

	.alert-dot.tone-warning { background: var(--peach-edge); }
	.alert-dot.tone-error { background: var(--error); }
</style>
