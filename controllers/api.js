/**
 * Cashier-BTC
 * -----------
 * Self-hosted bitcoin payment gateway
 *
 * License: WTFPL
 * Author: Igor Korsakov
 * */

/**
 *
 * Handles all bitcoin payment gateway API calls
 * I.e. all calls responsible for invoicing and paying in BTC only
 *
 */



let express = require('express')
let router = express.Router()
let config = require('../config')
let blockchain = require('../models/blockchain')
let storage = require('../models/storage')
let signer = require('../models/signer')
let logger = require('../utils/logger')

// Get payment request - :seller is a address - : customer is a eMail
router.get('/api/request_payment/:expect/:currency/:message/:seller/:customer/:callback_url', function (req, res) {
  let exchangeRate, btcToAsk, satoshiToAsk

  switch (req.params.currency) {
    case 'AUD': exchangeRate = btczAud
      break
    case 'GBP': exchangeRate = btczGbp
      break
    case 'CAD': exchangeRate = btczCad
      break
    case 'RUB': exchangeRate = btczRub
      break
    case 'USD': exchangeRate = btczUsd
      break
    case 'EUR': exchangeRate = btczEur
      break
    case 'ZAR': exchangeRate = btczZar
      break
    case 'JPY': exchangeRate = btczJpy
      break
    case 'CHF': exchangeRate = btczChf
      break
    case 'BTCZ': exchangeRate = 1
      break
    default:
      return res.send(JSON.stringify({'error': 'bad currency'}))
  }

  satoshiToAsk = Math.floor((req.params.expect / exchangeRate) * 100000000)
  btcToAsk = satoshiToAsk / 100000000

  let address = signer.generateNewSegwitAddress()

  let addressData = {
    'timestamp': Date.now(),
    'expect': req.params.expect,
    'currency': req.params.currency,
    'exchange_rate': exchangeRate,
    'btc_to_ask': btcToAsk,
    'message': req.params.message,
    'seller': req.params.seller,
    'customer': req.params.customer,
    'callback_url': decodeURIComponent(req.params.callback_url),
    'WIF': address.WIF,
    'address': address.address,
    'doctype': 'address',
    '_id': req.id
  }

  let paymentInfo = {
    address: addressData.address,
    message: req.params.message,
    label: req.params.message,
    amount: satoshiToAsk
  }

  let answer = {
    'id': req.id,
    'address': addressData.address,
    'link': signer.URI(paymentInfo),
    'qr': config.base_url_qr + '/generate_qr/' + encodeURIComponent(signer.URI(paymentInfo)),
    'qr_simple': config.base_url_qr + '/generate_qr/' + addressData.address
  };

  (async function () {
    logger.log('/request_payment', [ req.id, 'checking seller existance...' ])
    let responseBody = await storage.getSellerPromise(req.params.seller)

    if (typeof responseBody.error !== 'undefined') { // seller doesnt exist
      logger.log('/request_payment', [ req.id, 'seller doesnt exist. creating...' ])
      let address = req.params.seller

      // Check if address is valid
      if (!(signer.isAddressValid(address))){
        logger.error('/request_payment', [ req.id, 'seller address not valide', address ])
        return res.send(JSON.stringify({'error': 'seller address not valide'}))
      }

      let sellerData = {
        'WIF': '',
        'address': address,
        'timestamp': Date.now(),
        'seller': address,
        '_id': address,
        'doctype': 'seller'
      }
      logger.log('/request_payment', [ req.id, 'seller created', req.params.seller, '(', sellerData.address, ')' ])
      await storage.saveSellerPromise(req.params.seller, sellerData)
      await blockchain.importaddress(sellerData.address)
    } else { // seller exists
      logger.log('/request_payment', [ req.id, 'seller already exists', address ])
    }

    logger.log('/request_payment', [ req.id, 'created payment address', addressData.address ])
    await storage.saveAddressPromise(addressData)
    await blockchain.importaddress(addressData.address)

    res.send(JSON.stringify(answer))
  })().catch((error) => {
    logger.error('/request_payment', [ req.id, error ])
    res.send(JSON.stringify({error: error.message}))
  })
})

// Check payment by the temp given address
router.get('/api/check_payment/:_id', function (req, res) {

  let PayAddress = [storage.getAddressPromise(req.params._id)]
  Promise.all(PayAddress).then((values) => {
    let PayAddress = values[0].address
    let promises = [
      blockchain.getreceivedbyaddress(PayAddress),
      storage.getAddressPromise(req.params._id)
    ]

    Promise.all(promises).then((values) => {
      let received = values[0]
      let addressJson = values[1]

      // Check if gateway is expired
      if (Date.now() > (addressJson.timestamp+(config.max_payment_valid*60000))) {
        logger.error('/check_payment', [ req.id, 'gateway expired', req.params.address ])
        return res.send(JSON.stringify({'error': 'gateway expired'}))
      }

      if (addressJson && addressJson.btc_to_ask && addressJson.doctype === 'address') {
        let answer = {
          'btc_expected': addressJson.btc_to_ask,
          'btc_actual': received[1].result,
          'btc_unconfirmed': received[0].result,
          'currency': addressJson.currency,
          'amount': Math.round((addressJson.btc_to_ask * addressJson.exchange_rate) * 100) / 100,
          'ask_timestamp_start' : addressJson.timestamp,
          'ask_timestamp_stop' : addressJson.timestamp+(config.max_payment_valid*60000)
        }
        res.send(JSON.stringify(answer))
      } else {
        logger.error('/check_payment', [ req.id, 'storage error', JSON.stringify(addressJson) ])
        res.send(JSON.stringify({'error': 'storage error'}))
      }
    })

  })
})

router.get('/api/get_btcz_rate', function (req, res) {
  try {

    let answer = {
      'AUD': btczAud,
      'GBP': btczGbp,
      'CAD': btczCad,
      'RUB': btczRub,
      'USD': btczUsd,
      'EUR': btczEur,
      'ZAR': btczZar,
      'JPY': btczJpy,
      'CHF': btczChf
    };

    logger.log('/get_btcz_rate', [ req.id, answer ])
    res.send(JSON.stringify(answer))

  } catch (error) {
    logger.error('/api/get_btcz_rate', [ req.id, error ])
    return res.send({'error': error.message})
  }
})

module.exports = router
