'use strict';

var nconf = require('nconf');
var restify = require('restify');
var builder = require('botbuilder');
var request = require('request');

var config = nconf.env().argv().file({file: 'localConfig.json'});


function askHist(lat, lon, variable, start, end) {
    var uri;
    if(start && end) {
        uri = `http://api.informaticslab.co.uk/${variable}/mean/range?lat=${lat}&lon=${lon}&start_date=${start}&end_date=${end}`;
    } else {
        uri = `http://api.informaticslab.co.uk/${variable}/mean/climatology?lat=${lat}&lon=${lon}`;
    }

    return new Promise((resolve, reject) => {
        var options = {
            uri: uri,
            method: 'GET'
        };
        request(options, (err, response, body) => {
            if (response.statusCode == 200) {
                resolve(JSON.parse(body));
            } else {
                resolve(body);
            }
        })
    })
}

function askMO(location) {
    var uri = `https://shlmog4lwa.execute-api.eu-west-1.amazonaws.com/dev/datapoint?location=${location}`;

    return new Promise((resolve, reject) => {
        var options = {
            uri: uri,
            method: 'GET'
        };
        request(options, (err, response, body) => {
            if (response.statusCode == 200) {
                resolve(JSON.parse(body));
            } else {
                resolve(body);
            }
        })
    })
}


function _askLUIS(appId, subKey, q) {
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

function askLUIS(q) {
    return _askLUIS(config.get("APP_ID"), config.get("SUB_KEY"), q);
}

function getDateRange(timeBounding) {
	var date = sugar.create(timeBounding);
	console.log(date);
	return date;
}

function main() {

    // Set up the bot server..
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

    var bot = new builder.UniversalBot(connector,  { persistConversationData: true });

    // Root dialog 
    bot.dialog('/', [
        (session) => {
            // Ask
            askLUIS(session.message.text)
                .then((response) => {
                    switch (response.topScoringIntent.intent) {
                        case("None") :
                            session.send("Sorry I don't know what your getting at!");
                            return;
                        case("getForecast") :
                            session.beginDialog("/getForecast", response.entities);
                            return;
                        case("compareToPast") :
                            session.beginDialog("/compareToPast", response.entities);

                    }
                });
        }]);

    bot.dialog('/getForecast', [
        // Get forecast, we need a location.
        // Caller may have passed us location in entities
        (session, args, next) => {
            if (!args || args.length == 0) {
                // Don't have a location, ask for one
                session.beginDialog("/getLocation");
            } else {
                // Looks like we have a location, go to next step
                // we're faking up a response object to keep all
                // the calls simple
                args.forEach((arg) => {
                    session.conversationData[arg.type] = arg.entity;
                });
                next();
            }
        },
        (session, args, next) => {
            // args.response
            askMO(session.conversationData.location)
                .then((response)=> {
                    if (typeof response === "object") {
                        session.send(response.properties.forecast.text.local);
                    }
                    else {
                        session.send(response);
                    }
                    session.endDialog();
                });
        }
    ]);

    bot.dialog('/getLocation', [
        // Ask the user what location they were thinking of
        (session, args, next) => {
            builder.Prompts.text(session, "Where?");
        },
        (session, results) => {
            session.conversationData["location"] = results.response;
            session.endDialog();
        }
    ]);

    bot.dialog('/compareToPast', [
        // Ask the user what location they were thinking of
        (session, args, next) => {

            if (args) {
                args.forEach((arg) => {
                    session.conversationData[arg.type] = arg.entity;
                });
            }

            if (!arrayHasItemWithType(args, "location")) {
                // Don't have a location, ask for one
                session.beginDialog("/getLocation");
            } else {
                // Looks like we have a location, go to next step
                // we're faking up a response object to keep all
                // the calls simple
               next();
            }
        },
        (session, args, next) => {
            // args.response
            session.send("just let me think about the answer to that for a moment");
            askMO(session.conversationData.location)
                .then((res) => {

                    var dateRange = getDateRange(session.conversationData.timebounding);

                    var variable = getEntityVariable(session.conversationData.condition);
                    var func = getEntityComparator(session.conversationData.condition);
                    var timeframe = getEntityTimeframe(session.conversationData.timebounding);

                    askHist(res.geometry.coordinates[0], res.geometry.coordinates[1], variable, timeframe.start, timeframe.end)
                        .then((response)=> {

                            if(func(res.properties.forecast.current[variable].value, response.value)) {
                                session.send("yes");
                            } else {
                                session.send("no");
                            }
                            session.endDialog();
                        });

                });
        }
    ]);

}

function arrayHasItemWithType(array, type) {
    return array.find((item) => {
        return item.type === type;
    });
}

function greaterThan(a,b) {
    return a > b;
}

function lessThan(a,b) {
    return a < b;
}

function getEntityComparator(entity) {
    switch(entity) {
        case "hotter" :
        case "warmer" :
            return greaterThan;
        case "colder" :
            return lessThan;
    }
}

function getEntityVariable(entity) {
    switch(entity) {
        case "hotter" :
        case "warmer" :
        case "colder" :
            return "temperature";
    }
};

function getEntityTimeframe(entity) {
    switch(entity) {
        case "usual" :
            return {start: null, end: null};
        default :
            return TobysDateFunction(entity);
    }
};


main();
