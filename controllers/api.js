/**
* ==============================================================================
* BTCz-Pay
* ==============================================================================
*
* Version 0.1.3 beta
*
* Self-hosted bitcoinZ payment gateway
* https://github.com/MarcelusCH/BTCz-Pay
*
* ------------------------------------------------------------------------------
* api.js                                                 Required by btcz-pay.js
* ------------------------------------------------------------------------------
*
* Handles all bitcoinZ payment gateway API calls
* I.e. all calls responsible for invoicing and paying in BTCz
* or the exchange rate and gateway statistics calls.
*
* ==============================================================================
*/


let express = require('express')
let crypto = require('crypto')
let router = express.Router()
let config = require('../config')
let blockchain = require('../models/blockchain')
let storage = require('../models/storage')
let signer = require('../models/signer')
let logger = require('../utils/logger')
let rp = require('request-promise')


router.get('/test/pingback/', function (req, res) {
  let secret = req.query.secret
  let state = req.query.state
  logger.log('/test/pingback/', [ 'secret : ', secret, 'state : ', state ])
})

// -----------------------------------------------------------------------------
// Get payment request with optional parameters (as query)
// -----------------------------------------------------------------------------
router.get('/api/request_payment/', function (req, res) {

  // Mandatory query
  let expect = req.query.expect                 // Expected amount
  let currency = req.query.currency             // The currency code
  let seller = req.query.seller                 // The seller BTCz address
  let ipnPingback = req.query.ipnPingback       // The IPN pingback url

  // Optional query
  let message = req.query.message               // Simple message
  let customer = req.query.customerMail         // Customer eMail
  let cliSuccessURL = req.query.cliSuccessURL   // Success return URL
  let cliErrorURL = req.query.cliErrorURL       // Error return URL
  let SpeedSweep = req.query.SpeedSweep         // Speed Pay option
  let secret = req.query.secret                 // Secret phrase

  // Check if mandatory query are set
  if ((!expect) || (!currency) || (!seller) || (!ipnPingback)) {
    logger.error('/request_payment', [ req.id, 'mandatory query not set', '' ])
    return res.send(JSON.stringify({'error': 'Mandatory query param not set'}))
  }

  // Check if the optional query are set
  if (!message) {message='na'}
  if (!customer) {customer='na'}
  if (!cliSuccessURL) {cliSuccessURL='na'}
  if (!cliErrorURL) {cliErrorURL='na'}
  if (!SpeedSweep) {SpeedSweep='0'}

  // Generate a secret phrase if not set
  if (!secret) {secret=crypto.randomBytes(20).toString('hex')}

  // redirect to the main router
  return res.redirect('/api/request_payment/'+expect+'/'+currency+'/'
                      +message+'/'+seller+'/'+customer+'/'
                      +encodeURIComponent(encodeURIComponent(ipnPingback))+'/'
                      +encodeURIComponent(encodeURIComponent(cliSuccessURL))+'/'
                      +encodeURIComponent(encodeURIComponent(cliErrorURL))+'/'
                      +SpeedSweep+'/'+secret)

}) // --------------------------------------------------------------------------


