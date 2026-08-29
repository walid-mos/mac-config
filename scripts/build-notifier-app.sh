#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
SOURCE_APP=${NOTIFIER_APP_SOURCE:-/opt/homebrew/opt/terminal-notifier/terminal-notifier.app}
DEST_APP=${NOTIFIER_APP_DEST:-/Applications/Pi.app}
SWIFT_SOURCE=${PI_NOTIFY_SWIFT_SOURCE:-$ROOT/scripts/notifier/pi-notify.swift}
ICON_SOURCE=${NOTIFIER_ICON_SOURCE:-/Applications/Ghostty.app/Contents/Resources/Ghostty.icns}
SWIFTC=${SWIFTC:-swiftc}
PLIST_BUDDY=${PLIST_BUDDY:-/usr/libexec/PlistBuddy}
PLUTIL=${PLUTIL:-/usr/bin/plutil}
CODESIGN=${CODESIGN:-/usr/bin/codesign}
LSREGISTER=${LSREGISTER:-/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister}
STAMP_RELATIVE=Contents/Resources/pi-notify-input.sha256

SOURCE_EXECUTABLE=$SOURCE_APP/Contents/MacOS/terminal-notifier
DEST_EXECUTABLE=$DEST_APP/Contents/MacOS/pi-notify
DEST_PLIST=$DEST_APP/Contents/Info.plist

if [[ ! -x "$SOURCE_EXECUTABLE" ]]; then
  echo "terminal-notifier absent (brew bundle) — Pi.app non construite"
  exit 0
fi
if [[ ! -f "$SWIFT_SOURCE" ]]; then
  echo "$SWIFT_SOURCE absent — Pi.app non construite"
  exit 0
fi

hash_file() {
  /usr/bin/shasum -a 256 "$1" | /usr/bin/awk '{print $1}'
}

hash_tree() {
  local root=$1 item relative
  while IFS= read -r item; do
    relative=${item#"$root"/}
    if [[ -L "$item" ]]; then
      printf 'link\t%s\t%s\n' "$relative" "$(readlink "$item")"
    elif [[ -f "$item" ]]; then
      printf 'file\t%s\t%s\n' "$relative" "$(hash_file "$item")"
    fi
  done < <(/usr/bin/find "$root" \( -type f -o -type l \) -print | LC_ALL=C /usr/bin/sort)
}

input_hash() {
  {
    printf 'builder\t%s\n' "$(hash_file "$0")"
    printf 'swift\t%s\n' "$(hash_file "$SWIFT_SOURCE")"
    printf '%s\n' \
      'bundle-name=Pi' \
      'bundle-display-name=Pi' \
      'bundle-executable=pi-notify' \
      'bundle-identifier=app.pi.notifier' \
      'swift-flags=-O -framework AppKit -framework UserNotifications'
    hash_tree "$SOURCE_APP"
    if [[ -f "$ICON_SOURCE" ]]; then
      printf 'icon\t%s\n' "$(hash_file "$ICON_SOURCE")"
    else
      printf 'icon\tabsent\n'
    fi
  } | /usr/bin/shasum -a 256 | /usr/bin/awk '{print $1}'
}

plist_equals() {
  [[ $("$PLIST_BUDDY" -c "Print :$1" "$DEST_PLIST" 2>/dev/null || true) == "$2" ]]
}

is_current() {
  local expected=$1 stamp=$DEST_APP/$STAMP_RELATIVE
  [[ -x "$DEST_EXECUTABLE" && -f "$stamp" && $(<"$stamp") == "$expected" ]] || return 1
  plist_equals CFBundleName Pi \
    && plist_equals CFBundleDisplayName Pi \
    && plist_equals CFBundleExecutable pi-notify \
    && plist_equals CFBundleIdentifier app.pi.notifier
}

EXPECTED_HASH=$(input_hash)
if is_current "$EXPECTED_HASH"; then
  echo "Pi.app déjà conforme : $DEST_APP"
  exit 0
fi

DEST_PARENT=$(dirname "$DEST_APP")
DEST_NAME=$(basename "$DEST_APP")
TEMP_APP=$DEST_PARENT/.${DEST_NAME}.build.$$
cleanup() { rm -rf "$TEMP_APP"; }
trap cleanup EXIT
mkdir -p "$DEST_PARENT"
rm -rf "$TEMP_APP"
cp -R "$SOURCE_APP" "$TEMP_APP"

if [[ -f "$ICON_SOURCE" ]]; then
  cp "$ICON_SOURCE" "$TEMP_APP/Contents/Resources/Pi.icns"
  "$PLIST_BUDDY" -c "Set :CFBundleIconFile Pi" "$TEMP_APP/Contents/Info.plist"
fi

"$SWIFTC" -O -o "$TEMP_APP/Contents/MacOS/pi-notify" "$SWIFT_SOURCE" \
  -framework AppKit -framework UserNotifications
rm -f "$TEMP_APP/Contents/MacOS/terminal-notifier"
"$PLIST_BUDDY" \
  -c "Set :CFBundleName Pi" \
  -c "Set :CFBundleExecutable pi-notify" \
  -c "Set :CFBundleIdentifier app.pi.notifier" "$TEMP_APP/Contents/Info.plist"
"$PLUTIL" -replace CFBundleDisplayName -string Pi "$TEMP_APP/Contents/Info.plist"
printf '%s\n' "$EXPECTED_HASH" > "$TEMP_APP/$STAMP_RELATIVE"
"$CODESIGN" --force --sign - "$TEMP_APP"

rm -rf "$DEST_APP"
mv "$TEMP_APP" "$DEST_APP"
"$LSREGISTER" -f "$DEST_APP"
trap - EXIT
echo "Pi.app prête : $DEST_APP (accepte la demande de notifications au premier envoi)"
