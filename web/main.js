
/**
 * Troha: a habit board for a wall-mounted touchscreen.
 *
 * Code layout (model-view-controller):
 *   config.js     settings
 *   core/         shared helpers (dates, schedule rules, text, crypto, DOM, clock,
 *                 idle timer, taps, fuzzy search)
 *   models/       data and rules: habits, the daily log, settings, the PIN session,
 *                 talking to the server
 *   views/        UI components, one folder each (.js + .css), grouped: base,
 *                 controls, frame, pages, sheets (pop-ups), overlays. They only show
 *                 things and report taps through callbacks
 *   controllers/  connect models and views; app_controller.js wires everything
 */

import { AppController } from './controllers/app_controller.js';
import { ignoreCopiedTaps, keepEdgeTaps } from './core/taps.js';

// One touch, one tap (first, so extra clicks reach nobody); and taps at a button's edge count.
ignoreCopiedTaps(document);
keepEdgeTaps(document);
// Opened as the kiosk (pi/kiosk.sh adds ?kiosk): no mouse pointer on the touchscreen.
document.documentElement.classList.toggle('kiosk', new URLSearchParams(location.search).has('kiosk'));
new AppController(document.getElementById('stage')).start();
