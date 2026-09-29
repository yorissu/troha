
# Troha (TRacker Of HAbits)

A calm habit board for a wall-mounted touchscreen. It runs entirely on the device: a tiny local server plus a web page, with nothing loaded from the internet.

## What you need

- Python 3 (already installed on Raspberry Pi OS). Nothing else to install or build.
- Chromium, or any modern browser, to show the page.
- A 1920×1080 screen works best. Other screen shapes get the same layout, scaled, with dark bars at the edges.

## Run it

```bash
python3 server.py
```

Open <http://127.0.0.1:8080>. Stop the server with Ctrl+C. To use another port, set `TROHA_PORT` first, e.g. `TROHA_PORT=9000 python3 server.py`.

Your habits are saved in the `data` folder, in `data/habits.json` to begin with. Copy the folder to back them up. You can keep several data files there and switch between them in **Settings → Data file**. (An older `habits.json` next to `server.py` is moved into `data` by itself.)

## Using Troha

- **Today** shows today's habits. Tap one to tick it off, tap again to untick. Tick them all for a small celebration.
- **Calendar** shows a ring for each day: how much got done. The **eraser** button lets you tap days to remove their counters; tap it again, leave the Calendar, or wait 10 seconds to stop.
- **Manage** lists all habits. Tap one to edit or delete it.
- **Undo**: after deleting a habit or clearing days, the message at the bottom offers *Undo* for a few seconds.
- **+** adds a habit: name, days, repeat (every 1–4 weeks), start date, colour, and whether it's private.
- **Private habits** show as blank bars until you log in with your PIN (lock button, top right). The first tap on the lock button sets up the PIN. You're logged out after a minute without a touch. A forgotten PIN can only be reset, which deletes all private habits.
- **The three round buttons under the clock** each step through three settings:
	- **Theme**: Light, Dark, Auto (dark during the night time).
	- **Brightness**: Bright, Dim, Auto (dim during the sleep time).
	- **Screen**: Always on; Off when idle (black after 2 minutes without a touch); Auto (the same, but only during the sleep time). While the screen may go black, the button's border counts down to it. A tap wakes the screen and does nothing else.
