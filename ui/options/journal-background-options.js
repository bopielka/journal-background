/**
 * The one setting of this mod - how opaque the journal's background is - and its slider under the
 * shared "Mods" tab.
 *
 * ⚠️ Loads in SHELL scope as well as game scope: the options screen exists in the main menu, where
 * there is no game. Nothing here may touch the game at import time; the stored value is read lazily
 * on first ask.
 */

import '/core/ui/options/screen-options.js';  // must load before the model is touched
import { CategoryType, Options, OptionType } from '/core/ui/options/model-options.js';
import { CategoryData } from '/core/ui/options/options-helpers.js';
import { flushNajaneOptions, registerNajaneOptions } from './najane-mod-options-registry.js';

// ⚠️ Shared with several community mods - created with ??= and the id "mods", never replaced.
CategoryType["Mods"] = "mods";
CategoryData[CategoryType.Mods] ??= {
    title: "LOC_UI_CONTENT_MGR_SUBTITLE",
    description: "LOC_UI_CONTENT_MGR_SUBTITLE_DESCRIPTION",
};

const MOD_ID = "journal-background";

export const JournalBackgroundChangedEventName = "journal-background-changed";

/**
 * Percent, because that is what the slider prints and what the player is choosing.
 * ⚠️ `step` must divide the range: `steps` below is derived from it.
 */
export const OPACITY_RANGE = { min: 0, max: 100, step: 5, defaultValue: 90 };

const OPTION_OPACITY = "opacity";

/**
 * ⚠️ STORED AS VALUE + 1. The range reaches 0, and a stored 0 / null is what "never written" reads
 * back as - without the offset a player who chose 0% would get the default back on restart.
 */
const STORED_OFFSET = 1;

/**
 * ⚠️ `localStorage` ONLY UNDER `modSettings[MOD_ID]`, read-merge-write. Several published mods
 * `localStorage.clear()` whenever there is more than one top-level key, so a key of our own would
 * wipe every mod's settings. It is only a mirror: `UI.setOption` + `saveCheckpoint()` is primary.
 */
function readMirror(id) {
    try {
        const shared = JSON.parse(localStorage.getItem("modSettings") || "{}");
        return shared?.[MOD_ID]?.[id] ?? null;
    } catch (e) {
        return null;
    }
}

function writeMirror(id, code) {
    try {
        const shared = JSON.parse(localStorage.getItem("modSettings") || "{}");
        shared[MOD_ID] ??= {};
        shared[MOD_ID][id] = code;
        localStorage.setItem("modSettings", JSON.stringify(shared));
    } catch (e) {
        // The mirror is a bonus; losing it means "back to the default", never a broken state.
    }
}

function readStored(id) {
    let code = null;
    try {
        code = UI.getOption("user", "Mod", `${MOD_ID}.${id}`);
    } catch (e) {
        console.error(`journal-background: could not read option ${id}: ${e}`);
    }
    code ??= readMirror(id);
    const value = Number(code);
    return Number.isFinite(value) ? value : 0;
}

function writeStored(id, code) {
    try {
        UI.setOption("user", "Mod", `${MOD_ID}.${id}`, code);
        Configuration.getUser().saveCheckpoint();
    } catch (e) {
        console.error(`journal-background: could not save option ${id}: ${e}`);
    }
    writeMirror(id, code);
}

function snap(value) {
    const { min, max, step, defaultValue } = OPACITY_RANGE;
    const number = Number(value);
    if (!Number.isFinite(number)) {
        return defaultValue;
    }
    const stepped = min + Math.round((number - min) / step) * step;
    return Math.min(max, Math.max(min, stepped));
}

let cachedOpacity = null;

export function journalOpacityPercent() {
    if (cachedOpacity === null) {
        const code = readStored(OPTION_OPACITY);
        cachedOpacity = code >= STORED_OFFSET ? snap(code - STORED_OFFSET) : OPACITY_RANGE.defaultValue;
    }
    return cachedOpacity;
}

/**
 * ⚠️ WRITES AND ANNOUNCES ONLY WHEN THE SNAPPED VALUE MOVES. A slider calls its listener on every
 * mouse-move of a drag, and each write is a `saveCheckpoint()` disk flush.
 *
 * @returns the value actually stored - the options screen prints it beside the slider.
 */
export function setJournalOpacityPercent(value) {
    const next = snap(value);
    if (next !== journalOpacityPercent()) {
        cachedOpacity = next;
        writeStored(OPTION_OPACITY, next + STORED_OFFSET);
        window.dispatchEvent(new CustomEvent(JournalBackgroundChangedEventName));
    }
    return next;
}

const OPTION_SOLID = "solidBackground";
const STORED_OFF = 1;
const STORED_ON = 2;

let cachedSolid = null;

/** Solid navy instead of the game's hover gradient. Off by default. */
export function isSolidBackground() {
    if (cachedSolid === null) {
        cachedSolid = readStored(OPTION_SOLID) === STORED_ON;
    }
    return cachedSolid;
}

export function setSolidBackground(value) {
    const next = !!value;
    if (next !== isSolidBackground()) {
        cachedSolid = next;
        writeStored(OPTION_SOLID, next ? STORED_ON : STORED_OFF);
        window.dispatchEvent(new CustomEvent(JournalBackgroundChangedEventName));
    }
}

/**
 * ⚠️ `najane_mods_*` is the heading convention shared by every Najane mod; the heading text is
 * derived as `LOC_OPTIONS_GROUP_<GROUP IN CAPITALS>`, so the tag in text/ must be kept in step.
 */
const GROUP_JOURNAL = "najane_mods_journal";

/**
 * ⚠️ `sort: 40` - after specialists (10), city (20) and commerce (30), so the Najane sections stay
 * in one fixed order whichever mod loads first. See najane-mod-options-registry.js.
 */
registerNajaneOptions({
    sort: 40,
    probeId: "journal-background-opacity",
    add: () => {
        Options.addOption({
            category: CategoryType.Mods,
            group: GROUP_JOURNAL,
            type: OptionType.Slider,
            id: "journal-background-opacity",
            min: OPACITY_RANGE.min,
            max: OPACITY_RANGE.max,
            // ⚠️ The number of INTERVALS, not the size of one - `fxs-slider` divides the range by it.
            steps: (OPACITY_RANGE.max - OPACITY_RANGE.min) / OPACITY_RANGE.step,
            initListener: (info) => {
                info.currentValue = journalOpacityPercent();
            },
            // ⚠️ Writing the SNAPPED value back is what keeps "63.7" off the screen beside the slider.
            updateListener: (info, value) => {
                info.currentValue = setJournalOpacityPercent(value);
            },
            label: "LOC_OPTIONS_JOURNAL_BACKGROUND_OPACITY",
            description: "LOC_OPTIONS_JOURNAL_BACKGROUND_OPACITY_DESCRIPTION",
        });
        Options.addOption({
            category: CategoryType.Mods,
            group: GROUP_JOURNAL,
            type: OptionType.Checkbox,
            id: "journal-background-solid",
            initListener: (info) => {
                info.currentValue = isSolidBackground();
            },
            updateListener: (_info, value) => setSolidBackground(value),
            label: "LOC_OPTIONS_JOURNAL_BACKGROUND_SOLID",
            description: "LOC_OPTIONS_JOURNAL_BACKGROUND_SOLID_DESCRIPTION",
        });
    },
});

// ⚠️ Every Najane mod registers this same flush; the first one to fire adds all of them.
Options.addInitCallback(flushNajaneOptions);
