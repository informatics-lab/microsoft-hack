'use strict';

var nconf = require('nconf');
var restify = require('restify');
var request = require('request');
var Sugar = require('sugar-date');
var phrases = require('./phrases');
var builder = require('botbuilder');

var config = nconf.env().argv().file({file: 'localConfig.json'});

function callAPI(uri) {
    return new Promise((resolve, reject) => {
        var options = {
            uri: uri,
            method: 'GET',
            timeout: 120000
        };
        request(options, (err, response, body) => {
            if (!err && response.statusCode == 200) {
                resolve(JSON.parse(body));
            } else {
                console.error(err,response);
                resolve(body);
            }
        })
    });
}

function askHistClimate(lat, lon, variable, operation, start, end) {
    var uri = `http://api.informaticslab.co.uk/${variable}/${operation}/climatology?lat=${lat}&lon=${lon}&start_date=${start}&end_date=${end}`;
    console.log(uri);
    return callAPI(uri);
}

function askHistRange(lat, lon, variable, operation, start, end) {
    var uri = `http://api.informaticslab.co.uk/${variable}/${operation}/range?lat=${lat}&lon=${lon}&start_date=${start}&end_date=${end}`;
    console.log(uri);
    return callAPI(uri);
}

function askMO(location) {
    var uri = `https://shlmog4lwa.execute-api.eu-west-1.amazonaws.com/dev/datapoint?location=${location}`;
    return callAPI(uri);
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

    var monthNames = [
        "january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"
    ];

	var startDate = new Sugar.Date(timeBounding);
    var endDate = new Sugar.Date(timeBounding);

    if (startDate.isValid() == false) {
        startDate = new Sugar.Date();
        var split = timeBounding.split(' ');
        var comparator = split[0];
        var period = split[1];
        if (monthNames.includes(period)) {
            if (comparator == 'last') {
                while (monthNames[startDate.getMonth()] != period) {
                    startDate.rewind("1 month");
                }
            }
            else {
                return null;
            }
        }
        else {
            return null;
        }
        timeBounding = "month";
        endDate = new Sugar.Date("" + startDate.format("%c"));
    }

    startDate.rewind("2 years");
    endDate.rewind("2 years");

    if (timeBounding.indexOf("day") != -1) {
        endDate = endDate.advance("1 day");
    }
    else if (timeBounding.indexOf('week') != -1) {
        startDate.beginningOfWeek();
        endDate.endOfWeek();
    }
    else if (timeBounding.indexOf('month') != -1) {
        startDate.beginningOfMonth();
        endDate.endOfMonth();
    }
    else if (timeBounding.indexOf('year') != -1) {
        startDate.beginningOfYear();
        endDate.endOfYear();
    }
    else if (monthNames.includes(timeBounding)) {
        startDate.beginningOfMonth();
        endDate.endOfMonth();
    }

    var startString = startDate.format("%Y-%m-%d");
    var endString = endDate.format("%Y-%m-%d");

	return { start : startString, end: endString };
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

    var bot = new builder.UniversalBot(connector, {persistConversationData: true});

    // Root dialog 
    bot.dialog('/', [
        (session) => {
            // Ask
            askLUIS(session.message.text)
                .then((response) => {
                    switch (response.topScoringIntent.intent) {
                        case("None") :
                            session.send(phrases.unknown);
                            return;
                        case "greeting" :
                            session.beginDialog("/greeting");
                            return;
                        case "help" :
                            session.beginDialog("/help");
                            return;
                        case("getForecast") :
                            session.beginDialog("/getForecast", response.entities);
                            return;
                        case("compareToPast") :
                            session.beginDialog("/compareToPast", response.entities);
                            return;
                        case ("findOptimal") :
                            session.beginDialog("/findOptimal", response.entities);
                    }
                });
        }]);

    bot.dialog('/greeting', [
        (session, args, next) => {
            var greeting = phrases.greetings[getRandomInt(0, phrases.greetings.length)];
            session.send(greeting);
            if (!session.conversationData.greeted) {
                session.send(phrases.info);
                phrases.examples.forEach((phrase)=> {
                    session.send(phrase);
                });
                session.conversationData["greeted"] = true;
            }
            session.endDialog();
        }
    ]);

    bot.dialog('/help', [
        (session, args, next) => {
            session.send(phrases.info);
            phrases.examples.forEach((phrase)=> {
                session.send(phrase);
            });
            session.endDialog();
        }
    ]);

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
            session.send("just let me crunch the numbers!");
            askMO(session.conversationData.location)
                .then((fcst) => {

                    var variable = getEntityVariable(session.conversationData.condition);
                    var func = getEntityComparator(session.conversationData.condition);
                    var timeframe = getEntityTimeframe(session.conversationData.timebounding);
                    var operation = getEntityOperation(session.conversationData.condition);
                    session.send("getting there...");

                    askHistRange(fcst.geometry.coordinates[0], fcst.geometry.coordinates[1], variable, operation, timeframe.start, timeframe.end)
                        .then((response)=> {

                            if (func(fcst.properties.forecast.current[variable].value, response.value)) {
                                session.send("yes");
                            } else {
                                session.send("no");
                            }
                            session.endDialog();
                        });

                });
        }
    ]);

    bot.dialog('/findOptimal', [
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
            session.send("just let me crunch the numbers!");
            askMO(session.conversationData.location)
                .then((fcst) => {
                    var variable = getEntityVariable(session.conversationData.condition);
                    var timeframe = getEntityTimeframe(session.conversationData.timebounding);
                    var operation = getEntityOperation(session.conversationData.condition);
                    session.send("getting there...");

                    var endpoint = askHistClimate;
                    if (session.conversationData.timemodifier && session.conversationData.timemodifier == "is")
                        endpoint = askHistRange;

                    endpoint(fcst.geometry.coordinates[0], fcst.geometry.coordinates[1], variable, operation, timeframe.start, timeframe.end)
                        .then((response)=> {
                            session.send("" + response.value);
                            session.endDialog();
                        })
                        .catch((err) => {
                            console.error(err);
                            session.send(phrases.error);
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

function greaterThan(a, b) {
    return a > b;
}

function lessThan(a, b) {
    return a < b;
}

function getEntityComparator(entity) {
    switch (entity) {
        case "hotter" :
        case "warmer" :
            return greaterThan;
        case "colder" :
            return lessThan;
    }
}

function getEntityVariable(entity) {
    switch (entity) {
        case "hotter" :
        case "hottest" :
        case "warmer" :
        case "warmest" :
        case "colder" :
        case "coldest" :
            return "temperature";
    }

    if (entity.indexOf("temperature") != -1) {
        return "temperature";
    }
}

function getEntityOperation(entity) {
    switch (entity) {
        case "hottest" :
        case "warmest" :
            return "max";

        case "coldest" :
            return "min";

        case "hotter" :
        case "warmer" :
        case "colder" :
            return "mean";
    }

    if (entity.indexOf("average") != -1) {
        return "mean";
    }
}

function getEntityTimeframe(entity) {
    switch (entity) {
        case "usual" :
            return {start: null, end: null};
        default :
            return getDateRange(entity);
    }
}

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min)) + min;
}

main();
