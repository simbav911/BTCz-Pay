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
* website.js                                             Required by btcz-pay.js
* ------------------------------------------------------------------------------
*
* Handles the bitcoinZ website pages requests
* I.e. the requests for invoicing templates page,
* the FAQ page, the index page or the qr code generating page.
*
* ==============================================================================
*/


let express = require('express')
let router = express.Router()
let qr = require('qr-image')
let crypto = require('crypto')
let fs = require('fs')
let path = require('path');
let app = express();


router.get('/generate_qr/:text', function (req, res) {
  let filename
  let qrSvg
  filename = 'qr/' + crypto.createHash('sha1').update(decodeURIComponent(decodeURIComponent(req.params.text))).digest('hex') + '.png'
  qrSvg = qr.image(decodeURIComponent(decodeURIComponent(req.params.text)), { type: 'png' })
  qrSvg.pipe(fs.createWriteStream(filename))
  qrSvg.on('end', function () {
    res.redirect(301, '/' + filename)
    res.end()
  })
  qrSvg.on('error', function () {
    res.send('QR file error')
    res.end()
  })
})


router.get('/', function (req, res) {
  return res.sendFile(path.join(__dirname + '/../docs/index.html'));
})


router.get('/invoice/:text', function (req, res) {
  return res.sendFile(path.join(__dirname + '/../docs/invoice.html'));
})


router.use(function (req, res) {
  res.status(404).send('404')
})

module.exports = router
