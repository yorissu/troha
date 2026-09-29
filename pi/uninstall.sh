
# Undoes pi/install.sh: Troha no longer starts at boot, and its permissions and
# settings are removed from the system. Run it from the Troha folder, as the
# desktop user (not as root):
#   sh pi/uninstall.sh
# It asks for your password (sudo) for the system parts. Running it again is safe.
#
# The Troha folder itself, and your data in its data folder, are left as they are:
# delete the folder by hand if you want them gone. To set Troha up again afterwards,
# run pi/install.sh. (install.sh installs no packages, so there are none to remove.)

cd "$(dirname "$0")/.." || exit 1
DIR="$(pwd)"
if [ "$(id -un)" = root ]; then
	echo "Run this as the desktop user (e.g. pi), not as root or with sudo." >&2
	exit 1
fi

echo "1/5  Closing the kiosk (Chromium) and stopping the server"
pkill -f "$DIR/pi/kiosk.sh" 2>/dev/null
pkill -f "troha_kiosk" 2>/dev/null
if [ -f /etc/systemd/system/troha.service ]; then
	sudo systemctl disable --now troha.service
	sudo rm -f /etc/systemd/system/troha.service
	sudo systemctl daemon-reload
fi

echo "2/5  Chromium no longer starts with the desktop"
AUTOSTART="$HOME/.config/labwc/autostart"
LINE="sh $DIR/pi/kiosk.sh &"
if [ -f "$AUTOSTART" ]; then
	grep -vxF "$LINE" "$AUTOSTART" >"$AUTOSTART.new" || true
	if [ -s "$AUTOSTART.new" ]; then
		mv "$AUTOSTART.new" "$AUTOSTART"
	else
		# Nothing else was in it: remove it, so the desktop's own autostart runs again.
		rm -f "$AUTOSTART.new" "$AUTOSTART"
	fi
fi

echo "3/5  Removing the permissions to set the clock and control the backlight"
sudo rm -f /etc/polkit-1/rules.d/50-troha-clock.rules
sudo rm -f /etc/udev/rules.d/50-troha-backlight.rules
sudo udevadm control --reload-rules

echo "4/5  The system's own screen blanking back on (Raspberry Pi OS's default)"
if command -v raspi-config >/dev/null; then
	sudo raspi-config nonint do_blanking 0
fi

echo "5/5  Removing the kiosk's Chromium profile"
rm -rf "$HOME/.config/troha_kiosk"

echo "Done. Reboot to finish:  sudo reboot"
