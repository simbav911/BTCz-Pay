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
* worker4.js                                           Independent nodejs worker
* ------------------------------------------------------------------------------
*
* worker iterates through all addresses,
* get paid_and_sweeped_unconfirmed, wait confirmation
* and pay to tmp address (for speed pay)
*
* ==============================================================================
*/

let storage = require('./models/storage')       // Load db call functions
let blockchain = require('./models/blockchain') // Load blockchain functions
let config = require('./config')                // Load configuration file
let logger = require('./utils/logger')          // Load the logger module
let signer = require('./models/signer')
require('./smoke-test')                         // Checking DB & BtcZ node RPC

;(async () => {
  while (1) {
    let wait = ms => new Promise(resolve => setTimeout(resolve, ms))
    let job = await storage.getPaidUnconfirmedAdressesNewerThanPromise(Date.now() - (config.process_paid_for_period*100000))
    await processJob(job)
    await wait(60000)
  }
})()

async function processJob (rows) {
  try {

    console.log('worker4.js', ['Check for paid (uncomfirmed) and transferring back to tmp...'])

    rows = rows || {}
    rows.rows = rows.rows || []

    for (const row of rows.rows) {
      let json = row.doc


      // Wait 10 minutes to be sure it's confirmed
      if ((json.paid_on+(10*60000))<=Date.now() ){

        // Check in blockchain
        let received = await blockchain.getReceivedByAddress(json.address)

        // If balance is confirmed (paid), need to transfer back to tmp wallet
        if (received[config.confirmation_before_forward].result >= received[0].result && received[0].result > 0) {

          // log
          logger.log('worker4.js', [json._id, ''
              +'transferring (back): '+received[0].result, ''
              +'from: '+json.address, 'to: '+config.tmp_address, ''
              +'speed_sweep: '+json.speed_sweep])

          // List unspent and create tx
          let unspentOutputs = await blockchain.listunspent(json.address)
          let createTx = signer.createTransaction
          let tx = createTx(unspentOutputs.result, config.tmp_address, (json.btc_to_ask+((json.btc_to_ask/100)*
                              config.speed_sweep_fee)), config.fee_tx, json.WIF)

          // broadcasting
          logger.log('worker4.js', [json._id, 'Broadcasting tx: ', tx ])
          let broadcastResult = await blockchain.broadcastTransaction(tx)

          // Log an store result
          json.state = 5
          json.processed = 'paid_and_sweeped'
          json.sweep_result = json.sweep_result || {}
          json.sweep_result[Date.now()] = {
            'tx': tx,
            'broadcast': broadcastResult
          }
          logger.log('worker4.js', [json._id, 'Store result: ', JSON.stringify(broadcastResult) ])
          await storage.saveJobResultsPromise(json)


        } else {
          logger.error('worker4.js', [json._id, 'Marked as paid (uncomfirmed) but balance not ok.', ''
              +'address: '+json.address, ''
              +'expect: '+json.btc_to_ask, ''
              +'confirmed: '+received[config.confirmation_before_forward].result, ''
              +'unconfirmed: '+received[0].result, ''
              +'speed_sweep: '+json.speed_sweep])

        } // end if
      }
    } // end for

  } catch (error) {
    logger.error('worker4.js', [ error.message, error.stack ])
  }
}
