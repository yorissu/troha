
<!--
	Troha: the whole page. A fixed 1920×1080 stage (scaled to fit the screen; see
	styles/base.css) showing one of:

		the welcome card   nobody is signed in (or a password reset link was opened)
		the habit board    signed in (only the account, while the license isn't running)

	Over all of them, the on-screen keyboard, and the server-down
	pop-up while the server can't be reached.

	Links from emails open the page with #reset=… (set a new password) or
	#confirm-email=… (a new email address); they're read once, then cleared.
-->

<script>
	import { onMount } from 'svelte';
	import { config } from './config.js';
	import { clock } from './services/clock.svelte.js';
	import { Account } from './models/account.svelte.js';
	import { ServerController } from './controllers/server_controller.svelte.js';
	import { reasonText } from './controllers/problems.js';
	import Board from './components/board.svelte';
	import Welcome from './components/welcome.svelte';
	import Sidebar from './components/frame/sidebar.svelte';
	import ServerDown from './components/overlays/server_down.svelte';
	import Keyboard from './components/keyboard/keyboard.svelte';

	const account = new Account();
	const server = new ServerController({
		timing: config.timing,
		onSignedOut: () => account.sessionEnded(),
		onNoLicense: () => account.licenseEnded(),
	});
	const links = readLinks();

	let stage = $state();
	let resetToken = $state(links.reset);
	let shown = null; // what the board started as: 'licensed' or 'unlicensed'

	onMount(async () => {
		server.start();
		clock.start();
		await account.check();
		if (links.confirmEmail) {
			const answer = await account.confirmEmail(links.confirmEmail);
			account.greeting = answer.ok ? `Your email is now ${answer.email}` : reasonText(answer.reason);
		}
	});

	// Leaving the board (signed out), or the license starting or ending: start afresh.
	$effect(() => {
		const now = account.state === 'ready' ? (account.licensed ? 'licensed' : 'unlicensed') : null;
		if (shown && now !== shown) setTimeout(() => location.reload()); // after whatever caused it is done (e.g. leaving a greeting)
		else shown = now;
	});

	/** The tokens from an emailed link in the address (#reset=… or #confirm-email=…), then clears it. */
	function readLinks() {
		const hash = new URLSearchParams(location.hash.slice(1));
		const found = { reset: hash.get('reset'), confirmEmail: hash.get('confirm-email') };
		if (found.reset || found.confirmEmail) history.replaceState(null, '', location.pathname + location.search);
		return found;
	}
</script>

<div class="stage" bind:this={stage}>
	{#if resetToken || account.state === 'signed-out'}
		<Welcome {account} {resetToken} onResetDone={() => { resetToken = null; }} />
	{:else if account.state === 'ready'}
		<Board {account} stage={() => stage} />
	{:else}
		<Sidebar />
		<main class="main"></main>
	{/if}
	<Keyboard />
	<ServerDown shown={server.down} />
</div>
