var API = require('./etherdelta.github.io/api.js');
var bodyParser = require('body-parser')
var app = require('express')();
var http = require('http');

var messagesFile = 'messages.json';
var messagesData = undefined;
var returnTickerData = undefined;
var orderBookData = undefined;

app.use( bodyParser.json() );
app.use(bodyParser.urlencoded({extended: true}));

app.get('/', function(req, res){
  res.redirect('https://etherdelta.github.io')
});

app.get('/returnTicker', function(req, res){
  if (!returnTickerData || Date.now()-returnTickerData.updated>1000*60*5) {
    returnTicker(function(result){
      returnTickerData = {updated: Date.now(), result: result};
      res.json(returnTickerData.result);
    })
  } else {
    res.json(returnTickerData.result);
  }
});

app.get('/orderBook', function(req, res){
  if (!orderBookData || Date.now()-orderBookData.updated>1000*10) {
    API.getOrderBook(function(err, result){
      orderBookData = {updated: Date.now(), result: result};
      res.json(orderBookData.result);
    })
  } else {
    res.json(orderBookData.result);
  }
});

app.get('/messages', function(req, res){
  if (messagesData) {
    res.json(messagesData);
  } else {
    API.utility.readFile(messagesFile, function(err, result){
      messagesData = !err ? result : [];
      res.json(messagesData);
    });
  }
});

app.post('/message', function(req, res){
  var message = req.body.message;
  messagesData.push(message);
  API.utility.writeFile(messagesFile, messagesData, function(err, result){
    res.json(messagesData);
  })
});

app.use(function(err, req, res, next){
  console.error(err);
  res.status(500);
  res.json({'error': 'An error occurred.'});
});

API.init(function(err,result){
  var port = process.env.PORT || 3000;
  http.listen(port, function(){
    console.log('listening on port '+port);
  });
}, true, './etherdelta.github.io/');

function returnTicker(callback) {
  var tickers = {};
  var firstOldPrices = {};
  API.logs(function(err, result){
    API.getTrades(function(err, result){
      var trades = result.trades;
      trades.sort(function(a,b){return a.blockNumber-b.blockNumber});
      trades.forEach(function(trade){
        if (trade.token && trade.base && trade.base.name=='ETH') {
          var pair = trade.base.name+'_'+trade.token.name;
          if (!tickers[pair]) {
            tickers[pair] = {"last":undefined,"percentChange":0,"baseVolume":0,"quoteVolume":0};
          }
          var tradeTime = API.blockTime(trade.blockNumber);
          var price = Number(trade.price);
          tickers[pair].last = price;
          if (!firstOldPrices[pair]) firstOldPrices[pair] = price;
          if (Date.now()-tradeTime.getTime() < 86400*1000*1) {
            var quoteVolume = Number(API.utility.weiToEth(Math.abs(trade.amount), API.getDivisor(trade.token)));
            var baseVolume = Number(API.utility.weiToEth(Math.abs(trade.amount * trade.price), API.getDivisor(trade.token)));
            tickers[pair].quoteVolume += quoteVolume;
            tickers[pair].baseVolume += baseVolume;
            tickers[pair].percentChange = (price - firstOldPrices[pair]) / firstOldPrices[pair];
          } else {
            firstOldPrices[pair] = price;
          }
        }
      });
      callback(tickers);
    });
  });
}
