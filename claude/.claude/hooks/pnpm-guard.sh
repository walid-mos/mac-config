#!/usr/bin/env bash
# PreToolUse(Bash) — force pnpm : bloque npm/npx sauf projet verrouillé npm.
set -euo pipefail

input=$(cat)
cmd=$(jq -r '.tool_input.command // empty' <<<"$input")
[ -z "$cmd" ] && exit 0

# npm/npx en position de commande (le [^[:alnum:]…] exclut "pnpm")
grep -qE '(^|[^[:alnum:]/_.-])(npm|npx)([[:space:]]|$)' <<<"$cmd" || exit 0

cwd=$(jq -r '.cwd // empty' <<<"$input")
[ -d "$cwd" ] || cwd=$PWD

dir=$cwd
lock=""
while :; do
	if [ -f "$dir/pnpm-lock.yaml" ]; then
		lock="pnpm"
		break
	fi
	if [ -f "$dir/package-lock.json" ] || [ -f "$dir/npm-shrinkwrap.json" ]; then
		lock="npm"
		break
	fi
	[ "$dir" = "/" ] && break
	dir=$(dirname "$dir")
done

# Lockfile npm trouvé en premier → npm est légitime ici.
[ "$lock" = "npm" ] && exit 0

if [ "$lock" = "pnpm" ]; then
	reason="pnpm-lock.yaml présent ($dir) — utilise pnpm, jamais npm ici. Équivalents : npm install→pnpm install · npm install <pkg>→pnpm add <pkg> · npm ci→pnpm install --frozen-lockfile · npm run X→pnpm X · npx→pnpm dlx (ou pnpm exec pour un binaire local)."
else
	reason="Pas de lockfile npm dans ce projet — utilise pnpm par défaut (pnpm add/install/dlx). Si npm est réellement obligatoire (outil qui l'exige), explique pourquoi et demande à l'utilisateur."
fi

jq -n --arg r "$reason" '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:$r}}'
