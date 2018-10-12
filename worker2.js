/**
 * BTCz-Pay
 * -----------
 * Self-hosted bitcoinZ payment gateway
 *
 * https://github.com/MarcelusCH/BTCz-Pay
 *
 **/

/**
 * worker.js iterates through all paid addresses (which are actually hot wallets),
 * and sweeps (forwards funds) to seller final (aggregational) wallet
 *
 */

let storage = require('./models/storage')
let config = require('./config')
let blockchain = require('./models/blockchain')
let signer = require('./models/signer')
let logger = require('./utils/logger')

require('./smoke-test')

;(async () => {
  while (1) {
    // we dont want to flood our log file, skipping this console.log
    console.log('worker2.js', '.')
    let wait = ms => new Promise(resolve => setTimeout(resolve, ms))
    let job = await storage.getPaidAdressesNewerThanPromise(Date.now() - config.process_paid_for_period)
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
      logger.log('worker2.js', [ 'address:', json.address, 'expect:', json.btc_to_ask, 'confirmed:', received[1].result, 'unconfirmed:', received[0].result ])


      // If balance is confirmed (paid), need to transfer it to seller
      if (+received[1].result === +received[0].result && received[0].result > 0) {

        let seller = await storage.getSellerPromise(json.seller)
        logger.log('worker2.js', [ 'transferring', received[0].result, 'BTCz (minus fee) from', json.address, 'to seller', seller.seller, '(', seller.address, ')' ])
        let unspentOutputs = await blockchain.listunspent(json.address)

        let createTx = signer.createTransaction
        let tx = createTx(unspentOutputs.result, seller.address, received[0].result, config.fee_tx, json.WIF)

        logger.log('worker2.js', [ 'broadcasting', tx ])
        let broadcastResult = await blockchain.broadcastTransaction(tx)
        logger.log('worker2.js', [ 'broadcast result:', JSON.stringify(broadcastResult) ])

        json.state = 5,
        json.processed = 'paid_and_sweeped'
        json.sweep_result = json.sweep_result || {}
        json.sweep_result[Date.now()] = {
          'tx': tx,
          'broadcast': broadcastResult
        }

        await storage.saveJobResultsPromise(json)



      // If balance is unconfirmed (paid) with SpeedSweep true, need to transfer it from tmp wallet
    } else if (received[0].result >= json.btc_to_ask && received[0].result > 0 && json.speed_sweep==1) {

        let seller = await storage.getSellerPromise(json.seller)
        logger.log('worker2.js', [ 'transferring unconfirmed', received[0].result, 'BTCz (minus fee) from', config.tmp_address, 'to seller', seller.seller, '(', seller.address, ')' ])
        let unspentOutputs = await blockchain.listunspent(config.tmp_address)

        let createTx = signer.createTransaction
        let tx = createTx(unspentOutputs.result, seller.address, json.btc_to_ask, config.fee_tx, config.tmp_address_WIF)

        logger.log('worker2.js', [ 'broadcasting', tx ])
        let broadcastResult = await blockchain.broadcastTransaction(tx)
        logger.log('worker2.js', [ 'broadcast result:', JSON.stringify(broadcastResult) ])

        json.state = 5,
        json.processed = 'paid_and_sweeped_unconfirmed'
        json.sweep_result = json.sweep_result || {}
        json.sweep_result[Date.now()] = {
          'tx': tx,
          'broadcast': broadcastResult
        }

        await storage.saveJobResultsPromise(json)


      } else {
        logger.log('worker2.js', 'balance is not ok, skip')
      }
    }

  } catch (error) {
    logger.error('worker2.js', [ error ])
  }
}
