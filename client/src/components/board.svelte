
<!--
	The habit board: everything you see once signed in. The sidebar on the left, the
	header and the current view on the right, and on top of them the pop-ups,
	confetti, toasts, the tour and the night shade. While the license isn't running,
	only the Account view (to renew it) and Notices are there, and every other button is off.

	The AppController (controllers/app_controller.svelte.js) does the thinking; this
	only lays things out and hands each part what it shows and what to call.

	Props:
		account   the Account (who's signed in)
		stage     () => the stage element (screen care moves it a pixel or two now and then)
-->

<script>
	import { onMount } from 'svelte';
	import { config } from '../config.js';
	import { weekdayNames } from '../core/dates.js';
	import { messages } from '../messages.js';
	import { AppController } from '../controllers/app_controller.svelte.js';
	import { choiceButton } from '../models/settings.js';
	import { clock } from '../services/clock.svelte.js';
	import { idle } from '../services/idle.js';
	import SheetLayer from './base/sheet_layer.svelte';
	import Sidebar from './frame/sidebar.svelte';
	import Header from './frame/header.svelte';
	import CycleButton from './controls/cycle_button.svelte';
	import TodayView from './pages/today_view.svelte';
	import CalendarView from './pages/calendar_view.svelte';
	import ManageView from './pages/manage_view.svelte';
	import SettingsView from './pages/settings_view.svelte';
	import AccountView from './pages/account_view.svelte';
	import NoticesView from './pages/notices_view.svelte';
	import HabitEditor from './sheets/habit_editor.svelte';
	import ConfirmSheet from './sheets/confirm_sheet.svelte';
	import PinPad from './sheets/pin_pad.svelte';
	import DatePicker from './sheets/date_picker.svelte';
	import TimePicker from './sheets/time_picker.svelte';
	import FormSheet from './sheets/form_sheet.svelte';
	import Toast from './overlays/toast.svelte';
	import Confetti from './overlays/confetti.svelte';
	import Tour from './overlays/tour.svelte';
	import NightShade from './overlays/night_shade.svelte';

	let { account, stage } = $props();

	/** The components the controllers use, filled in below as they appear (bind:this). */
	const views = $state({});
	// svelte-ignore state_referenced_locally (the board's models stay the same while it's on screen)
	const app = new AppController({ account, stage, views });
	const { store, lock, habits, hidden, theme, screen, settings, accountActions, tour } = app;
	const dayLetters = weekdayNames(config.locale, 'narrow');

	onMount(() => app.start());
</script>

<Sidebar bind:this={views.sidebar} progress={app.ready ? habits.progress() : null} onTickle={() => views.today.tickle()}>
	{#if app.ready}
		{@const s = store.settings}
		<CycleButton {...choiceButton('theme', s.theme)} bind:element={views.theme} onTap={() => theme.next()} />
		<CycleButton {...choiceButton('brightness', s.brightness)} bind:element={views.brightness} onTap={() => screen.nextBrightness()} />
		<CycleButton {...choiceButton('screen', s.screen)} timeLeft={screen.timeLeft} bind:element={views.screen}
			onTap={() => screen.nextScreen()} />
	{/if}
</Sidebar>

<main class="main">
	<Header bind:this={views.header} view={app.view}
		lock={{ state: hidden.buttonState, timeLeft: hidden.timeLeft, onTap: (element) => hidden.tapLockButton(element) }}
		onNavigate={(view) => app.showView(view)} onAdd={(element) => habits.add(element)}
		pending={app.idleReturn.pending} limited={!account.licensed} />
	{#if app.ready || !account.licensed}
		<div class="view-slot" hidden={app.view !== 'notices'}>
			<NoticesView bind:this={views.notices} locale={config.locale} />
		</div>
		<div class="view-slot" hidden={app.view !== 'account'}>
			<AccountView bind:this={views.account} me={account.me} locale={config.locale} prices={accountActions.prices}
				onRedeemCode={(element) => accountActions.redeemCode(element)}
				onBuy={(days, element) => accountActions.buy(days, element)}
				onNextCurrency={() => accountActions.nextCurrency()}
				onChangeEmail={(element) => accountActions.changeEmail(element)}
				onChangePassword={(element) => accountActions.changePassword(element)}
				onExport={(element) => accountActions.exportData(element)}
				onSignOut={(element) => accountActions.signOut(element)}
				onDelete={(element) => accountActions.deleteAccount(element)} />
		</div>
	{/if}
	{#if app.ready}
		<div class="view-slot" hidden={app.view !== 'today'}>
			<TodayView bind:this={views.today} items={habits.todayItems()} emptyMessage={habits.emptyToday()} layout={config.today}
				onCardTap={(card) => habits.tapCard(card)} />
		</div>
		<div class="view-slot" hidden={app.view !== 'manage'}>
			<ManageView bind:this={views.manage} items={habits.manageItems()} {dayLetters} emptyMessage={habits.emptyManage()}
				onCardTap={(id, card) => habits.tapManageCard(id, card)} />
		</div>
		<div class="view-slot" hidden={app.view !== 'calendar'}>
			<CalendarView bind:this={views.calendar} onScreen={app.view === 'calendar'} dayNames={app.dayNames}
				entry={(day) => store.entry(day)} planned={(day) => habits.plannedOn(day)}
				habitColor={(id) => habits.colorOf(id)} streak={store.streak(clock.day)} />
		</div>
		<div class="view-slot" hidden={app.view !== 'settings'}>
			<SettingsView bind:this={views.settings} settings={store.settings}
				hasPin={lock.hasPin} onChangePin={(element) => hidden.changePin(element)}
				onPickRangeTime={(range, which, element) => settings.pickRangeTime(range, which, element)}
				onStartTour={() => tour.start()} />
		</div>
	{/if}
</main>

<!-- Pop-ups, confetti and toasts on top; then the tour, which covers all of them; the night shade over everything. -->
<SheetLayer>
	<HabitEditor bind:this={views.editor} locale={config.locale} dayNames={app.dayNames}
		colors={config.colors} repeatChoices={config.editor.repeatChoices} nameMaxLength={config.editor.nameMaxLength}
		datePicker={{ pick: (request) => views.datePicker.pick(request) }} today={() => clock.day} canChooseHidden={() => lock.unlocked}
		onAdd={(fields) => habits.added(fields)} onChange={(habit, fields) => habits.changed(habit, fields)}
		onDelete={(habit, element) => habits.askDelete(habit, element)}
		onNeedUnlock={(element) => habits.unlockToHide(element)} />
	<ConfirmSheet bind:this={views.confirm} />
	<ConfirmSheet bind:this={views.lockConfirm} />
	<PinPad bind:this={views.pinPad} {lock} limits={config.pin}
		remarks={{ wrongPin: messages.wrongPin, niceTry: messages.niceTry }}
		onDone={(how) => hidden.padDone(how)} onForgot={(element) => hidden.forgot(element)} />
	<DatePicker bind:this={views.datePicker} locale={config.locale} dayNames={app.dayNames} />
	<TimePicker bind:this={views.timePicker} minuteStep={config.timePicker.minuteStep} />
	<FormSheet bind:this={views.form} />
</SheetLayer>
<Confetti />
<Toast />
<Tour bind:this={views.tour} onNext={() => tour.next()} onBack={() => tour.back()} onSkip={() => tour.skip()} />
<NightShade dim={screen.dim} blank={screen.blank} onWake={() => idle.touch()} />

<style>
	/* Each view keeps its place in the main area's column (hidden ones take none). */
	.view-slot {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
	}
</style>
