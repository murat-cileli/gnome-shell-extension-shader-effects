# Project instructions

## Update delivery

- After every project update, run the relevant validation, build the extension ZIP with `python3 tools/package.py`, and install that ZIP on the user's system with `gnome-extensions install --force dist/shader-effects@muratc.com.shell-extension.zip`.
- Verify the installed metadata version and compare installed files against the ZIP. GNOME generates `schemas/gschemas.compiled` during installation.
- Report installation separately from loading the new JavaScript into the running GNOME Shell session. If a logout/login is needed, tell the user.