// -----------------------------------------------------------------------------
// Get payment request full router (as param)
// -----------------------------------------------------------------------------
// :seller is a address - :customer is a eMail - :SpeedSweep as integer 0/1
router.get('/api/request_payment/:expect/:currency/:message/:seller/:customer/'
            +':pingback/:cliPingbackSuccess/:cliPingbackError/:SpeedSweep/'
            +':secret', function (req, res) {

  let exchangeRate, btcToAsk, satoshiToAsk

  switch (req.params.currency) {
    //case 'AUD': exchangeRate = btczAud; break
    case 'GBP': exchangeRate = btczGbp; break
    //case 'CAD': exchangeRate = btczCad; break
    case 'RUB': exchangeRate = btczRub; break
    case 'USD': exchangeRate = btczUsd; break
    case 'EUR': exchangeRate = btczEur; break
    //case 'ZAR': exchangeRate = btczZar; break
    //case 'JPY': exchangeRate = btczJpy; break
    case 'CHF': exchangeRate = btczChf; break
    case 'BTC': exchangeRate = btczBTC; break
    case 'BTCZ': exchangeRate = 1; break
    default: return res.send(JSON.stringify({'error': 'bad currency'}))
  }

  satoshiToAsk = Math.floor((req.params.expect / exchangeRate) * 100000000)
  btcToAsk = satoshiToAsk / 100000000

  let SpeedSweep = Math.floor(req.params.SpeedSweep )
  let address = signer.generateNewSegwitAddress()

  // Set DB fields infos
  let addressData = {
    'timestamp': Date.now(),
    'expect': req.params.expect,
    'currency': req.params.currency,
    'exchange_rate': exchangeRate,
    'btc_to_ask': btcToAsk,
    'message': req.params.message,
    'seller': req.params.seller,
    'customer': req.params.customer,
    'callback_url': decodeURIComponent(decodeURIComponent(req.params.pingback)),
    'success_callback_url': decodeURIComponent(decodeURIComponent(req.params.cliPingbackSuccess)),
    'err_callback_url': decodeURIComponent(decodeURIComponent(req.params.cliPingbackError)),
    'WIF': address.WIF,
    'address': address.address,
    'doctype': 'address',
    'state': 0,
    'speed_sweep': SpeedSweep,
    'secret': req.params.secret,
    '_id': req.id
  }

  // Set payment info for QR
  let paymentInfo = {
    address: addressData.address,
    message: req.params.message,
    amount: satoshiToAsk
  }

  // Set API answer
  let answer = {
    'id': req.id,
    'secret': req.params.secret,
    'address': addressData.address,
    'link': signer.URI(paymentInfo),
    'qr': config.base_url_qr + '/generate_qr/' + encodeURIComponent(signer.URI(paymentInfo)),
    'qr_simple': config.base_url_qr + '/generate_qr/bitcoinz:' + addressData.address + '?amount=' + btcToAsk
  };

  // Execute the API action
  (async function () {
    logger.log('/request_payment', [ req.id, 'checking seller existance...' ])
    let responseBody = await storage.getSellerPromise(req.params.seller)

    // Check speed sweep and not more than 100 BTCZ
    if (SpeedSweep==1 && btcToAsk>100){
      logger.error('/request_payment', [ req.id, 'To high amound for speed sweep', btcToAsk ])
      return res.send(JSON.stringify({'error': 'To high amound for speed sweep'}))
    }

    // Check if seller addres already in DB or not
    if (typeof responseBody.error !== 'undefined') { // seller doesnt exist
      logger.log('/request_payment', [ req.id, 'seller doesnt exist. creating...' ])
      let address = req.params.seller

      // Check if address is valid
      if (!(signer.isAddressValid(address))){
        logger.error('/request_payment', [ req.id, 'seller address not valide', address ])
        return res.send(JSON.stringify({'error': 'Seller address not valide'}))
      }

      // Set seller info
      let sellerData = {
        'WIF': '',
        'address': address,
        'timestamp': Date.now(),
        'seller': address,
        '_id': address,
        'doctype': 'seller'
      }

      // Store all the staff
      logger.log('/request_payment', [ req.id, 'seller created', req.params.seller, '(', sellerData.address, ')' ])
      await storage.saveSellerPromise(req.params.seller, sellerData)
      await blockchain.importaddress(sellerData.address)
    } else { // seller exists
      logger.log('/request_payment', [ req.id, 'seller already exists', address ])
    }

    // Store all the staff
    logger.log('/request_payment', [ req.id, 'created payment address', addressData.address ])
    await storage.saveAddressPromise(addressData)
    await blockchain.importaddress(addressData.address)

    // Return answer
    res.send(JSON.stringify(answer))
  })().catch((error) => {
    logger.error('/request_payment', [ req.id, error ])
    res.send(JSON.stringify({error: error.message}))
  })
}) // --------------------------------------------------------------------------


