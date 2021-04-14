/**
* ==============================================================================
* BTCz-Pay
* ==============================================================================
*
* Version 0.2.1 (production v1.0)
*
* Self-hosted bitcoinZ payment gateway
* https://github.com/MarcelusCH/BTCz-Pay
*
* ------------------------------------------------------------------------------
* worker3.js                                           Independent nodejs worker
* ------------------------------------------------------------------------------
*
* worker iterates through all addresses,
* marks expired after 10 min. more than expired
* in case of client is away
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
    let job = await storage.getUnprocessedAdressesNewerThanPromise(Date.now() - (config.process_unpaid_for_period*100000))
    await processJob(job)
    await wait(60100)
  }
})()

async function processJob (rows) {
  try {

    console.log('WORKER 3', ['Check for expired gateway...'])

    rows = rows || {}
    rows.rows = rows.rows || []

    for (const row of rows.rows) {
      let json = row.doc

      // If not expired and time 10.min. more than expired
      if ((json.state==0 || json.state==1) && (json.timestamp+(config.max_payment_valid*60000)+(10*60000))<=Date.now() ){
        let received = await blockchain.getReceivedByAddress(json.address)

        // Log if expired
        logger.log('WORKER 3', [json._id, 'address: '+json.address, ''
            +'expect: '+json.btc_to_ask, ''
            +'confirmed: '+received[config.confirmation_before_forward].result, ''
            +'unconfirmed: '+received[0].result, ''
            +'speed_sweep: '+json.speed_sweep])

        json.state=2
        json.processed = 'expired'
        logger.log('WORKER 3', [json._id, 'Mark expired ! '])
        await storage.saveJobResultsPromise(json)

        // Set URL parameter
        let URLset = json.callback_url
        if (URLset.indexOf('?') !== -1) {
          URLset = URLset +'&secret='+json.secret+'&state=2'
        } else {
          URLset = URLset +'?secret='+json.secret+'&state=2'
        }

        // Fire server side pingback
        rp({uri: URLset}).then((result) => {
          logger.log('WORKER 3', [json._id, 'Pingback expired done: ' , URLset])
        }).catch((error) => {
          logger.error('WORKER 3', [json._id, 'Pingback expired fail: ' , URLset, error.message, error.stack])
        })

      } // end if
    } // end for

  } catch (error) {
    logger.error('WORKER 3', [ error.message, error.stack ])
  }
}
