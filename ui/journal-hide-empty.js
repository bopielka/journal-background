/**
 * Hides the whole journal (`quest-list`) while no quest is shown in it. The game keeps drawing the
 * "Journal" title with nothing under it - and with this mod, an empty framed box.
 *
 * ⚠️ HOOKED ON `updateQuestContainerVisibility`, the one method the component runs after every
 * list rebuild and every drawer toggle, and it reads the same `visibleQuests` the game uses to grey
 * out its own toggle. Patched on the INSTANCE from a decorator, so other mods patching the
 * prototype survive.
 *
 * ⚠️ OUR OWN CLASS, NOT THE GAME'S `hidden`: the component toggles `hidden` itself when a lens with
 * a legend opens, and the two would undo each other.
 *
 * ⚠️ Independent of the opacity slider - an empty title is noise whether or not it has a frame.
 */

const EMPTY_CLASS = "najane-journal-empty";

const styleElement = document.createElement("style");
styleElement.textContent = `
quest-list.${EMPTY_CLASS} {
    display: none;
}
`;
document.head.appendChild(styleElement);

function syncEmpty(component) {
    try {
        const count = component.visibleQuests?.length ?? 0;
        component.Root?.classList.toggle(EMPTY_CLASS, count == 0);
    } catch (error) {
        console.error(`journal-background: could not update the empty-journal state: ${error}`);
    }
}

class JournalHideEmpty {
    constructor(component) {
        this.component = component;
        const original = component.updateQuestContainerVisibility;
        if (typeof original !== "function") {
            console.error("journal-background: quest-list has no updateQuestContainerVisibility - empty journal stays visible");
            return;
        }
        component.updateQuestContainerVisibility = function (...args) {
            const result = original.apply(this, args);
            syncEmpty(this);
            return result;
        };
    }

    beforeAttach() { }

    afterAttach() {
        syncEmpty(this.component);
    }

    beforeDetach() { }

    afterDetach() { }

    onAttributeChanged(_name, _prev, _next) { }
}

Controls.decorate("quest-list", (component) => new JournalHideEmpty(component));
