'use strict';

var nconf = require('nconf');
var restify = require('restify');
var builder = require('botbuilder');

var config = nconf.env().argv().defaults({config:'localConfig.json'});

function askLuis(appId, subKey, q) {
  var uri = `https://westus.api.cognitive.microsoft.com/luis/v2.0/apps/${appId}?subscription-key=${subKey}&verbose=true&q=${q}`;

  return new Promise((resolve, reject) => {
    var options = {
      uri: uri,
      method : 'GET'
    };
    request(options, (err, response, body) => {
      resolve([endpoint, response]);
    })
}

function main() {

  var server = restify.createServer();
  server.use(restify.bodyParser({ mapParams: false }));
  server.listen(process.env.port || process.env.PORT || 3978, function () {
     console.log('%s listening to %s', server.name, server.url); 
  });

  var connector = new builder.ChatConnector({
      appId: process.env.MICROSOFT_APP_ID,
      appPassword: process.env.MICROSOFT_APP_PASSWORD
  });

  server.post('/api/messages',  connector.listen()); 

  var bot = new builder.UniversalBot(connector);
  bot.dialog('/', [
    (session, args) => {
      askLuis(config.get("APP_ID"), config.get("SUB_KEY"), session.message.text);
    }
  ]);
}
