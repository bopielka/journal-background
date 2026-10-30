#!/usr/bin/env bash
#
# Deploys "Better Journal UI" into Civilization VII's mod folder.
#
# The game folder is build output: it is wiped and rebuilt on every run, and only the .modinfo,
# ui/, text/ and texture/ are copied - README, this script, .git and game-files-snapshots/ stay out by construction.
#
# Usage:  ./deploy.sh          deploy
#         ./deploy.sh --dry    show what would happen, change nothing
#         CIV7_MODS_DIR="/path/to/Mods" ./deploy.sh
#
set -euo pipefail

MOD_ID="journal-background"
CONTENT_DIRS=(ui text texture)

case "$(uname -s)" in
    Darwin) DEFAULT_MODS_DIR="$HOME/Library/Application Support/Civilization VII/Mods" ;;
    *)      DEFAULT_MODS_DIR="${LOCALAPPDATA:-$HOME/AppData/Local}/Firaxis Games/Sid Meier's Civilization VII/Mods" ;;
esac

SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEST_ROOT="${CIV7_MODS_DIR:-$DEFAULT_MODS_DIR}"
DEST_DIR="$DEST_ROOT/$MOD_ID"

DRY_RUN=0
[[ "${1:-}" == "--dry" ]] && DRY_RUN=1

say() { printf '%s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

# Double-clicked in Explorer the window closes the instant the script ends; hold it open then.
if [[ $- == *i* ]]; then
    trap 'printf "\nPress Enter to close... "; read -r' EXIT
fi

# --- safety: never let a bad path turn this into a destructive command --------
[[ -f "$SRC_DIR/$MOD_ID.modinfo" ]] || die "$MOD_ID.modinfo not found in $SRC_DIR."
[[ "$(basename "$DEST_DIR")" == "$MOD_ID" ]] || die "refusing to touch '$DEST_DIR'."
[[ -d "$DEST_ROOT" ]] || die "Civ VII mods folder not found: $DEST_ROOT (set CIV7_MODS_DIR)"

say "source: $SRC_DIR"
say "target: $DEST_DIR"

if [[ $DRY_RUN -eq 1 ]]; then
    ( cd "$SRC_DIR" && find "$MOD_ID.modinfo" "${CONTENT_DIRS[@]}" -type f | sort | sed 's/^/  /' )
    say "[dry run] nothing was changed."
    exit 0
fi

# --- check: every script must parse -------------------------------------------
# ⚠️ `node --check file.js` parses as CommonJS and exits 0 on an ES module with a syntax error;
# stdin with --input-type=module is the check that works. `type -P` skips Git Bash's
# `alias node='winpty node.exe'`, which fails with redirected stdin.
NODE_BIN="$(type -P node || true)"
if [[ -n "$NODE_BIN" ]]; then
    broken=0
    while IFS= read -r file; do
        "$NODE_BIN" --input-type=module --check < "$SRC_DIR/$file" >/dev/null 2>&1 || {
            printf 'SYNTAX ERROR: %s\n' "$file" >&2
            "$NODE_BIN" --input-type=module --check < "$SRC_DIR/$file" 2>&1 | sed -n '1,4p' >&2
            broken=$((broken + 1))
        }
    done < <(cd "$SRC_DIR" && find ui -name '*.js' -type f | sort)
    [[ $broken -eq 0 ]] || die "$broken file(s) do not parse - the mod would not load."
else
    say "note: node not found, skipping the syntax check"
fi

# --- deploy ------------------------------------------------------------------
rm -rf "$DEST_DIR"
mkdir -p "$DEST_DIR"
cp "$SRC_DIR/$MOD_ID.modinfo" "$DEST_DIR/"
for dir in "${CONTENT_DIRS[@]}"; do
    [[ -d "$SRC_DIR/$dir" ]] && cp -r "$SRC_DIR/$dir" "$DEST_DIR/"
done

# --- verify: every file the .modinfo references must exist in the target ------
missing=0
while IFS= read -r item; do
    [[ -z "$item" ]] && continue
    [[ -f "$DEST_DIR/$item" ]] || { printf 'MISSING: %s\n' "$item" >&2; missing=$((missing + 1)); }
done < <(grep -o '<\(Item\|File\)[^>]*>[^<]*</\(Item\|File\)>' "$DEST_DIR/$MOD_ID.modinfo" \
         | sed 's/<[^>]*>//g')
[[ $missing -eq 0 ]] || die "$missing file(s) referenced by the .modinfo are missing."

say "deployed $(find "$DEST_DIR" -type f | wc -l | tr -d '[:space:]') files; all .modinfo references resolved"
say "Restart the game, or return to the main menu, to load it."
say "A mod deployed for the FIRST time needs a full game restart: the Mods folder is scanned only at startup."
