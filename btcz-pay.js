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
* btcz-pay.js                                                  Main nodejs start
* ------------------------------------------------------------------------------
*
* Load the application server and set options
* Set the WebApp needed path (css, js, images,...)
* Load the API controlers
* Load/set currency exchange rate refreshing
* Startup the application server
*
* ==============================================================================
*/

let logger = require('./utils/logger')
logger.log('BOOTING UP', ['...'])



process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
let express = require('express')
let morgan = require('morgan')
let uuid = require('uuid')
let bodyParser = require('body-parser')
let rp = require('request-promise')
logger.log('BOOTING UP', ['Packages loaded.'])


     // Load the logger module
let config = require('./config')            // Load configuration file
require('./smoke-test')                     // Checking DB & BtcZ node RPC
require('./deploy-design-docs')             // Checking design docs in Couchdb
logger.log('BOOTING UP', ['Config, BC & DB read ok.'])

morgan.token('id', function getId (req) {
  return req.id
})

let app = express()
app.use(function (req, res, next) {
  req.id = uuid.v4()
  next()
})

// Application options
app.use(morgan(':id :remote-addr - :remote-user [:date[clf]] \
    ":method :url HTTP/:http-version" :status :res[content-length] \
    ":referrer" ":user-agent"'))
app.set('trust proxy', 'loopback')


app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json(null))

// WebApp needed path
app.use('/qr', express.static('qr'))
app.use('/css', express.static('docs/css'))
app.use('/js', express.static('docs/js'))
app.use('/images', express.static('docs/images'))

// For EJS rendering
app.set('views', __dirname + '/docs');
app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');
logger.log('BOOTING UP', ['Web services configured.'])

// Load API controlers
app.use(require('./controllers/api'))
app.use(require('./controllers/website'))
logger.log('BOOTING UP', ['Controlers loaded.'])


// Loop trought the API array (redudency)
async function updateExchangeRate () {
  try {

    let apiCallStr = "";
    let APIreq = {};
    let apiType = "";

    // ----- Set currency rates informations -----
    // Get it from the rate API array in config file
    global.Rates = [];
    for (i = 0; i < config.rate.api.length; i++){
      apiCallStr = config.rate.api[i];
      APIreq = {method: 'GET', uri: apiCallStr};

      await rp(APIreq).then(response => {
         for (item of JSON.parse(response)){
           if (config.rate.currency.includes(item.code)) {
             global.Rates.push({"code":item.code,"name":item.name,"rate":item.rate})
           }
         }
      }).catch((err) => {
        logger.error('updateExchangeRate()', [ err.message, err.stack ])
      });

      // break if data pulled correctly on the actual rate API
      if (global.Rates.length>0){
        for (item of global.Rates){
          if(item.code=="BTC"){global.btczBTC=item.rate}
          if(item.code=="EUR"){global.btczEur=item.rate}
          if(item.code=="USD"){global.btczUsd=item.rate}
          if(item.code=="CHF"){global.btczChf=item.rate}
        }
        logger.log('updateExchangeRate()', [global.Rates])
        break;
      }
    }

    // Return error if no data pulled
    if (global.Rates.length<1){
      global.Rates = [{"error": "No rate info set."}];
      logger.error('updateExchangeRate()', "No currency rates set.");
      return;
    } else {

    }

  } catch (error) {
    logger.error('updateExchangeRate()', [ error.message, error.stack ])
  }
}


updateExchangeRate()
setInterval(() => updateExchangeRate(), 60 * 1000 * config.marketrate_refresh)
logger.log('BOOTING UP', ['Initial exchange rate loaded.'])



// Startup server
let server = app.listen(config.port, '127.0.0.1', function () {
  logger.log('BOOTING UP', ['Listening on port '+config.port])
})

module.exports = server