// -----------------------------------------------------------------------------
// Check payment by the temp given id
// -----------------------------------------------------------------------------
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

      // Check if return URL are valide
      let ErrCallback = addressJson.err_callback_url
      let SuccessCallback = addressJson.success_callback_url
      if (!signer.isUrlValid(ErrCallback)) {ErrCallback=''}
      if (!signer.isUrlValid(SuccessCallback)) {SuccessCallback=''}

      // Check if gateway is expired
      if (Date.now() > (addressJson.timestamp+(config.max_payment_valid*60000)) && addressJson.state != "5") {
        logger.error('/check_payment', [ req.id, 'gateway expired', req.params.address ])
        let ErrorAnswer = {
          'error': 'gateway expired',
          'generated': addressJson.address,
          'btcz_expected': addressJson.btc_to_ask,
          'btcz_actual': received[1].result,
          'btcz_unconfirmed': received[0].result,
          'currency': addressJson.currency,
          'amount': Math.round((addressJson.btc_to_ask * addressJson.exchange_rate) * 100) / 100,
          'timestamp_start' : addressJson.timestamp,
          'timestamp_now': Date.now(),
          'timestamp_stop' : addressJson.timestamp+(config.max_payment_valid*60000),
          'state': addressJson.state,
          'err_callback_url': ErrCallback
        }
        return res.send(JSON.stringify(ErrorAnswer))
      }

      // Check if SpeedSweep and set extra fee
      let speed_sweep_fee = 0
      if (addressJson.speed_sweep==1){
        speed_sweep_fee=config.speed_sweep_fee
      }

      if (addressJson && addressJson.btc_to_ask && addressJson.doctype === 'address') {
        let answer = {
          'generated': addressJson.address,
          'btcz_expected': addressJson.btc_to_ask,
          'speed_sweep_fee': speed_sweep_fee,
          'btcz_actual': received[1].result,
          'btcz_unconfirmed': received[0].result,
          'currency': addressJson.currency,
          'amount': Math.round((addressJson.btc_to_ask * addressJson.exchange_rate) * 100) / 100,
          'timestamp_start' : addressJson.timestamp,
          'timestamp_now': Date.now(),
          'timestamp_stop' : addressJson.timestamp+(config.max_payment_valid*60000),
          'state': addressJson.state,
          'tx': addressJson.sweep_result
        }

        // Add success URL on state 5
        if (addressJson.state==5) {
          answer = {
            'generated': addressJson.address,
            'btcz_expected': addressJson.btc_to_ask,
            'speed_sweep_fee': speed_sweep_fee,
            'btcz_actual': received[1].result,
            'btcz_unconfirmed': received[0].result,
            'currency': addressJson.currency,
            'amount': Math.round((addressJson.btc_to_ask * addressJson.exchange_rate) * 100) / 100,
            'timestamp_start' : addressJson.timestamp,
            'timestamp_now': Date.now(),
            'timestamp_stop' : addressJson.timestamp+(config.max_payment_valid*60000),
            'state': addressJson.state,
            'tx': addressJson.sweep_result,
            'success_callback_url': SuccessCallback
          }
        }
        res.send(JSON.stringify(answer))
      } else {
        logger.error('/check_payment', [ req.id, 'storage error', JSON.stringify(addressJson) ])
        res.send(JSON.stringify({'error': 'storage error'}))
      }
    })

  })
}) // --------------------------------------------------------------------------


// -----------------------------------------------------------------------------
// Cancel invoice
// -----------------------------------------------------------------------------
router.get('/api/cancel/:_id', function (req, res) {

  logger.log('/api/cancel/', ['cancel invoice: ', req.params._id])

  let row = [storage.getDocumentPromise(req.params._id)]
  Promise.all(row).then((values) => {

    let json = {
      '_id': req.params._id,
      '_rev': values[0]._rev,
      'state': 2,
      'timestamp': values[0].timestamp,
      'expect': values[0].expect,
      'currency': values[0].currency,
      'exchange_rate': values[0].exchange_rate,
      'btc_to_ask': values[0].btc_to_ask,
      'message': values[0].message,
      'seller': values[0].seller,
      'customer': values[0].customer,
      'callback_url': values[0].callback_url,
      'success_callback_url': values[0].success_callback_url,
      'err_callback_url': values[0].err_callback_url,
      'WIF': values[0].WIF,
      'address': values[0].address,
      'speed_sweep': values[0].speed_sweep,
      'secret': values[0].secret,
      'doctype': 'address'

    }
    if ( values[0].state != "5"){
      storage.saveJobResultsPromise(json)

      // Set URL parameter
      let URLset = values[0].callback_url
      if (URLset.indexOf('?') !== -1) {
        URLset = URLset +'&secret='+values[0].secret+'&state=2'
      } else {
        URLset = URLset +'?secret='+values[0].secret+'&state=2'
      }

      // Fire server side pingback
      logger.log('/api/cancel/', ['firing expired callback: ' , URLset])
      rp({ uri: URLset, timeout: 2000 })

    }

  })
}) // --------------------------------------------------------------------------


