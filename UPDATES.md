BTCz-Pay main server
===

v0.2.0
-------
- Rewrite source code.
- Improve logger (out.log/error.log) files.
- Limit maximum opened gateway per client (IP).
- Added new currencies support.
- Automatic found return if more paid as expected or if only partially paid.
- Added FAQ page.
- Added contact page.
- Added getting started page with PHP API call example.

v0.1.3 (beta)
------
- Added secret phrase return in JSON by request_payment/ call.
- Added invoice state and secret param in IPN pingback.
- added IPN pingback by expired state=2.
- Manage optional parameters by query string (?) instead of router path (/).
- Solved double url encoding issue (by using query string). For route full path, you should use double url encoding.
- Rewrite of some code parts.
- Updated Web UI API explication with examples.
- Added website icon.
- Added postMessage(Callback URL) in invoice.html for cross-domain data transfer (iFrame->windows.top).
- Added Cubecart Plugin (beta)

v0.1.2 (beta)
------
- Added speed payment support.
- Added unconfirmed founds info in the invoice.
- Added payment amount in the QR.

v0.1.1 (beta)
------
- Updated install instruction.
- Updated docs (web UI): CSS style update, form mandatory field and success pingback js code.
- Corrected server side pingback (in worker.js).
- Added success & fail (expired) pingback URL for client side (in API return json).
- Cancel expired gateway check for payment forward (24 hour).
- Added Gateway usage statistics.
- Added WP-Woocommerce Plugin (beta).
