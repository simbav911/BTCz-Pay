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
* get paid_and_sweeped_unconfirmed, wait confirmation
* and pay to tmp address (for speed pay)
*
* ==============================================================================
*/


let storage = require('./models/storage')
let config = require('./config')
let blockchain = require('./models/blockchain')
let signer = require('./models/signer')
let logger = require('./utils/logger')

require('./smoke-test')

;(async () => {
  while (1) {
    logger.log('worker4.js', '.')
    let wait = ms => new Promise(resolve => setTimeout(resolve, ms))
    let job = await storage.getPaidUnconfirmedAdressesNewerThanPromise(Date.now() - (config.process_paid_for_period))
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


      let received = await blockchain.getreceivedbyaddress(json.address)
      logger.log('worker4.js', [ 'address:', json.address, 'expect:', json.btc_to_ask, 'confirmed:', received[1].result, 'unconfirmed:', received[0].result ])


      // If balance is confirmed (paid), need to transfer it to seller
      if (+received[1].result === +received[0].result && received[0].result > 0) {

        logger.log('worker4.js', [ 'transferring', received[0].result, 'BTCz (minus fee) from', json.address, 'to tmp wallet', config.tmp_address ])
        let unspentOutputs = await blockchain.listunspent(json.address)

        let createTx = signer.createTransaction
        let tx = createTx(unspentOutputs.result, config.tmp_address, received[0].result, config.fee_tx, json.WIF)

        logger.log('worker4.js', [ 'broadcasting', tx ])
        let broadcastResult = await blockchain.broadcastTransaction(tx)
        logger.log('worker4.js', [ 'broadcast result:', JSON.stringify(broadcastResult) ])

        json.state = 5,
        json.processed = 'paid_and_sweeped'
        json.sweep_result = json.sweep_result || {}
        json.sweep_result[Date.now()] = {
          'tx': tx,
          'broadcast': broadcastResult
        }

        await storage.saveJobResultsPromise(json)


      } else {
        logger.log('worker4.js', 'balance is not ok, skip')
      }





    }

  } catch (error) {
    logger.error('worker4.js', [ error ])
  }
}
