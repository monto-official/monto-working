#!/bin/bash
# Launched by ~/.config/autostart/monto-kiosk.desktop on desktop login.
# Waits for the local Next.js frontend to come up, then opens it full-screen
# in Chromium with no address bar, no crash/restore dialogs, and no cursor.

URL="http://localhost:3000"

# monto-frontend.service starts in parallel with the desktop session, so the
# Next.js server may not be listening yet — poll until it responds.
until curl -s -o /dev/null "$URL"; do
  sleep 1
done

xset s off
xset s noblank
xset -dpms

unclutter -idle 0.5 -root &

chromium-browser \
  --kiosk \
  --incognito \
  --noerrdialogs \
  --disable-infobars \
  --disable-session-crashed-bubble \
  --disable-restore-session-state \
  --check-for-update-interval=31536000 \
  "$URL"
