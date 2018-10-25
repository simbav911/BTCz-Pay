BTCz-Pay (beta v0.1.3)
===================

Self-hosted Node.js BitcoinZ payment gateway. Provides REST API (microservice).
Process BitcoinZ payments on your end, securely, with no comission.

Request payments (invoicing), check payments (whether invoice is paid), receive callbacks if payment is made (client and server side).

Depends on Nodejs v8+, BitcoinZ Core, Couchdb for storage and coinmarket.com API for the currency's.


Caution
------------
This version is a "beta" being tested. Use in production is not recommended. We disclaim all responsability in case of loss of funds related to the use of this software.

Installation
------------

* Install [bitcoinz-insight-patched](BITCOIN-CORE-INSTALL.md)

Install nodejs 8.x
```
curl -sL https://deb.nodesource.com/setup_8.x | sudo -E bash -
sudo apt-get install nodejs libzmq3-dev
```

Clone & install project:
```
git clone https://github.com/MarcelusCH/BTCz-Pay && cd BTCz-Pay
npm install
cp config.js.dev config.js
```

Install & configure Couchdb:
```
sudo apt-get install couchdb
curl -s -X PUT http://localhost:5984/_config/admins/User_Name -d '"Pass_Word"'
curl -u User_Name -X PUT localhost:5984/btczpay
```

Edit `config.js`:
* Point it to a new Couchdb database
* Point it to a BitcoinZ Core RPC server
* Update coinmarketcap API key
* Add tmp wallet with founds for speed payment

Tests
-----

```
Tests in progress
```

Running
-------

