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
* worker2.js                                           Independent nodejs worker
* ------------------------------------------------------------------------------
*
* worker.js iterates through all paid addresses (which are actually hot
* wallets), and sweeps (forwards funds) to seller final (aggregational) wallet
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
    let job = await storage.getPaidAdressesNewerThanPromise(Date.now() - config.process_paid_for_period)
    await processJob(job)
    await wait(4900)
  }
})()

async function processJob (rows) {
  try {

    console.log('worker2.js', ['Check for paid and transferring...'])

    rows = rows || {}
    rows.rows = rows.rows || []

    for (const row of rows.rows) {
      let json = row.doc

      // Check in blockchain
      let received = await blockchain.getReceivedByAddress(json.address)

      // If balance is confirmed (paid), need to transfer it to seller
      if (received[config.confirmation_before_forward].result >= received[0].result && received[0].result > 0) {

        // Check seller info and log transfer
        let seller = await storage.getSellerPromise(json.seller)
        logger.log('worker2.js', [json._id, ''
            +'transferring confirmed: '+received[0].result, ''
            +'from: '+json.address, 'to: '+seller.seller, ''
            +'speed_sweep: '+json.speed_sweep])

        // List unspent and create tx
        let unspentOutputs = await blockchain.listunspent(json.address)
        let createTx = signer.createTransaction
        let tx = createTx(unspentOutputs.result, seller.address, json.btc_to_ask, config.fee_tx, json.WIF)

        // broadcasting
        logger.log('worker2.js', [json._id, 'Broadcasting tx: ', tx ])
        let broadcastResult = await blockchain.broadcastTransaction(tx)

        // Log an store result
        json.state = 5
        json.processed = 'paid_and_sweeped'
        json.sweep_result = json.sweep_result || {}
        json.sweep_result[Date.now()] = {
          'tx': tx,
          'broadcast': broadcastResult
        }
        logger.log('worker2.js', [json._id, 'Store result: ', JSON.stringify(broadcastResult) ])
        await storage.saveJobResultsPromise(json)


      // If balance is unconfirmed (paid) with SpeedSweep true, need to transfer it from tmp wallet
    } else if (received[0].result >= json.btc_to_ask && received[0].result > 0 && json.speed_sweep==1) {

        // Check seller info and log transfer
        let seller = await storage.getSellerPromise(json.seller)
        logger.log('worker2.js', [json._id, ''
            +'transferring unconfirmed: '+received[0].result, ''
            +'from: '+config.tmp_address, 'to: '+seller.seller, ''
            +'speed_sweep: '+json.speed_sweep])

        // List unspent and create tx
        let unspentOutputs = await blockchain.listunspent(config.tmp_address)
        let createTx = signer.createTransaction
        let tx = createTx(unspentOutputs.result, seller.address, json.btc_to_ask, config.fee_tx, config.tmp_address_WIF)

        // broadcasting
        logger.log('worker2.js', [json._id, 'Broadcasting tx: ', tx ])
        let broadcastResult = await blockchain.broadcastTransaction(tx)

        // Log an store result
        json.state = 5
        json.processed = 'paid_and_sweeped_unconfirmed'
        json.sweep_result = json.sweep_result || {}
        json.sweep_result[Date.now()] = {
          'tx': tx,
          'broadcast': broadcastResult
        }
        logger.log('worker2.js', [json._id, 'Store result: ', JSON.stringify(broadcastResult) ])
        await storage.saveJobResultsPromise(json)

      } else {
        logger.error('worker2.js', [json._id, 'Marked as paid but balance not ok.', ''
            +'address: '+json.address, ''
            +'expect: '+json.btc_to_ask, ''
            +'confirmed: '+received[config.confirmation_before_forward].result, ''
            +'unconfirmed: '+received[0].result, ''
            +'speed_sweep: '+json.speed_sweep])

      } // end if
    } // end for

  } catch (error) {
    logger.error('worker2.js', [ error.message, error.stack ])
  } // end try
}
