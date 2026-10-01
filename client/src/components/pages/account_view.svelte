
<!--
	Account view: who's signed in, their license, and changing the account.

		License     until when it runs; renewing it with a license code or by paying
		            for days, in the currency its round button steps through (while
		            the license isn't running, this view is all that works)
		Email       the address you sign in with; changing it sends a link to the new one
		Password
		Your data   download everything; sign out; delete the account

	Every account change asks for the password first (in a pop-up, via the controller).

	Props:
		me          the account: { email, currency, license: { validUntil, endedAt } }
		locale
		prices      what days of license cost (models/license_prices.js), or null until loaded
		onRedeemCode, onChangeEmail, onChangePassword, onExport, onSignOut, onDelete
		            each gets the tapped button (pop-ups grow out of it)
		onBuy       (days, button): pay for that many days
		onNextCurrency  the currency button: the next currency
-->

<script>
	import { daysBetween, formatDate } from '../../core/dates.js';
	import { plural } from '../../core/text.js';
	import { clock } from '../../services/clock.svelte.js';
	import { DURATIONS, currencyLabel, formatPrice, priceCents } from '../../models/license_prices.js';
	import CycleButton from '../controls/cycle_button.svelte';

	let {
		me, locale, prices, onRedeemCode, onBuy, onNextCurrency, onChangeEmail, onChangePassword, onExport, onSignOut, onDelete,
	} = $props();


	let days = $state(365);

	const license = $derived(me.license);
	const date = (seconds) => formatDate(new Date(seconds * 1000), locale, 'date');
	const status = $derived(license.validUntil ? `Runs until ${date(license.validUntil)}`
		: license.endedAt ? `Ended on ${date(license.endedAt)}` : 'No license yet');
	// Calendar days, as the license notice counts them: 0 on its last day.
	const daysLeft = $derived(license.validUntil ? daysBetween(clock.now, new Date(license.validUntil * 1000)) : null);
	const cents = $derived(prices ? priceCents(days, prices, me.currency) : 0);
	const money = (amount) => formatPrice(amount, me.currency, locale);
	const currencyIcons = $derived(Object.fromEntries(Object.keys(prices?.currencies ?? {})
		.map((code) => [code, `currency_${code.toLowerCase()}`])));

	let root;
	/** Its root element (the tour points at it). */
	export function element() {
		return root;
	}
</script>

{#snippet action(label, onTap, style = '')}
	<button type="button" class="button squish {style}" onclick={(event) => onTap(event.currentTarget)}>{label}</button>
{/snippet}

<section class="view account-view scroll-area section-list" bind:this={root}>
	<div class="settings-section" class:expired={!license.validUntil} style:--i="0">
		<h2>License</h2>
		<div class="license-status">
			<span class="account-value">{status}</span>
			{#if daysLeft !== null}<span class="badge">{daysLeft ? `${plural(daysLeft, 'day')} left` : 'Last day'}</span>{/if}
		</div>
		{#if !license.validUntil}<p class="note">Renew it to use Troha again. Your habits are kept safe meanwhile.</p>{/if}
		<div class="license-parts">
			<div class="license-part">
				<h3>Buy days</h3>
				<div class="durations">
					{#each DURATIONS as choice (choice.days)}
						<button type="button" class="pill squish" class:selected={choice.days === days} aria-pressed={choice.days === days}
							onclick={() => { days = choice.days; }}>{choice.label}</button>
					{/each}
				</div>
				<div class="checkout">
					{#if prices}
						<!-- Each tap steps to the next currency (its icon: currency_<code> in icons.svg). -->
						<CycleButton name="Currency" icons={currencyIcons} choice={me.currency}
							label={currencyLabel(me.currency, locale)} onTap={onNextCurrency} />
					{/if}
					<div class="price">
						<span class="price-total">{prices ? money(cents) : ''}</span>
						<span class="price-day">{prices ? `${money(cents / days)} a day` : ''}</span>
					</div>
					<button type="button" class="button primary squish" disabled={!prices?.payments}
						onclick={(event) => onBuy(days, event.currentTarget)}>Pay</button>
				</div>
				<p class="note">
					{#if prices && !prices.payments}Paying isn’t available yet: use a license code.{:else}Added to the end of your license, so renewing early loses nothing.{/if}
				</p>
			</div>
			<div class="license-part">
				<h3>Have a code?</h3>
				<p class="note">A license code adds its days to your license, like buying them.</p>
				{@render action('Use a license code', onRedeemCode)}
			</div>
		</div>
	</div>
	<div class="settings-section" style:--i="1">
		<h2>Email</h2>
		<div class="settings-row">
			<span class="account-value">{me.email}</span>
			<span class="spacer"></span>
			{@render action('Change email', onChangeEmail)}
		</div>
		<p class="note">You sign in with it, and links to reset your password are sent to it.</p>
	</div>
	<div class="settings-section" style:--i="2">
		<h2>Password</h2>
		<div class="settings-row">{@render action('Change password', onChangePassword)}</div>
		<p class="note">Changing it signs you out everywhere else.</p>
	</div>
	<div class="settings-section" style:--i="3">
		<h2>Your data</h2>
		<div class="settings-row">
			{@render action('Download my data', onExport)}
			{@render action('Sign out', onSignOut)}
			<span class="spacer"></span>
			{@render action('Delete account', onDelete, 'danger')}
		</div>
		<p class="note">Everything is kept encrypted on the server. Deleting the account deletes all of it, for good.</p>
	</div>
</section>

<style>
	.account-value {
		font-size: 2rem;
		overflow-wrap: anywhere;
	}

	/* No running license: the section that matters now stands out. */
	.settings-section.expired {
		border-color: var(--primary);
	}

	.license-status .account-value { font-size: 2.25rem; }

	.license-status {
		display: flex;
		align-items: center;
		gap: 1.25rem;
	}

	.badge {
		padding: .4rem 1.25rem;
		border-radius: 1rem;
		background: var(--muted-fill);
		color: var(--text-soft);
		font-size: 1.5rem;
	}

	/* Buy days | Have a code?, side by side, each in its own panel. */
	.license-parts {
		display: grid;
		grid-template-columns: 5fr 3fr;
		gap: 2rem;
		margin-top: 2rem;
	}

	.license-part {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 1.25rem;
		padding: 2rem 2.25rem;
		border-radius: 1.5rem;
		background: var(--surface);
	}

	.license-part h3 {
		margin: 0;
		font-size: 2rem;
		font-weight: 500;
		color: var(--text-soft);
	}

	.license-part .note { margin: 0; }

	/* "Use a license code": at the bottom, level with Pay. */
	.license-part:last-child .button {
		margin-top: auto;
		align-self: stretch;
		white-space: nowrap;
	}

	/* The lengths: an even grid, so they line up in two rows. */
	.durations {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: .875rem;
		align-self: stretch;
	}

	.durations .pill { padding: 0 1rem; white-space: nowrap; }

	.checkout {
		margin-top: 1.25rem; /* twice the panel's gap below the lengths */
		display: flex;
		align-items: center;
		gap: 1.5rem;
		align-self: stretch;
	}

	/* The price, with what a day costs right below it: room for a long price between the currency and Pay. */
	.price {
		display: flex;
		flex-direction: column;
		gap: .25rem;
		flex: 1;
		min-width: 0;
	}

	.price-total { font-size: 3rem; font-weight: 500; line-height: 1.1; overflow-wrap: anywhere; }
	.price-day { font-size: 1.625rem; color: var(--text-soft); white-space: nowrap; }

	.checkout .button { min-width: 14rem; }

	/* The currency: a round cycle button, as tall as Pay, in the filled colours. */
	.checkout {
		--cycle-size: 5rem;
		--cycle-fill: var(--selected);
		--cycle-text: var(--selected-text);
	}

</style>
