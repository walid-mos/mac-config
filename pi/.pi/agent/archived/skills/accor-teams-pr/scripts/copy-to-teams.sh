#!/usr/bin/env bash
# Read the skill's plain-text Teams block on stdin and put HTML + plain
# text on the macOS clipboard so Cmd+V in Teams yields a real bullet list.
set -euo pipefail

html_escape() {
  printf '%s' "$1" | sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g' -e 's/"/\&quot;/g'
}

body=""
plain=""
in_list=0
started=0

close_list() {
  if [[ "$in_list" -eq 1 ]]; then
    body+="</ul>"
    in_list=0
  fi
}

append_plain() {
  if [[ -n "$plain" ]]; then
    plain+=$'\n'
  fi
  plain+="$1"
}

while IFS= read -r line || [[ -n "$line" ]]; do
  if [[ -z "$line" ]]; then
    close_list
    if [[ "$started" -eq 1 ]]; then
      body+="<br>"
      append_plain ""
    fi
    continue
  fi
  started=1
  if [[ "$line" =~ ^https?:// ]]; then
    close_list
    esc="$(html_escape "$line")"
    body+="<div><a href=\"${esc}\">${esc}</a></div>"
    append_plain "$line"
  elif [[ "$line" =~ ^PR\ [0-9]+/[0-9]+$ ]]; then
    close_list
    esc="$(html_escape "$line")"
    body+="<div>${esc}</div>"
    append_plain "$line"
  elif [[ "$line" == "- "* ]]; then
    if [[ "$in_list" -eq 0 ]]; then
      body+="<ul>"
      in_list=1
    fi
    item="${line#- }"
    esc="$(html_escape "$item")"
    body+="<li>${esc}</li>"
    append_plain "$line"
  else
    close_list
    esc="$(html_escape "$line")"
    body+="<div>${esc}</div>"
    append_plain "$line"
  fi
done
close_list

if [[ -z "$body" ]]; then
  echo "copy-to-teams: empty input" >&2
  exit 1
fi

wrapped="$(cat <<EOF
<html>
<head><meta charset="utf-8"></head>
<body>
<!--StartFragment-->${body}<!--EndFragment-->
</body>
</html>
EOF
)"

tmp_html="$(mktemp)"
tmp_plain="$(mktemp)"
tmp_js="$(mktemp)"
trap 'rm -f "$tmp_html" "$tmp_plain" "$tmp_js"' EXIT

printf '%s' "$wrapped" >"$tmp_html"
printf '%s' "$plain" >"$tmp_plain"

cat >"$tmp_js" <<'EOF'
function run(argv) {
  ObjC.import("AppKit");
  ObjC.import("Foundation");
  const html = $.NSString.stringWithContentsOfFileEncodingError(
    argv[0],
    $.NSUTF8StringEncoding,
    null
  );
  const plain = $.NSString.stringWithContentsOfFileEncodingError(
    argv[1],
    $.NSUTF8StringEncoding,
    null
  );
  const pb = $.NSPasteboard.generalPasteboard;
  pb.clearContents;
  pb.setStringForType(html, $("public.html"));
  pb.setStringForType(plain, $("public.utf8-plain-text"));
}
EOF

osascript -l JavaScript "$tmp_js" "$tmp_html" "$tmp_plain" >/dev/null
echo "clipboard: html+plain ready"
