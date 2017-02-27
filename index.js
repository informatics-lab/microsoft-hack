'use strict';

var restify = require('restify');
var builder = require('botbuilder');

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
      session.send("Hello World!!");
    }
  ]);
}
