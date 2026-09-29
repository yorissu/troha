
"""Troha's server side, split by job:

data_files     the data folder: one JSON file per data set, and which one is in use
clock          setting the device's clock (Linux only)
display        the screen's backlight: dimming it and switching it off (Linux only)
http_handler   the web server: serves ./web and answers the page's /api requests
self_check     ends the server if it stops answering, so the system starts a fresh one

server.py (next to this folder) puts them together and starts the server.
"""
