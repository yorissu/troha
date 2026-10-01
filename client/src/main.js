
/**
 * Troha's page: a habit board, for a wall-mounted touchscreen or any browser.
 *
 * Code layout:
 *   config.js       settings
 *   messages.js     what Troha says
 *   styles/         shared styles: fonts, colours (tokens.css), basics, animations,
 *                   controls, layout, pop-up sheets
 *   core/           plain helpers (dates, schedule rules, text, taps, the DOM)
 *   services/       one of each for the whole page, imported wherever needed: the
 *                   clock, the idle timer, the toast, notices, confetti
 *   models/         data and rules: the account, the habits, the PIN lock, settings,
 *                   talking to the server
 *   components/     what's on screen, as Svelte components (markup, logic and styles
 *                   in one file), grouped: base, controls, frame, pages, sheets
 *                   (pop-ups), overlays, keyboard (the on-screen one); plus the
 *                   screens: welcome, board
 *   controllers/    what taps do: they connect the models and the components;
 *                   app_controller.svelte.js wires the board together
 *   app.svelte      the whole page
 */

import { mount } from 'svelte';
import './styles/fonts.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/animations.css';
import './styles/controls.css';
import './styles/layout.css';
import './styles/sheets.css';
import { ignoreCopiedTaps, keepEdgeTaps } from './core/taps.js';
import App from './app.svelte';

// One touch, one tap (first, so extra clicks reach nobody); and taps at a button's edge count.
ignoreCopiedTaps(document);
keepEdgeTaps(document);
mount(App, { target: document.body });
