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
* worker2.js                                           Independent nodejs worker
* ------------------------------------------------------------------------------
*
* worker iterates through all addresses,
* marks expired after 2 hour more than expired
* in case of client is away
*
* ==============================================================================
*/



let rp = require('request-promise')
let storage = require('./models/storage')
let blockchain = require('./models/blockchain')
let config = require('./config')
let logger = require('./utils/logger')

require('./smoke-test')

;(async () => {
  while (1) {
    logger.log('worker3.js', '.')
    let wait = ms => new Promise(resolve => setTimeout(resolve, ms))
    let job = await storage.getUnprocessedAdressesNewerThanPromise(Date.now() - (config.process_unpaid_for_period*1000))
    await processJob(job)
    await wait(60000)
  }
})()

async function processJob (rows) {
  try {

    rows = rows || {}
    rows.rows = rows.rows || []

    for (const row of rows.rows) {
      let json = row.doc

      if ((json.state==0 || json.state==1) && (json.timestamp+(config.max_payment_valid*60000)+(120*60000))<=Date.now() ){
        let received = await blockchain.getreceivedbyaddress(json.address)
        logger.log('worker3.js', [ 'address:', json.address, 'expect:', json.btc_to_ask, 'confirmed:', received[1].result, 'unconfirmed:', received[0].result ])

        json.state=2
        await storage.saveJobResultsPromise(json)

        // Set URL parameter
        let URLset = json.callback_url
        if (URLset.indexOf('?') !== -1) {
          URLset = URLset +'&secret='+json.secret+'&state=2'
        } else {
          URLset = URLset +'?secret='+json.secret+'&state=2'
        }

        // Fire server side pingback
        logger.log('worker3.js', 'firing expired callback: ' + URLset)
        await rp({ uri: URLset, timeout: 2000 })

      }

    }

  } catch (error) {
    logger.error('worker3.js', [ error ])
  }
}
