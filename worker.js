/**
* BTCz-Pay
* -----------
* Self-hosted bitcoinZ payment gateway
*
* https://github.com/MarcelusCH/BTCz-Pay
*
**/

/**
 * worker iterates through all addresses,
 * marks paid and fires callbacks
 *
*/

let rp = require('request-promise')
let storage = require('./models/storage')
let blockchain = require('./models/blockchain')
let config = require('./config')
let logger = require('./utils/logger')

require('./smoke-test')

;(async () => {
  while (1) {
    logger.log('worker.js', '.')
    let wait = ms => new Promise(resolve => setTimeout(resolve, ms))
    let job = await storage.getUnprocessedAdressesNewerThanPromise(Date.now() - config.process_unpaid_for_period)
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

      let received = await blockchain.getreceivedbyaddress(json.address)
      logger.log('worker.js', [ 'address:', json.address, 'expect:', json.btc_to_ask, 'confirmed:', received[1].result, 'unconfirmed:', received[0].result ])

      // If confirmed is >= as expected or unconfirmed is >= expected and SpeedSweep true, mark as paid
      if (received[1].result >= json.btc_to_ask || (received[0].result >= (json.btc_to_ask+((json.btc_to_ask/100)*config.speed_sweep_fee))) && json.speed_sweep==1) {

        json.processed = 'paid'
        json.paid_on = Date.now()
        await storage.saveJobResultsPromise(json)
        logger.log('worker.js', 'firing callback: ' + json.callback_url)
        await rp({ uri: json.callback_url, timeout: 10 * 1000 })


      }

    }

  } catch (error) {
    logger.error('worker.js', [ error ])
  }
}
