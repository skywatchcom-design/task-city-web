#!/usr/bin/env bash
# The build Netlify runs for the clean address (owner, 30.10: instead of github.io, for free; Cloudflare's sign-up did not
# work for the owner). Netlify is connected to the task-city-web repo; this picks only the public pages out of it, so the previews
# and the web app (thousands of files) stay on github.io, and puts the landing page at the root. Settings in Netlify:
# build command "bash site-build.sh", publish directory "cf".
set -euo pipefail
rm -rf cf
mkdir cf
cp -r soon get about favicon.png launch.js privacy.html terms.html delete-account.html cf/
# The landing page at the root too: its relative links (../launch.js, ../get/) resolve to the same files from there.
cp -r soon/. cf/
echo "pages: $(find cf -type f | wc -l)"
