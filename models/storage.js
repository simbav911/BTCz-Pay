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
* storage.js                                         Required by other processes
* ------------------------------------------------------------------------------
*
*
*
* ==============================================================================
*/

let request = require('request')
let config = require('../config')
let rp = require('request-promise')

// todo: Replace this function calls in others module by getAddressPromise()
exports.getDocumentPromise = function (docid) {
  return exports.getAddressPromise(docid)
}

exports.saveDocumentPromise = function (body) {
  return new Promise(function (resolve, reject) {
    request.post(config.couchdb, { json: body },
      function (error, response, body) {
      if (error) {
        return reject(body)
      }
      return resolve(response.body)
    })
  })
}

exports.getAddressPromise = function (_id) {
  return new Promise(function (resolve, reject) {
    request.get(config.couchdb + '/' + _id, function (error, response, body) {
      if (error) {
        return reject(error)
      }

      resolve(JSON.parse(body))
    })
  })
}

exports.getSellerPromise = function (sellerId) {
  return new Promise(function (resolve, reject) {
    request.get(config.couchdb + '/' + sellerId,
      function (error, response, body) {
      if (error) {
        return reject(error)
      }

      return resolve(JSON.parse(body))
    })
  })
}

exports.saveAddressPromise = function (body) {
  return new Promise(function (resolve, reject) {
    request.post(config.couchdb, { json: body },
      function (error, response, body) {
      if (error) {
        return reject(body)
      }
      return resolve(response.body)
    })
  })
}

exports.savePayoutPromise = function (body) {
  return new Promise(function (resolve, reject) {
    request.post(config.couchdb, { json: body },
      function (error, response, body) {
      if (error) {
        return reject(body)
      } else {
        return resolve(response.body)
      }
    })
  })
}

exports.saveSellerPromise = function (sellerId, data) {
  return new Promise(function (resolve, reject) {
    request.post(config.couchdb, { json: data },
      function (error, response, body) {
      if (error) {
        return reject(body)
      }
      return resolve(response.body)
    })
  })
}

exports.getUnprocessedAdressesNewerThanPromise = function (timestamp) {
  return rp.get({url: config.couchdb +
    '/_design/address/_view/unprocessed_by_timestamp?startkey=' + timestamp +
    '&inclusive_end=true&limit=10000&reduce=false&include_docs=true',
    json: true})
}

exports.getPaidAdressesNewerThanPromise = function (timestamp) {
  return rp.get({url: config.couchdb +
    '/_design/address/_view/paid_by_timestamp?startkey=' + timestamp +
    '&inclusive_end=true&limit=10000&reduce=false&include_docs=true',
    json: true})
}

exports.getPaidUnconfirmedAdressesNewerThanPromise = function (timestamp) {
  return rp.get({url: config.couchdb +
    '/_design/address/_view/paid_unconfirmed_by_timestamp?startkey='
    + timestamp +
    '&inclusive_end=true&limit=10000&reduce=false&include_docs=true',
    json: true})
}

exports.saveJobResultsPromise = function (json) {
  return rp.put(config.couchdb + '/' + json._id, { 'json': json })
}

exports.CountGateway = function () {
  return rp.get(config.couchdb + '/_design/stats/_view/all_customer')
}

exports.CountGatewayExpired = function () {
  return rp.get(config.couchdb +
    '/_design/stats/_view/all_customer_state_expired')
}

exports.CountGatewayPaid = function () {
  return rp.get(config.couchdb +
    '/_design/stats/_view/all_customer_state_paid')
}
