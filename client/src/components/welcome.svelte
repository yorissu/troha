
<!--
	Welcome: what's shown until someone signs in. The usual frame (the sidebar with
	the date and the clock), and in the main area a card that is, in turn:

		sign-in    email and password
		register   a new account: email and password (twice); it starts with a free week
		forgot     an email to send a reset link to
		sent       "check your inbox"
		reset      a new password, from the emailed link (#reset=…)

	Props:
		account   the Account
		resetToken  the token from an emailed reset link (opens the card on "reset")
		onResetDone the link's token has been used (or dropped)
-->

<script>
	import { config } from '../config.js';
	import { say } from '../core/text.js';
	import { messages } from '../messages.js';
	import { formatDate } from '../core/dates.js';
	import { problemText } from '../controllers/problems.js';
	import Sidebar from './frame/sidebar.svelte';
	import FormFields from './controls/form_fields.svelte';

	let { account, resetToken = null, onResetDone } = $props();

	const TITLES = {
		'sign-in': 'Sign in to Troha',
		register: 'Create your account',
		forgot: 'Forgot your password?',
		sent: 'Check your inbox',
		reset: 'Choose a new password',
	};
	const BUTTONS = { 'sign-in': 'Sign in', register: 'Create account', forgot: 'Send me a link', sent: 'Back to sign in', reset: 'Set password' };

	// svelte-ignore state_referenced_locally (the card it opens on)
	let mode = $state(resetToken ? 'reset' : 'sign-in');
	let values = $state({ email: '', password: '', repeat: '' });
	// svelte-ignore state_referenced_locally (a greeting is shown once)
	let note = $state(account.greeting ?? '');
	let problem = $state(false);
	let busy = $state(false);
	let formFields = $state();

	/** The fields each card has, in order. */
	const FIELDS = {
		'sign-in': [
			{ name: 'email', label: 'Email', kind: 'email', autocomplete: 'username' },
			{ name: 'password', label: 'Password', kind: 'password', autocomplete: 'current-password' },
		],
		register: [
			{ name: 'email', label: 'Email', kind: 'email', autocomplete: 'username' },
			{ name: 'password', label: 'Password', kind: 'password', autocomplete: 'new-password',
				placeholder: `At least ${config.account.minPasswordLength} characters` },
			{ name: 'repeat', label: 'Password again', kind: 'password', autocomplete: 'new-password' },
		],
		forgot: [{ name: 'email', label: 'Email', kind: 'email', autocomplete: 'username' }],
		sent: [],
		reset: [
			{ name: 'password', label: 'New password', kind: 'password', autocomplete: 'new-password',
				placeholder: `At least ${config.account.minPasswordLength} characters` },
			{ name: 'repeat', label: 'New password again', kind: 'password', autocomplete: 'new-password' },
		],
	};

	function go(next) {
		mode = next;
		note = '';
		problem = false;
		values.password = '';
		values.repeat = '';
	}

	function showProblem(message) {
		note = message;
		problem = true;
	}

	/** A server answer that wasn't ok: marks the field it's about, or says it in the note. */
	function failed(answer, names) {
		const result = problemText(answer, names);
		formFields.markProblem(result);
		showProblem(result.message);
	}

	async function submit() {
		if (busy) return;
		if (mode === 'sent') {
			go('sign-in');
			return;
		}
		if (formFields.markMissing()) return;
		if ((mode === 'register' || mode === 'reset') && values.password !== values.repeat) {
			formFields.markProblem({ field: 'repeat', message: 'The passwords don’t match', clear: true });
			return;
		}
		busy = true;
		try {
			await send();
		} finally {
			busy = false;
		}
	}

	async function send() {
		const email = values.email.trim();
		if (mode === 'sign-in') {
			const answer = await account.signIn(email, values.password);
			if (!answer.ok) failed(answer, { passwordField: 'password', emailField: 'email' });
		} else if (mode === 'register') {
			const answer = await account.register(email, values.password);
			const trialEnd = answer.license?.validUntil; // none if this email had its free trial already
			if (answer.ok) account.greeting = trialEnd
				? `${say(messages.welcome)} It’s free until ${formatDate(new Date(trialEnd * 1000), config.locale, 'date')}`
				: `${say(messages.welcome)} This email had its free trial already: renew your license to start`;
			else failed(answer, { emailField: 'email', newPasswordField: 'password' });
		} else if (mode === 'forgot') {
			const answer = await account.forgot(email);
			if (answer.ok) go('sent');
			else failed(answer, { emailField: 'email' });
		} else if (mode === 'reset') {
			const answer = await account.reset(resetToken, values.password);
			if (answer.ok || answer.reason === 'link') onResetDone();
			if (answer.ok) account.greeting = 'Password changed. Welcome back';
			else if (answer.reason === 'link') { go('forgot'); showProblem(problemText(answer).message); }
			else failed(answer, { newPasswordField: 'password' });
		}
	}
</script>

{#snippet link(label, next)}
	<button type="button" class="button link squish" onclick={() => go(next)}>{label}</button>
{/snippet}

<Sidebar />

<main class="main welcome">
	{#key mode}
		<form class="welcome-card" data-keyboard-lift novalidate autocomplete="on" onsubmit={(event) => { event.preventDefault(); submit(); }}>
			<h2>{TITLES[mode]}</h2>
			{#if mode === 'sent'}
				<p class="note">If that email has an account, a link to set a new password is on its way. It works for 30 minutes.</p>
			{:else if note}
				<p class="note" class:problem>{note}</p>
			{/if}
			<FormFields bind:this={formFields} fields={FIELDS[mode]} bind:values idPrefix="welcome" />
			<div class="welcome-actions">
				{#if mode === 'sign-in'}
					{@render link('Forgot password?', 'forgot')}
					{@render link('Create an account', 'register')}
				{:else if mode !== 'sent'}
					{@render link('Back to sign in', 'sign-in')}
				{/if}
				<span class="spacer"></span>
				<button type="submit" class="button primary squish" disabled={busy}>{busy ? 'One moment…' : BUTTONS[mode]}</button>
			</div>
		</form>
	{/key}
</main>

<style>
	.welcome {
		justify-content: center;
		align-items: center;
	}

	/* A card like a pop-up's, in the middle of the main area; its contents rise in. */
	.welcome-card {
		display: flex;
		flex-direction: column;
		width: 60rem;
		max-height: 100%;
		overflow-y: auto;
		padding: 3rem 3.5rem;
		border: .3rem solid var(--edge);
		border-radius: 2.5rem;
		background: var(--surface);
		--rise: 1rem;
	}

	/* Everything in it keeps its size (a card too tall for the screen scrolls), its
	   fields too, though other components draw them. */
	.welcome-card > :global(*) {
		flex-shrink: 0;
		animation: rise-in .5s ease-out both;
	}

	.welcome-card h2 { font-size: 2.75rem; margin-bottom: .5rem; }
	.note.problem { color: var(--error); }

	.welcome-actions {
		display: flex;
		align-items: center;
		gap: .5rem;
		margin-top: 2.5rem;
	}

	.welcome-actions .link { padding: 0 .75rem 0 0; }
</style>
