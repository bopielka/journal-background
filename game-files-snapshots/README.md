# Game file snapshots

1:1 copies of the original game files this mod depends on, one sub-folder per game version, as in
the sibling mods. Never deployed. Keep at most two versions: the newest and one back.

| File | Why |
|---|---|
| `base-standard/ui/quest-tracker/quest-list.js` | defines `quest-list` and renders `.quest-item-container`, the element the background is drawn on; `Controls.decorate` target, whose `updateQuestContainerVisibility` and `visibleQuests` the empty-journal hiding depends on |
| `base-standard/ui/quest-tracker/quest-list.css` | the hover gradient this mod copies, and the container's `max-height` |

After a game update: diff these against the new game files. If `.quest-item-container` is renamed
or the hover gradient changes, update `ui/journal-background.js`.
