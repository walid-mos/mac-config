#!/bin/sh
# react-ts-gate — enforce the React / TypeScript doctrine on every Write|Edit.
#
# Usage (from settings.json hooks): react-ts-gate.sh <pre|post>
#   stdin = Claude Code hook JSON payload ({ tool_input.file_path, ... })
#
#   pre  : inject a short doctrine reminder before the edit (non-blocking).
#   post : analyse the written file.
#          - BLOCK (exit 2) on `any` and on `as` type-assertions (skill typescript).
#          - WARN (additionalContext) on useEffect (skill react/effects.md)
#            and on files over the line budget.
#
# Heuristic detection (grep/awk, no TS parser): biased toward catching. Rare
# false positives are recoverable — Claude just re-edits. Tune LINE_BUDGET or
# the awk regexes below if a legitimate pattern keeps tripping it.

LINE_BUDGET=250

phase="$1"
payload="$(cat)"
file="$(printf '%s' "$payload" | jq -r '.tool_input.file_path // empty' 2>/dev/null)"

# No target path → nothing to police.
[ -n "$file" ] || exit 0

# Only JS/TS source files.
case "$file" in
	*.ts | *.tsx | *.js | *.jsx | *.mjs | *.cjs) ;;
	*) exit 0 ;;
esac

is_react=0
case "$file" in *.tsx | *.jsx) is_react=1 ;; esac
is_ts=0
case "$file" in *.ts | *.tsx) is_ts=1 ;; esac

# ---------------------------------------------------------------------------
# PRE — reminder injected right before the edit.
# ---------------------------------------------------------------------------
if [ "$phase" = "pre" ]; then
	if [ "$is_react" = 1 ]; then
		reminder="RAPPEL doctrine — React/TS ($file). Applique coding + typescript + react.
- any & as: INTERDITS (seul as const toléré).
- useEffect: quasi-interdit. Préfère état dérivé, event handlers, calcul au render. Un effet = synchro avec un système EXTERNE réel.
- Composition > config > héritage. SRP. Petits composants. Pas de god-component ni de prop explosion.
- Budget: < ${LINE_BUDGET} lignes/fichier, sinon découpe en composants/hooks (SRP, composition)."
	else
		reminder="RAPPEL doctrine — TS ($file). Applique coding + typescript.
- any & as: INTERDITS (seul as const toléré). Utilise type-guards, génériques, types de retour explicites.
- Early returns, fonctions courtes, nommage explicite.
- Budget: < ${LINE_BUDGET} lignes/fichier, sinon découpe."
	fi
	jq -n --arg c "$reminder" \
		'{hookSpecificOutput:{hookEventName:"PreToolUse",additionalContext:$c}}'
	exit 0
fi

# ---------------------------------------------------------------------------
# POST — analyse the file now on disk.
# ---------------------------------------------------------------------------
[ "$phase" = "post" ] || exit 0
[ -f "$file" ] || exit 0

