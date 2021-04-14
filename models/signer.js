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
* signer.js                                          Required by other processes
* ------------------------------------------------------------------------------
*
*
*
* ==============================================================================
*/

let bitcore = require('bitcore-lib-btcz')
var validUrl = require('valid-url');


exports.createTransaction = function (utxos, toAddress, amount, fixedFee, WIF, changeAddress) {
  amount = parseInt((amount * 100000000).toFixed(0))
  fixedFee = parseInt((fixedFee * 100000000).toFixed(0))

  let pk = new bitcore.PrivateKey.fromWIF(WIF) // eslint-disable-line new-cap
  let fromAddress = (pk.toPublicKey()).toAddress(bitcore.Networks.livenet)

  changeAddress = changeAddress || fromAddress

  let transaction = new bitcore.Transaction()

  for (const utxo of utxos) {
    transaction.from({
      'address': fromAddress,
      'txid': utxo.txid,
      'vout': utxo.vout,
      'scriptPubKey': utxo.scriptPubKey,
      'satoshis': parseInt((utxo.amount * 100000000).toFixed(0))
    })
  }

  transaction
    .to(toAddress, amount - fixedFee)
    .fee(fixedFee)
    .change(changeAddress)
    .sign(pk)

  return transaction.uncheckedSerialize()
}


exports.generateNewSegwitAddress = function () {

  var privateKey = new bitcore.PrivateKey()
  var address = privateKey.toAddress().toString()

  return {
    'address': address,
    // 'WIF': keyPair.toWIF()
    'WIF': privateKey.toWIF()
  }
}



exports.isAddressValid = function (address) {
  return bitcore.Address.isValid(address)
}

exports.isUrlValid = function (ThisURL) {
  if (validUrl.isUri(ThisURL)){
      return true
  } else {
      return false
  }
}

exports.URI = function (paymentInfo) {
  let uri = 'bitcoinz:'
  uri += paymentInfo.address
  uri += '?amount='
  uri += parseFloat((paymentInfo.amount / 100000000))
  uri += '&message='
  uri += encodeURIComponent(paymentInfo.message)
  if (paymentInfo.label) {
    uri += '&label='
    uri += encodeURIComponent(paymentInfo.label)
  }

  return uri
}