```
nodejs btcz-pay.js
nodejs worker.js
nodejs worker2.js
nodejs worker3.js
nodejs worker4.js
```
(For production use [pm2](https://www.npmjs.com/package/pm2))


Open [http://localhost:2222](http://localhost:2222) in browser, you should see the website sample.
That's it, ready to use.

License
-------

MIT

Author
------

Marcelus (BTCZ community)


TODO
----
- Aggregate funds on final (aggregational) address.
- TBD

API
===

### GET /api/request_payment/:expect/:currency/:message/:sellerAddress/:customerMail/:ipnPingback/:cliCallbackSuccess/:cliCallbackError/:SpeedSweep/:secret


Create a request to pay, supported currencies: BTCZ, USD, EUR, CHF, GBP, RUB. Non-btcz currency is converted to btcz using current rate from coinmarketcap.com.

Returns a json document with QR code to be displayed to the payer, and a unique address for that particular payment (you can use it as invoice id).

Message will be displayed to the client (for example, you can write "Payment for goods"). Seller and customer - system field, here you can write the application that created the request and the payer id.

Keep Seller field private, it is also used for payouts.Callback_url will be requested once the invoice is paid.

The ipnPingback (URL) parameter is never returned to the client. This URL is sent from server side, only once the check_result.state = 5 (success) or check_result.state = 2 (expired), and it could also send some key pare info.

The SpeedSweep parameter is to allow a speed payment (without confirmation). 0=disabled / 1=enabled
The founds are taken from a tmp wallet that as to be created and stocked before.

The secret parameter is the secret phrase returned for the IPN pingback.

**Example full router path:**
```
http://localhost:2222/api/request_payment/0.005/BTCZ/wheres%20the%20money%20lebowski/t1VYSo8VtpKMm1SUwp1KJHbqrtfqj7tgpaE/test@test.com/https%3A%2F%2Fwww.google.com/https%3A%2F%2Fwww.google.com/https%3A%2F%2Fwww.google.com/0/01234abcd
```
(By using full router path, all parameters are mandatory)

**Example with query string:**
```
http://localhost:2222/api/request_payment/?expect=0.005&currency=BTCZ&message=wheres%20the%20money%20lebowski&seller=t1VYSo8VtpKMm1SUwp1KJHbqrtfqj7tgpaE&customerMail=test@test.com&ipnPingback=https%3A%2F%2Fwww.google.com&cliSuccessURL=https%3A%2F%2Fwww.google.com&cliErrorURL=https%3A%2F%2Fwww.google.com&SpeedSweep=0&secret=01234abcd
```
**Expanded:**
```
http://localhost:2222/api/request_payment/?
     expect=0.005&
     currency=BTCZ&
     message=wheres%20the%20money%20lebowski&
     seller=t1VYSo8VtpKMm1SUwp1KJHbqrtfqj7tgpaE&
     customerMail=test@test.com&
     ipnPingback=https%3A%2F%2Fwww.google.com&
     cliSuccessURL=https%3A%2F%2Fwww.google.com&
     cliErrorURL=https%3A%2F%2Fwww.google.com&
     SpeedSweep=0&
     secret=01234abcd
```
(By using query string, some parameters are optional )

**Parameters definition:**
- `expect` = Mandatory - The expected amount to pay.
- `currency` = Mandatory - The currency code (supported: BTCZ, BTC, USD, EUR, CHF, GBP, RUB).
- `seller` = Mandatory - The seller BTCz address.
- `ipnPingback` = Mandatory - The IPN URL to get (from server side) once paid or expired.
- `message` = Optional - An optional message.
- `customerMail` = Optional - The customer eMail
- `cliSuccessURL` = Optional - The URL to redirect browser on success.
- `cliErrorURL` = Optional - The URL to redirect browser on expired.
- `SpeedSweep` = Optional - Use speed checkout (0=disabled / 1=enabled), default is 0.
- `secret` = Optional - The secret phrase that is appended to IPN call. If not set, the gateway generate a random one.

**JSON result:**
```
{
  "id":"c5e9631d-b107-4022-8de5-ae9f0efd03af",
  "secret":"01234abcd",
  "address":"t1gwku8spbCFUodyJ26njknnDxeZGM8hVmm",
  "link":"bitcoinz:t1gwku8spbCFUodyJ26njknnDxeZGM8hVmm?amount=14.77818972&message=Hello",
  "qr":"http://localhost:2222/generate_qr/bitcoinz%3At1gwku8spbCFUodyJ26njknnDxeZGM8hVmm%3Famount%3D14.77818972%26message%3DHello",
  "qr_simple":"http://localhost:2222/generate_qr/bitcoinz:t1gwku8spbCFUodyJ26njknnDxeZGM8hVmm?amount=0.005"
}
```

### GET /api/check_payment/:id


Check payment by a unique invoice number returned by the "request_payment.id" call. Only state 2 (expired/err) and 5 (success) return a callback URL.

**Example**
```
http://localhost:2222/api/check_payment/f22c44cb-e26a-4022-864f-00f0d523d48a
```

**JSON result:**
```
{
  "generated":"t1gwku8spbCFUodyJ26njknnDxeZGM8hVmm",
  "btcz_expected":14.77818972,
  "speed_sweep_fee":5,
  "btcz_actual":0,
  "btcz_unconfirmed":0,
  "currency":"USD",
  "amount":0.01,
  "timestamp_start":1537815608394,
  "timestamp_now":1537816142575,
  "timestamp_stop":1537816808394,
  "state":0,
  [optional] "successURL":"https://mysite_or_IP/result/?Hello=1",
  [optional] "errURL":"https://mysite_or_IP/result/?Hello=0"
}
```
(the speed_sweep_fee is in %)


**States:**
```
0=Initialized
1=Accepted
2=Expired
5=Success
```

### GET /invoice/:id

Open/return the invoice template info with Qr code (as iframe).

**Example**
```
http://localhost:2222/invoice/f22c44cb-e26a-4022-864f-00f0d523d48a
```

### IPN Pingback

On success paid or expired, the gateway pingback to the defined `ipnPingback` url set by the request_payment/ call. The `secret` and the `state` is appended.

**Pingback url example**
```
https://yourDomaine.com/yourPath/?and=yourParam&secret=01234abcd&state=5
or
https://yourDomaine.com/yourScript.php?secret=01234abcd&state=2
```

UPDATES
=======

v0.1.1
------
- Updated install instruction.
- Updated docs (web UI): CSS style update, form mandatory field and success pingback js code.
- Corrected server side pingback (in worker.js).
- Added success & fail (expired) pingback URL for client side (in API return json).
- Cancel expired gateway check for payment forward (24 hour).
- Added Gateway usage statistics.
- Added WP-Woocommerce Plugin (beta).

v0.1.2
------
- Added speed payment support.
- Added unconfirmed founds info in the invoice.
- Added payment amount in the QR.

v0.1.3
------
- Added secret phrase return in JSON by request_payment/ call.
- Added invoice state and secret param in IPN pingback.
- added IPN pingback by expired state=2.
- Manage optional parameters by query string (?) instead of router path (/).
- Solved double url encoding issue.
- Rewrite of some code parts.
- Updated Web UI API explication with examples.
- Added website icon.