# NB: macOS /usr/bin/awk (BWK) has NO \b / \d. Word boundaries are spelled out
# as ([^A-Za-z0-9_]|^) / ([^A-Za-z0-9_]|$).
analysis="$(awk -v react="$is_react" -v ts="$is_ts" '
{
	total = NR
	s = $0
	sub(/^[ \t]+/, "", s)
	is_comment = (s ~ /^\/\// || s ~ /^\*/ || s ~ /^\/\*/)
	is_impexp  = (s ~ /^import[ \t]/ || s ~ /^export[ \t]/)

	# any (TS only, not in comments)
	if (ts == 1 && !is_comment) {
		if ($0 ~ /:[ \t]*any([^A-Za-z0-9_]|$)/ || $0 ~ /<[ \t]*any([^A-Za-z0-9_]|$)/ \
			|| $0 ~ /any\[\]/ || $0 ~ /any[ \t]*>/ \
			|| $0 ~ /([^A-Za-z0-9_]|^)as[ \t]+any([^A-Za-z0-9_]|$)/ || $0 ~ /Array<any>/) {
			any_n++; any_l[any_n] = NR ": " $0
		}
	}

	# as type-assertions (TS only, not comments). Target must look like a type
	# (Capitalized or primitive), excluding `as const`. To avoid flagging
	# `{ foo as Bar }` renames (incl. multi-line imports), require an expression
	# context on the line: =, return, ), ., or =>.
	has_expr = ($0 ~ /=/ || $0 ~ /([^A-Za-z0-9_]|^)return([^A-Za-z0-9_]|$)/ \
		|| $0 ~ /\)/ || $0 ~ /\./)
	if (ts == 1 && !is_comment && !is_impexp && has_expr \
		&& $0 !~ /([^A-Za-z0-9_]|^)as[ \t]+const([^A-Za-z0-9_]|$)/) {
		if ($0 ~ /[ \t)\]]as[ \t]+[A-Z]/ \
			|| $0 ~ /([^A-Za-z0-9_]|^)as[ \t]+(string|number|boolean|bigint|symbol|object|unknown|never)([^A-Za-z0-9_]|$)/) {
			as_n++; as_l[as_n] = NR ": " $0
		}
	}

	# useEffect (React only, not comments)
	if (react == 1 && !is_comment && $0 ~ /([^A-Za-z0-9_]|^)useEffect[ \t]*\(/) {
		eff_n++; eff_l[eff_n] = NR
	}
}
END {
	print "TOTAL " total + 0
	print "ANY " any_n + 0
	for (i = 1; i <= any_n; i++) print "ANYLINE " any_l[i]
	print "AS " as_n + 0
	for (i = 1; i <= as_n; i++) print "ASLINE " as_l[i]
	print "EFF " eff_n + 0
	for (i = 1; i <= eff_n; i++) print "EFFLINE " eff_l[i]
}
' "$file")"

get() { printf '%s\n' "$analysis" | sed -n "s/^$1 //p"; }

total="$(get TOTAL)"
any_cnt="$(get ANY)"
as_cnt="$(get AS)"
eff_cnt="$(get EFF)"

# --- BLOCK on any / as ---
if [ "${any_cnt:-0}" -gt 0 ] || [ "${as_cnt:-0}" -gt 0 ]; then
	{
		echo "🚫 Doctrine TypeScript — fichier rejeté: $file"
		echo
		if [ "${any_cnt:-0}" -gt 0 ]; then
			echo "INTERDIT ABSOLU: \`any\` (skill typescript). Occurrences:"
			printf '%s\n' "$analysis" | sed -n 's/^ANYLINE /  L/p'
			echo
		fi
		if [ "${as_cnt:-0}" -gt 0 ]; then
			echo "INTERDIT ABSOLU: type assertion \`as\` — seul \`as const\` toléré. Occurrences:"
			printf '%s\n' "$analysis" | sed -n 's/^ASLINE /  L/p'
			echo
		fi
		echo "Corrige avant de continuer: type-guards, génériques, types de retour explicites, unknown + narrowing. Recharge le skill typescript si besoin."
	} >&2
	exit 2
fi

# --- WARN on useEffect / file size (non-blocking) ---
warn=""
if [ "${eff_cnt:-0}" -gt 0 ]; then
	lines="$(printf '%s\n' "$analysis" | sed -n 's/^EFFLINE /L/p' | paste -sd ',' -)"
	warn="${warn}useEffect détecté (${eff_cnt}) aux lignes ${lines} — quasi-interdit (skill react/effects.md): justifie chaque effet (synchro avec un système externe réel) ou remplace-le par de l'état dérivé / un event handler / un calcul au render. "
fi
if [ "${total:-0}" -gt "$LINE_BUDGET" ]; then
	warn="${warn}Fichier de ${total} lignes (> ${LINE_BUDGET}) — découpe en composants/hooks focalisés (SRP, composition). "
fi

if [ -n "$warn" ]; then
	jq -n --arg c "RAPPEL doctrine sur ${file}: ${warn}" \
		'{hookSpecificOutput:{hookEventName:"PostToolUse",additionalContext:$c}}'
fi
exit 0
