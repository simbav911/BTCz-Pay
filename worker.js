/**
* ==============================================================================
* BTCz-Pay
* ==============================================================================
*
* Version 0.2.0 (production v1.0)
*
* Self-hosted bitcoinZ payment gateway
* https://github.com/MarcelusCH/BTCz-Pay
*
* ------------------------------------------------------------------------------
* worker.js                                            Independent nodejs worker
* ------------------------------------------------------------------------------
*
* Worker iterates through all addresses,
* marks paid and fires pingback
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
    let wait = ms => new Promise(resolve => setTimeout(resolve, ms))
    let job = await storage.getUnprocessedAdressesNewerThanPromise(Date.now() - config.process_unpaid_for_period)
    await processJob(job)
    await wait(5050)
  }
})()

async function processJob (rows) {
  try {

    console.log('worker.js', ['Check for received and mark as paid...'])

    rows = rows || {}
    rows.rows = rows.rows || []

    for (const row of rows.rows) {
      let json = row.doc

      // Check recieved amount by the address - 0 unconfirmed / 1 confirmed
      let received = await blockchain.getReceivedByAddress(json.address)

      // If confirmed is >= as expected or unconfirmed is >= expected
      // and SpeedSweep true, mark as paid
      if (received[config.confirmation_before_forward].result >= json.btc_to_ask ||
          (received[0].result >= (json.btc_to_ask+((json.btc_to_ask/100)*
          config.speed_sweep_fee))) && json.speed_sweep==1) {

        // Log if paid
        logger.log('worker.js', [json._id, 'address: '+json.address, ''
            +'expect: '+json.btc_to_ask, ''
            +'confirmed: '+received[config.confirmation_before_forward].result, ''
            +'unconfirmed: '+received[0].result, ''
            +'speed_sweep: '+json.speed_sweep])

        // Update the couchdb document
        json.processed = 'paid'
        json.paid_on = Date.now()
        logger.log('worker.js', [json._id, 'Mark paid. '])
        await storage.saveJobResultsPromise(json)

        // Set URL parameter
        let URLset = json.callback_url
        if (URLset.indexOf('?') !== -1) {
          URLset = URLset +'&secret='+json.secret+'&state=5'
        } else {
          URLset = URLset +'?secret='+json.secret+'&state=5'
        }

        // Fire server side pingback
        rp({uri: URLset}).then((result) => {
          logger.log('worker.js', [json._id, 'Pingback success done: ' , URLset])
        }).catch((error) => {
          logger.error('worker.js', [json._id, 'Pingback success fail: ' , URLset, error.message, error.stack])
        })

      } // end if
    } // end for

  } catch (error) {
    logger.error('worker.js', [ error.message, error.stack ])
  } // end try
}
