# Eye-Tracking Test Server

This Node script can be used to create a test server that feeds the current
mouse position over to iTrace plugins connected to it.  This is useful for
testing iTrace plugins.

## Requirements

Requires the following Node packages:

- fs
- http
- robotjs
- ws

Install all required packages with `npm install`.

## Using

The script requires two arguments:

1. the pixel density of your display, e.g. 1 or 1.5 (mac Retina)
2. a path where the plugin should write any output files

To run it, use node:

> node testserver.js 1.5 /path/to/directory

Once running, iTrace plugins should be able to connect to it on the standard
port on localhost.  The server will run at a 60 Hz sample rate, sending mouse
positions as eye gazes to the plugin.  It will keep the session open for around
30 seconds (1500 samples) and then close the session.  It will then re-open a
new session (if any clients are still connected).

Note that when a session opens, it waits a few seconds (3 by default) before
starting to send data.

If you want to change any of the defaults, they are in constants at the top of
the script.
