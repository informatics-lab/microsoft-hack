'use strict';

var nconf = require('nconf');
var restify = require('restify');
var request = require('request');
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
                console.error(err, response);
                resolve(body);
            }
        })
    });
}

function askHistClimate(lat, lon, variable, operation, start, end) {
    var uri = `http://data_api:5000/${variable}/${operation}/climatology?lat=${lat}&lon=${lon}`;
    console.log(uri);
    if (start && end) {
        uri = uri + `&start_date=${start}&end_date=${end}`;
    }
    return callAPI(uri);
}

function askHistRange(lat, lon, variable, operation, start, end) {
    var uri = `http://data_api:5000/${variable}/${operation}/range?lat=${lat}&lon=${lon}`;
    console.log(uri);
    if (start && end) {
        uri = uri + `&start_date=${start}&end_date=${end}`;
    }
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

var _monthNames = [
    "january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"
];

function getDateRangeLastForm(match) {

    var now = new Date();
    var startDate = new Date(now.getTime());
    var endDate = null;

    switch (match[1]) {

        case 'week' : {
            startDate.setDate(startDate.getDate() - (7 + (now.getDay() - 1)));
            endDate = new Date(startDate.getTime());
            endDate.setDate(endDate.getDate() + 7);
        }
        break;

        case 'month' : {
            startDate.setMonth(startDate.getMonth() - 1);
            startDate.setDate(1);
            endDate = new Date(startDate.getTime());
            endDate.setDate(new Date(startDate.getDate(), startDate.getMonth() + 1, 0).getDate());
        }
        break;

        case 'year': {
            startDate.setYear(startDate.getFullYear() - 1);
            startDate.setMonth(0);
            startDate.setDate(1);
            endDate = new Date(startDate.getTime());
            endDate.setMonth(11);
            endDate.setDate(31);
        }
        break;

        default: {
            if (_monthNames.includes(match[1])) {
                startDate.setYear(startDate.getFullYear() - 1);
                startDate.setMonth(_monthNames.indexOf(match[1]));
                startDate.setDate(1);
                endDate = new Date(startDate.getTime());
                endDate.setDate(new Date(startDate.getDate(), startDate.getMonth() + 1, 0).getDate());
            }
        }
        break;
    }

    return [startDate, endDate];
}

function getDateRange(timeBounding) {

    var regex = /last (.+)/;
    var match = regex.exec(timeBounding);

    var startDate = null;
    var endDate = null;

    if (match && match.length > 0) {
        var dateRange = getDateRangeLastForm(match);
        startDate = dateRange[0];
        endDate = dateRange[1];
    }

    function format(date) {
        var formatString = "" + date.getFullYear();
        formatString += "-" + ("0" + (date.getMonth() + 1)).slice(-2);
        formatString += "-" + ("0" + date.getDate()).slice(-2);
        return formatString;
    }

    // Pretend it's 2015 (to fit data range)
    startDate.setYear(startDate.getFullYear() - 2);
    endDate.setYear(endDate.getFullYear() - 2);

    if (startDate && endDate) {
        return { start: format(startDate), end : format(endDate) };
    }

    return null;
}

function main() {

    // Set up the bot server..
    var server = restify.createServer();
    server.use(restify.bodyParser({mapParams: false}));
    server.listen(process.env.port || process.env.PORT || 3978, function () {
        console.log('%s listening to %s', server.name, server.url);
    });

    var connector = new builder.ChatConnector({
        appId: config.get("MICROSOFT_APP_ID"),
        appPassword: config.get("MICROSOFT_APP_PASSWORD")
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
                            console.log(`None Intent matched: ${session.message.text}`);
                            session.send(phrases.unknown);
                            return;
                        case "greeting" :
                            session.beginDialog("/greeting");
                            return;
                        case "help" :
                            session.beginDialog("/help");
                            return;
                        case "thanks" :
                            session.beginDialog("/thanks");
                            return;
                        case "goodbye" :
                            session.beginDialog("/goodbye");
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
                var sample = phrases.exampleIntroduction + "\n";
                var examples = phrases.examples;
                for(var i = 0; i < 3; i++) {
                    var index = getRandomInt(0, examples.length);
                    var example = examples[index];
                    examples.splice(index, 1);
                    sample = sample +` * ${example}\n`;
                }
                session.send(sample);
                session.conversationData["greeted"] = true;
            }
            session.endDialog();
        }
    ]);

    bot.dialog('/help', [
        (session, args, next) => {
            session.send(phrases.info);
            var sample = phrases.exampleIntroduction + "\n";
            var examples = phrases.examples;
            for(var i = 0; i < 3; i++) {
                var index = getRandomInt(0, examples.length);
                var example = examples[index];
                examples.splice(index, 1);
                sample = sample +` * ${example}\n`;
            }
            session.send(sample);
            session.endDialog();
        }
    ]);

    bot.dialog('/thanks', [
        (session, args, next) => {
            session.send(phrases.thanks[getRandomInt(0, phrases.thanks.length -1)]);
            session.endDialog();
        }
    ]);

    bot.dialog('/goodbye', [
        (session, args, next) => {
            session.send(phrases.goodbyes[getRandomInt(0, phrases.goodbyes.length -1)]);
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
            session.send(phrases.thinking[getRandomInt(0, phrases.thinking.length - 1)]);
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

            if (!arrayHasItemWithType(args, "location") && !session.conversationData.location) {
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
            session.send(phrases.thinking[getRandomInt(0, phrases.thinking.length - 1)]);
            askMO(session.conversationData.location)
                .then((fcst) => {

                    var variable = getEntityVariable(session.conversationData.condition);
                    var func = getEntityComparator(session.conversationData.condition);
                    var timeframe = getEntityTimeframe(session.conversationData.timebounding);
                    var operation = getEntityOperation(session.conversationData.condition);
                    session.send(phrases.waiting[getRandomInt(0, phrases.waiting.length - 1)]);

                    askHistClimate(fcst.geometry.coordinates[0], fcst.geometry.coordinates[1], variable, operation, timeframe.start, timeframe.end)
                        .then((response) => {
                            if (func(fcst.properties.forecast.current[variable].value, response.value)) {
                                session.send(affirmativeCompareToPastResponseText(variable, fcst, response));
                            } else {
                                session.send(negativeCompareToPastResponseText(variable, fcst, response));
                            }
                            session.send(buildHeroCardResponse(session, buildGraphTitle(variable, operation, fcst, response), response));
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

            if (!arrayHasItemWithType(args, "location") && !session.conversationData.location) {
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
            session.send(phrases.thinking[getRandomInt(0, phrases.thinking.length - 1)]);
            askMO(session.conversationData.location)
                .then((fcst) => {
                    var variable = getEntityVariable(session.conversationData.condition);
                    var timeframe;
                    if (session.conversationData.timebounding) {
                        timeframe = getEntityTimeframe(session.conversationData.timebounding);
                    } else {
                        timeframe = {start: null, end: null};
                    }
                    var operation = getEntityOperation(session.conversationData.condition);
                    session.send(phrases.waiting[getRandomInt(0, phrases.waiting.length - 1)]);
                    if(session.conversationData.timemodifier && session.conversationData.timemodifier === "is") {
                        askHistClimate(fcst.geometry.coordinates[0], fcst.geometry.coordinates[1], variable, operation, timeframe.start, timeframe.end)
                            .then((response)=> {
                                session.send(buildFindOptimalResponseText(variable, operation, fcst, response));
                                session.send(buildHeroCardResponse(session, buildGraphTitle(variable, operation, fcst, response), response))
                                session.endDialog();
                            })
                            .catch((err) => {
                                console.error(err);
                                session.send(phrases.error);
                                session.endDialog();
                            });
                    } else {
                        askHistRange(fcst.geometry.coordinates[0], fcst.geometry.coordinates[1], variable, operation, timeframe.start, timeframe.end)
                            .then((response)=> {
                                session.send(buildFindOptimalResponseText(variable, operation, fcst, response));
                                session.send(buildHeroCardResponse(session, buildGraphTitle(variable, operation, fcst, response), response))
                                session.endDialog();
                            })
                            .catch((err) => {
                                console.error(err);
                                session.send(phrases.error);
                                session.endDialog();
                            });
                    }
                });
        }
    ]);
}

function buildFindOptimalResponseText(variable, operation, fcst, hist) {
    var str = `The peak ${operation} ${variable} for the period ${hist.start_date} to ${hist.end_date} in ${fcst.properties.site.name} is ${hist.value}`;
    if(hist.time_answer_start ===  hist.time_answer_end) {
        str = str + ` on the date ${hist.time_answer_start}`
    } else {
        str = str + ` between the dates ${hist.time_answer_start} and ${hist.time_answer_end}`;
    }
    return str;
}

function buildGraphTitle(variable, operation, fcst, hist) {
    return `${operation} ${variable} for ${fcst.properties.site.name} ${hist.start_date} to ${hist.end_date}`;
}

function affirmativeCompareToPastResponseText(variable, fcst, hist) {
    var str = "Yes, ";
    return compareToPastResponseText(str, variable, fcst, hist);
};

function negativeCompareToPastResponseText(variable, fcst, hist) {
    var str = "No, ";
    return compareToPastResponseText(str, variable, fcst, hist);
};

function compareToPastResponseText(str, variable, fcst, hist) {
    return str + `todays peak ${variable} in ${fcst.properties.site.name} is 
    ${fcst.properties.forecast.current[variable].value}${fcst.properties.forecast.current[variable].units} 
    but the average for this place in the period between ${hist.start_date} and ${hist.end_date} is actually 
    ${hist.value}${fcst.properties.forecast.current[variable].units}`;
}


function buildHeroCardResponse(session, title, hist) {
    var msg = new builder.Message(session)
        .attachments([
            new builder.HeroCard(session)
                .title(title)
                .images([
                    builder.CardImage.create(session, hist.graph)
                ])
                .tap(builder.CardAction.openUrl(session, hist.graph))
        ]);
    return msg;
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
