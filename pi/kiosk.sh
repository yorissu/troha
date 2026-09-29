
# Shows Troha full-screen in Chromium on the Raspberry Pi. Started with the desktop
# (pi/install.sh sets that up; see readme.md, "Raspberry Pi"). Run it with sh
# (there is no #! line):  sh /home/pi/troha/pi/kiosk.sh
#
# The server normally runs as a service (troha.service); if it doesn't, this starts
# it. Chromium is started again whenever it closes or crashes.

cd "$(dirname "$0")/.." || exit 1
PORT="${TROHA_PORT:-8080}"
URL="http://127.0.0.1:$PORT"

answers() {
	python3 -c "import urllib.request; urllib.request.urlopen('$URL', timeout=1)" 2>/dev/null
}

# Start the server here only if the service isn't looking after it.
if ! answers && ! systemctl is-active --quiet troha.service 2>/dev/null; then
	python3 server.py &
fi

# Wait up to ~30 seconds for it to answer. (If it doesn't, the page keeps retrying.)
i=0
until answers; do
	i=$((i + 1))
	[ "$i" -ge 60 ] && break
	sleep 0.5
done

BROWSER="$(command -v chromium || command -v chromium-browser)"
if [ -z "$BROWSER" ]; then
	echo "Chromium isn't installed (sudo apt install chromium-browser)" >&2
	exit 1
fi

# Kiosk mode (?kiosk also hides the mouse pointer on the page), plus flags that switch
# off Chromium's own background network features (sync, translate, updates, crash
# reports, etc.) and its "restore pages?" bubble after a crash.
while true; do
	"$BROWSER" \
		--kiosk "$URL/?kiosk" \
		--user-data-dir="$HOME/.config/troha_kiosk" \
		--noerrdialogs \
		--disable-infobars \
		--no-first-run \
		--hide-crash-restore-bubble \
		--disable-session-crashed-bubble \
		--overscroll-history-navigation=0 \
		--disable-pinch \
		--disable-sync \
		--disable-features=Translate,MediaRouter,OptimizationHints \
		--disable-background-networking \
		--disable-component-update \
		--disable-domain-reliability \
		--disable-client-side-phishing-detection \
		--disable-breakpad \
		--no-pings \
		--no-proxy-server \
		--password-store=basic
	sleep 2 # it closed or crashed: start it again
done
