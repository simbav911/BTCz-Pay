BTCz-Pay (v0.1.0)
===================

Self-hosted Node.js BitcoinZ payment gateway. Provides REST API (microservice).
Process BitcoinZ payments on your end, securely, with no comission.

Request payments (invoicing), check payments (whether invoice is paid), receive callbacks if payment is made.
Aggregate funds on final (aggregational) address.
Depends on Nodejs v8+, BitcoinZ Core, Couchdb for storage and coinmarket.com API for the currency's.


Caution
------------
This version is a "beta" being tested. Use in production is not recommended. We disclaim all resposability in case of loss of funds related to the use of this software.

Installation
------------

```
$ git clone https://github.com/MarcelusCH/BTCz-Pay && cd BTCz-Pay
$ npm install
$ cp config.js.dev config.js
```

* Install [bitcoinz-insight-patched](BITCOIN-CORE-INSTALL.md)
* Install Couchdb (or use [https://cloudant.com](https://cloudant.com))
* Need a coinmarketcap.com account.

Edit `config.js`:

* Point it to a new Couchdb database
* Point it to a BitcoinZ Core RPC server
* Update coinmarketcap API key

Tests
-----

```
Tests in progress
```

Running
-------

```
$ nodejs btcz-pay.js
$ nodejs worker.js
$ nodejs worker2.js
```

Open [http://localhost:2222](http://localhost:2222) in browser, you should see the website sample.
That's it, ready to use.

License
-------

MIT

Author
------

Marcelus


TODO
----

TBD

API
===

### GET /request_payment/:expect/:currency/:message/:seller/:customer/:callback_url


Create a request to pay, supported currencies: BTC, USD, EUR. Non-btc currency is converted to btc using current rate from bitstamp.com.
Returns a json document with QR code to be displayed to the payer, and a unique address for that particular payment (you can use it as invoice id).
Message will be displayed to the client (for example, you can write "Payment for goods"). Seller and customer - system field, here you can
write the application that created the request and the payer id. Keep Seller field private, it is also used for payouts.
Callback_url will be requested once the invoice is paid.

	Example

		http://localhost:2222/request_payment/0.005/BTCZ/wheres%20the%20money%20lebowski/treehorn/lebowski/http%3A%2F%2Fgoogle.com%2F

### GET /check_payment/:_id


Check payment by a unique invoice number in the "request_payment" call.


	Example

		http://localhost:2222/check_payment/f22c44cb-e26a-4022-864f-00f0d523d48a

```
{
  "generated":"t1gwku8spbCFUodyJ26njknnDxeZGM8hVmm",
  "btcz_expected":14.77818972,
  "btcz_actual":0,
  "btcz_unconfirmed":0,
  "currency":"USD",
  "amount":0.01,
  "timestamp_start":1537815608394,
  "timestamp_now":1537816142575,
  "timestamp_stop":1537816808394,
  "state":0
}
```


