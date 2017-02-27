'use strict';

var nconf = require('nconf');
var restify = require('restify');
var builder = require('botbuilder');
var request = require('request');

var config = nconf.env().argv().file({file: 'localConfig.json'});

function askMO(location){
    var uri = `https://shlmog4lwa.execute-api.eu-west-1.amazonaws.com/dev/datapoint?location=${location}`;
    
    return new Promise((resolve,reject) => {
        var options = {
            uri: uri,
            method: 'GET'
        };
        request(options, (err, response, body) => {
            resolve(JSON.parse(body));
        })
    })
}

function askLuis(appId, subKey, q) {
    var uri = `https://westus.api.cognitive.microsoft.com/luis/v2.0/apps/${appId}?subscription-key=${subKey}&verbose=true&q=${q}`;

    return new Promise((resolve, reject) => {
        var options = {
            uri: uri,
            method: 'GET'
        };
        request(options, (err, response, body) => {
            resolve(JSON.parse(body));
        })
    })
}

function main() {

    var server = restify.createServer();
    server.use(restify.bodyParser({mapParams: false}));
    server.listen(process.env.port || process.env.PORT || 3978, function () {
        console.log('%s listening to %s', server.name, server.url);
    });

    var connector = new builder.ChatConnector({
        appId: process.env.MICROSOFT_APP_ID,
        appPassword: process.env.MICROSOFT_APP_PASSWORD
    });

    server.post('/api/messages', connector.listen());

    var bot = new builder.UniversalBot(connector);

    bot.dialog('/', [
        (session, args) => {
            askLuis(config.get("APP_ID"), config.get("SUB_KEY"), session.message.text)
            .then((response) => {
                switch(response.topScoringIntent.intent) {
                    case("None") :
                        session.send("Sorry I don't know what your getting at!");
                        return;
                    case("getForecast") :
                        session.beginDialog("/getForecast", response.entities)
            };
        });
    }]);

    bot.dialog('/getForecast', [
        (session, args, next) => {
            if (!args || args.length == 0) {
                session.beginDialog("/getLocation");
            } else {
                next({response:args[0].entity});
            }
        }, 
        (session, args, next) => {
            // session.userData.location = session.message.text;
            askMO(args.response)
                .then((response)=>{
                    session.send(response.properties.forecast.text.local);
                    session.endDialog();
                }); 
        }
    ]);
    
    bot.dialog('/getLocation', [
        (session, args, next) => {
            if(!args || args.length == 0) {
                if(!session.userData.location){
                    builder.Prompts.text(session, "Where?"); 
                } else {
                    session.endDialog();
                }
            } else {
                session.endDialog();
            }
        }, 
        (session, results) => {
            session.endDialogWithResult(results);
        } 
    ]);
}

main();
