
# Sets up this Raspberry Pi as a Troha kiosk. Run it once from the Troha folder, as
# the desktop user (not as root):
#   sh pi/install.sh
# It asks for your password (sudo) for the system parts. Running it again is safe.
# pi/uninstall.sh undoes it.
# See readme.md, "Raspberry Pi".

set -e
cd "$(dirname "$0")/.."
DIR="$(pwd)"
ME="$(id -un)"
if [ "$ME" = root ]; then
	echo "Run this as the desktop user (e.g. pi), not as root or with sudo." >&2
	exit 1
fi

echo "1/5  The server: starts at boot, and again if it stops"
sed -e "s|@USER@|$ME|g" -e "s|@DIR@|$DIR|g" pi/troha.service | sudo tee /etc/systemd/system/troha.service >/dev/null
sudo systemctl daemon-reload
sudo systemctl enable troha.service

echo "2/5  Permission to set the clock (Settings -> Date and time)"
sudo cp pi/clock_permission.rules /etc/polkit-1/rules.d/50-troha-clock.rules

echo "3/5  Permission to dim the backlight and switch it off (Brightness and Screen)"
sudo usermod -aG video "$ME"
sudo cp pi/backlight_permission.rules /etc/udev/rules.d/50-troha-backlight.rules
sudo udevadm control --reload-rules
sudo udevadm trigger --subsystem-match=backlight --action=add
if [ -z "$(ls /sys/class/backlight 2>/dev/null)" ]; then
	echo "     (This screen has no backlight Troha can control: the page will darken itself instead.)"
fi

echo "4/5  Chromium starts with the desktop, full-screen"
AUTOSTART="$HOME/.config/labwc/autostart"
LINE="sh $DIR/pi/kiosk.sh &"
if command -v labwc >/dev/null; then
	mkdir -p "$(dirname "$AUTOSTART")"
	touch "$AUTOSTART"
	grep -qxF "$LINE" "$AUTOSTART" || echo "$LINE" >>"$AUTOSTART"
else
	echo "     This desktop isn't labwc: add this to its autostart by hand (see readme.md):"
	echo "     $LINE"
fi

echo "5/5  The system's own screen blanking off (Troha switches the screen off itself)"
if command -v raspi-config >/dev/null; then
	sudo raspi-config nonint do_blanking 1
else
	echo "     raspi-config not found: switch screen blanking off by hand."
fi

sudo systemctl restart troha.service
echo "Done. Reboot to start the kiosk:  sudo reboot"