// -----------------------------------------------------------------------------
// Accept invoice (continue to barrecode template section)
// -----------------------------------------------------------------------------
router.get('/api/accept/:_id', function (req, res) {

  logger.log('accept/', [ 'accept invoice: ', req.params._id])

  let row = [storage.getDocumentPromise(req.params._id)]
  Promise.all(row).then((values) => {

    let json = {
      '_id': req.params._id,
      '_rev': values[0]._rev,
      'state': 1,
      'timestamp': values[0].timestamp,
      'expect': values[0].expect,
      'currency': values[0].currency,
      'exchange_rate': values[0].exchange_rate,
      'btc_to_ask': values[0].btc_to_ask,
      'message': values[0].message,
      'seller': values[0].seller,
      'customer': values[0].customer,
      'callback_url': values[0].callback_url,
      'success_callback_url': values[0].success_callback_url,
      'err_callback_url': values[0].err_callback_url,
      'WIF': values[0].WIF,
      'address': values[0].address,
      'speed_sweep': values[0].speed_sweep,
      'secret': values[0].secret,
      'doctype': 'address'

    }
    if ( values[0].state == "0"){storage.saveJobResultsPromise(json)}

  })
}) // --------------------------------------------------------------------------


// -----------------------------------------------------------------------------
// Get exchage rate
// -----------------------------------------------------------------------------
router.get('/api/get_btcz_rate', function (req, res) {
  try {

    let answer = {
      //'AUD': btczAud,
      'GBP': btczGbp,
      //'CAD': btczCad,
      'RUB': btczRub,
      'USD': btczUsd,
      'EUR': btczEur,
      //'ZAR': btczZar,
      //'JPY': btczJpy,
      'CHF': btczChf,
      'BTC': btczBTC
    };

    res.send(JSON.stringify(answer))

  } catch (error) {
    logger.error('/api/get_btcz_rate', [ req.id, error ])
    return res.send({'error': error.message})
  }
}) // --------------------------------------------------------------------------


// -----------------------------------------------------------------------------
// Get stats
// -----------------------------------------------------------------------------
router.get('/api/stats/CountGateway', function (req, res) {
  try {

    let gatewayTot = [storage.CountGateway()]
    Promise.all(gatewayTot).then((values) => {

      let answer = {
        'nb': JSON.parse(values).total_rows
      };

      res.send(JSON.stringify(answer))

    })

  } catch (error) {
    logger.error('/api/stats/CountGateway', [ req.id, error ])
    return res.send({'error': error.message})
  }
})

router.get('/api/stats/CountGatewayExpired', function (req, res) {
  try {

    let gatewayTot = [storage.CountGatewayExpired()]
    Promise.all(gatewayTot).then((values) => {

      let answer = {
        'nb': JSON.parse(values).total_rows
      };

      res.send(JSON.stringify(answer))

    })

  } catch (error) {
    logger.error('/api/stats/CountGatewayExpired', [ req.id, error ])
    return res.send({'error': error.message})
  }
})

router.get('/api/stats/CountGatewayPaid', function (req, res) {
  try {

    let gatewayTot = [storage.CountGatewayPaid()]
    Promise.all(gatewayTot).then((values) => {

      let answer = {
        'nb': JSON.parse(values).total_rows
      };

      res.send(JSON.stringify(answer))

    })

  } catch (error) {
    logger.error('/api/stats/CountGatewayPaid', [ req.id, error ])
    return res.send({'error': error.message})
  }
})
// -----------------------------------------------------------------------------


module.exports = router
