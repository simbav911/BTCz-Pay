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
* worker.js                                            Independent nodejs worker
* ------------------------------------------------------------------------------
*
* Worker iterates through all addresses,
* marks paid and fires callbacks
*
* ==============================================================================
*/

let rp = require('request-promise')
let storage = require('./models/storage')       // Load db call functions
let blockchain = require('./models/blockchain') // Load blockchain functions
let config = require('./config')                // Load configuration file
let logger = require('./utils/logger')          // Load the logger module
require('./smoke-test')                         // Checking DB & BtcZ node RPC

;(async () => {
  while (1) {
    logger.log('worker.js', '.')
    let wait = ms => new Promise(resolve => setTimeout(resolve, ms))
    let job = await storage.getUnprocessedAdressesNewerThanPromise(
                              Date.now() - config.process_unpaid_for_period)
    await processJob(job)
    await wait(5000)
  }
})()

async function processJob (rows) {
  try {

    rows = rows || {}
    rows.rows = rows.rows || []

    for (const row of rows.rows) {
      let json = row.doc

      // Check recieved amount by the address - 0 unconfirmed / 1 confirmed
      let received = await blockchain.getreceivedbyaddress(json.address)
      logger.log('worker.js', [ 'address:', json.address, 'expect:',
                  json.btc_to_ask, 'confirmed:', received[1].result,
                  'unconfirmed:', received[0].result ])

      // If confirmed is >= as expected or unconfirmed is >= expected
      // and SpeedSweep true, mark as paid
      if (received[1].result >= json.btc_to_ask ||
          (received[0].result >= (json.btc_to_ask+((json.btc_to_ask/100)*
          config.speed_sweep_fee))) && json.speed_sweep==1) {

        // Update the couchdb document
        json.processed = 'paid'
        json.paid_on = Date.now()
        await storage.saveJobResultsPromise(json)

        // Set URL parameter
        let URLset = json.callback_url
        if (URLset.indexOf('?') !== -1) {
          URLset = URLset +'&secret='+json.secret+'&state=5'
        } else {
          URLset = URLset +'?secret='+json.secret+'&state=5'
        }

        // Fire server side pingback
        logger.log('worker.js', 'firing success callback: ' + URLset)
        await rp({ uri: URLset, timeout: 2000 })

      } // end if
    } // end for

  } catch (error) {
    logger.error('worker.js', [ error ])
  } // end try
}
