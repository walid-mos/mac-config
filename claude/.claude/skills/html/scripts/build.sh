#!/usr/bin/env bash
# build.sh — assemble a self-contained HTML deliverable from a body fragment.
# Inlines assets/np.css + assets/np.js into assets/shell.html around the body.
# D2 blocks (<div data-np="d2">…source…</div>) are rendered at build time to
# inline SVG, one light + one dark variant, requires `d2` (make claude-post).
#
# Usage:
#   build.sh <body.html> -t "Titre du document" -o docs/notes/2026-06-10-slug.html
#            [-l fr] [-m static|rich] [-w normal|prose] [-s auto|on|off] [-b NextNode]
set -euo pipefail

ASSETS="$(cd "$(dirname "${BASH_SOURCE[0]}")/../assets" && pwd)"

body="" out="" title="" lang="fr" mode="static" width="normal" sidebar="auto" brand=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    -t|--title)   title="$2"; shift 2 ;;
    -o|--out)     out="$2"; shift 2 ;;
    -l|--lang)    lang="$2"; shift 2 ;;
    -m|--mode)    mode="$2"; shift 2 ;;
    -w|--width)   width="$2"; shift 2 ;;
    -s|--sidebar) sidebar="$2"; shift 2 ;;
    -b|--brand)   brand="$2"; shift 2 ;;
    -h|--help)    grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    -*)           echo "unknown flag: $1" >&2; exit 1 ;;
    *)            body="$1"; shift ;;
  esac
done

[[ -n "$body" && -f "$body" ]] || { echo "body fragment missing: '$body'" >&2; exit 1; }
[[ -n "$title" ]] || { echo "-t/--title is required" >&2; exit 1; }
[[ -n "$out" ]]   || { echo "-o/--out is required" >&2; exit 1; }

esc_html() {
  local s="$1"
  s="${s//&/&amp;}"; s="${s//</&lt;}"; s="${s//>/&gt;}"; s="${s//\"/&quot;}"
  printf '%s' "$s"
}

tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT

# --- D2 preprocessing --------------------------------------------------
# <div data-np="d2" data-caption="…" data-layout="elk" data-sketch
#      data-theme-light="0" data-theme-dark="200" data-pad="8">
#   …d2 source…
# </div>
# Opening tag and closing </div> must each sit alone on their line.
if grep -q 'data-np="d2"' "$body"; then
  command -v d2 >/dev/null || { echo "d2 introuvable — installe-le via 'make claude-post' (brew install d2)" >&2; exit 1; }
  processed="$tmpdir/body.html"
  : > "$processed"
  n=0 in_d2=0 attrs="" src=""
  get_attr() {
    local v="${attrs#*"$1"=\"}"
    [[ "$v" == "$attrs" ]] && return 0
    printf '%s' "${v%%\"*}"
  }
  # strip the XML declaration and give d2's outer <svg> (viewBox only) explicit
  # width/height so it keeps its intrinsic size once inlined in a flex container
  inline_svg() {
    sed 's/^<?xml[^?]*?>//' "$1" \
      | perl -pe 's/<svg((?:(?!width=)[^>])*?viewBox="0 0 ([0-9.]+) ([0-9.]+)")/<svg$1 width="$2" height="$3"/'
  }
  while IFS= read -r line || [[ -n "$line" ]]; do
    if [[ $in_d2 == 0 && "$line" == *'data-np="d2"'* ]]; then
      [[ "$line" == *'</div>'* ]] && { echo "d2 block #$((n + 1)): opening tag and closing </div> must each sit alone on their line" >&2; exit 1; }
      in_d2=1; n=$((n + 1)); attrs="$line"; src="$tmpdir/d2-$n.d2"; : > "$src"
      continue
    fi
    if [[ $in_d2 == 1 ]]; then
      trimmed="${line#"${line%%[![:space:]]*}"}"
      trimmed="${trimmed%"${trimmed##*[![:space:]]}"}"
      if [[ "$trimmed" == '</div>' ]]; then
        in_d2=0
        layout="$(get_attr data-layout)"; layout="${layout:-elk}"
        tl="$(get_attr data-theme-light)"; tl="${tl:-0}"
        td="$(get_attr data-theme-dark)"; td="${td:-200}"
        pad="$(get_attr data-pad)"; pad="${pad:-8}"
        cap="$(get_attr data-caption)"
        sketch=""
        [[ "$attrs" == *data-sketch* ]] && sketch="--sketch"
        grep -q 'style\.fill' "$src" || { printf 'style.fill: transparent\n%s\n' "$(cat "$src")" > "$src.t" && mv "$src.t" "$src"; }
        for variant in light:"$tl" dark:"$td"; do
          theme="${variant#*:}"
          d2 --layout "$layout" --theme "$theme" --pad "$pad" $sketch "$src" "$tmpdir/d2-$n-${variant%%:*}.svg" >/dev/null 2>"$tmpdir/d2-$n.err" \
            || { echo "d2 compile failed (block #$n):" >&2; cat "$tmpdir/d2-$n.err" >&2; exit 1; }
        done
        {
          echo '<figure class="d2-fig">'
          echo '<div class="d2-light">'
          inline_svg "$tmpdir/d2-$n-light.svg"
          echo '</div>'
          echo '<div class="d2-dark">'
          inline_svg "$tmpdir/d2-$n-dark.svg"
          echo '</div>'
          [[ -n "$cap" ]] && printf '<figcaption class="cap">%s</figcaption>\n' "$(esc_html "$cap")"
          echo '</figure>'
        } >> "$processed"
      else
        printf '%s\n' "$line" >> "$src"
      fi
      continue
    fi
    printf '%s\n' "$line" >> "$processed"
  done < "$body"
  [[ $in_d2 == 0 ]] || { echo "unclosed data-np=\"d2\" block (#$n)" >&2; exit 1; }
  body="$processed"
fi

# --- assembly ----------------------------------------------------------
attrs=""
[[ "$mode" == "rich" ]]      && attrs+=" data-mode=\"rich\""
[[ "$width" == "prose" ]]    && attrs+=" data-width=\"prose\""
[[ "$sidebar" != "auto" ]]   && attrs+=" data-sidebar=\"$sidebar\""
[[ -n "$brand" ]]            && attrs+=" data-brand=\"$(esc_html "$brand")\""

mkdir -p "$(dirname "$out")"

NP_TITLE="$(esc_html "$title")" NP_LANG="$lang" NP_ATTRS="$attrs" \
awk -v cssfile="$ASSETS/np.css" -v jsfile="$ASSETS/np.js" -v bodyfile="$body" '
function emit(f,   line) { while ((getline line < f) > 0) print line; close(f) }
function repl(s, tag, val,   i, out) {
  out = ""
  i = index(s, tag)
  while (i) { out = out substr(s, 1, i - 1) val; s = substr(s, i + length(tag)); i = index(s, tag) }
  return out s
}
{
  if (index($0, "{{CSS}}"))       { emit(cssfile);  next }
  if (index($0, "{{JS}}"))        { emit(jsfile);   next }
  if (index($0, "{{BODY}}"))      { emit(bodyfile); next }
  s = $0
  s = repl(s, "{{TITLE}}", ENVIRON["NP_TITLE"])
  s = repl(s, "{{LANG}}", ENVIRON["NP_LANG"])
  s = repl(s, "{{BODY_ATTRS}}", ENVIRON["NP_ATTRS"])
  print s
}' "$ASSETS/shell.html" > "$out"

echo "built: $out ($(wc -c < "$out" | tr -d ' ') bytes)"