- **Settings** (gear button, top right). Changes apply right away; no PIN needed.
	- **Data file**: which file in the `data` folder your habits, ticks and settings live in. Type to search the files, tap one to use it, or type a new name and tap *Create* for a fresh start. The bin button deletes a file for good (after asking; not the one in use). Each file has its own habits, settings and PIN.
	- **Night and sleep**: the night (left) is when the Auto theme turns dark; the sleep time (right) is when Auto brightness dims and the Auto screen goes off when idle. Sleep always lies within the night: the clock only offers times inside it. Tap a time to change it on the clock.
	- **Date and time**: the date and the time are always on show. Tap either to set it yourself (calendar or clock), or tap *Get from the network*. (Only changes the Pi's clock, once set up as below; elsewhere it can be tried out, but the clock stays as it is.)
	- **Motion**: *Bouncy* (things pop, bounce and slide) or *Calm* (no animations at all).

At midnight the board moves to the new day by itself. After 2 minutes without a touch it returns to Today. To protect the screen, the whole board moves by a pixel or two every hour.

On a Raspberry Pi touch display, dimming turns the backlight down and "screen off" switches it off, so the screen really gives off no light and saves power. Screens whose backlight Troha can't control (most HDMI monitors, or a computer while developing) get the page darkened instead.

## Raspberry Pi

1. Copy this folder to the Pi, e.g. `/home/pi/troha`.
2. **Set it up**, once, as the desktop user (not with sudo; it asks for your password when it needs it):
	```bash
	sh /home/pi/troha/pi/install.sh
	```
	It sets up:
	- the server as a service (`troha.service`), started at boot and again whenever it stops;
	- Chromium, full-screen, started with the desktop (Raspberry Pi OS Bookworm's labwc desktop) and again whenever it closes. The mouse pointer is hidden;
	- permission to set the clock (Settings → *Date and time*) and to dim and switch off the backlight;
	- the system's own screen blanking off (Troha switches the screen off itself).

	Then reboot: `sudo reboot`. Running it again is safe. On a desktop other than labwc it prints the line to add to that desktop's autostart (Wayfire: under `[autostart]` in `~/.config/wayfire.ini`; X11/LXDE: `~/.config/lxsession/LXDE-pi/autostart`, with `@` in front).
3. **Keyboard.** Troha has its own on-screen keyboard. Leave the Pi's on-screen keyboard off (*Raspberry Pi Configuration* → *Display*), so two don't appear.
4. **Correct time.** The Pi sets its clock from the network. Keep it on Wi-Fi, or fit a clock battery, or the date may be wrong after a power cut. The time zone is set in `sudo raspi-config` → *Localisation Options* → *Timezone*.

The server's messages: `journalctl -u troha`.

**Uninstall** (e.g. to set it up again from scratch), then reboot:
```bash
sh /home/pi/troha/pi/uninstall.sh
```
It undoes everything `install.sh` did: the kiosk and server stop and no longer start at boot, the clock and backlight permissions are removed, the system's screen blanking is back on, and the kiosk's Chromium profile is deleted. The Troha folder and your data are kept; delete the folder yourself if you want them gone. To set it up again, run `install.sh`.

## Changing things

- **Settings** (language, colours offered, screen care, PIN rules, timings, how long messages stay, the easter eggs): `web/config.js`, grouped by what they're for. The night and sleep times, and Theme, Brightness, Screen and Motion, are set in the app itself.
- **What Troha says** (greetings, cheers, the PIN pad's remarks, the calendar's "hey!"…): `web/messages.js`. Each message is a list of ways to say it; one is picked at random, never the same one twice in a row. Add as many as you like.
- **Colours and look**: `web/styles/tokens.css` (the dark theme has its own block there).
- After changing a file, reload the page (F5 on a keyboard, or reboot the Pi).

## Code layout

The page is plain HTML, CSS and JavaScript modules, organised as model-view-controller:

| Folder | What's in it |
| --- | --- |
| `web/config.js` | Settings |
| `web/messages.js` | What Troha says: the remarks it picks from |
| `web/core/` | Shared helpers: dates, schedule rules, DOM helpers, text (incl. the random-remark picker), fuzzy search, clock, idle timer, taps (one touch = one tap), crypto |
| `web/models/` | Data and rules: habits, the daily log, settings, logging in, talking to the server |
| `web/views/` | The UI components, one folder each (its `.js`, and its `.css` if it needs its own styles), grouped: `base/`, `controls/`, `frame/` (sidebar and header), `pages/`, `sheets/` (pop-ups) and `overlays/` |
| `web/controllers/` | Connect models and views; `app_controller.js` wires everything |
| `web/styles/` | Shared styles: fonts, colours (`tokens.css`), basics, animations, controls, layout |
| `web/assets/` | Fonts and the icon sprite |
| `server.py` | Starts the local server |
| `backend/` | The server's parts: data files, clock, backlight, web requests |
| `data/` | Your data files (not stored in git) |
| `pi/` | Raspberry Pi setup: `install.sh` and `uninstall.sh`, the `troha.service` service, `kiosk.sh` (Chromium full-screen), and the clock and backlight permissions |

Every view is a class that builds its own element, starting from a few base classes:

```
Component                 root element (base/component)
├── Button                label and/or icon, squish on press, active/disabled (base/button)
│   ├── IconButton        square icon button, plain or in a habit colour
│   ├── PickButton        filled pill with an icon and a value (date, time, file); opens a picker
│   ├── CycleButton       round button stepping through settings
│   │   └── ThemeButton, BrightnessButton, ScreenButton (+ TimeoutRing)
│   └── TimeoutButton     a button with a TimeoutRing
│       ├── LockButton
│       └── ClearButton
├── PillRow               a row of choice pills
├── MonthBar              ‹ month › (Calendar and date picker), with weekdayRow()
├── ClockDial             round 24-hour clock face: hours outside, minutes inside
├── TimeoutRing           turns a button's border into a countdown
├── Sidebar, Header                                          (frame/)
├── TodayView, HabitCard, CalendarView, ManageView, SettingsView  (pages/)
├── Toast, Confetti, NightShade, OnScreenKeyboard            (overlays/)
├── SheetHost             the overlay that shows one pop-up at a time (base/sheet)
└── Sheet                 pop-up base (base/sheet)
	└── ConfirmSheet, PinPad, DatePicker, TimePicker, FilePicker, HabitEditor  (sheets/)
```

Shared styles, instead of each component repeating them: buttons, pills, pick buttons, notes (`.note`), text fields and the hidden-name bar (`.redacted`) in `web/styles/controls.css`; the scrolling column (`.scroll-area`) and empty messages in `web/styles/layout.css`; animations such as `rise-in` in `web/styles/animations.css`.

To add a component: create `web/views/<group>/<name>/<name>.js` (a class extending one of these) and, if it needs styles, `<name>.css` (import it in `web/main.css`, in its group), then create it in `web/controllers/app_controller.js`. A new page also needs an entry in the header's list of views (`frame/header/header.js`).

Indentation is tabs, shown 4 spaces wide (`.editorconfig` and `.vscode/settings.json` set this up in most editors).
