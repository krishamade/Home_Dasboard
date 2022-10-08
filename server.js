const WebSocket = require('ws');
const superagent = require('superagent');
const http = require('http');
const fs = require('fs');
const request = require('axios');
const express = require('express');
var bodyParser = require("body-parser");
const app = express()
const moment = require('moment');
const MongoClient = require('mongodb').MongoClient
const mongoose = require('mongoose')
const config = require('config')
const NetworkTests = require('./models/NetworkTests')
var _ = require('lodash');
const dotenv = require('dotenv');
dotenv.config();



app.use(express.static('public'));

const server = http.createServer(app);

//Add our API keys for each service we plan on using
smartThingsApiToken = process.env.SMARTTHINGSAPITOKEN
darkSkyApiToken = process.env.DARKSKYAPITOKEN
newsApiToken = process.env.NEWSAPITOKEN

//Create web socket server
const wss = new WebSocket.Server({
    server
});
server.listen(process.env.EXPRESSPORT, () => console.log("Websocket Server Started " + moment().format('LLLL')));

//Creates POST request route for the webhook receiver
app.use(bodyParser.urlencoded({
    extended: false
}));

//Create Global Variables for each of the pieces of data we seek to acquire

//Conversion from bits to megabits
//const formulaCoversionValue = 1e+6

//Conversion from bits to megabytes
const formulaCoversionValue = 8e+6

const today = moment().format('YYYY-MM-DD-HH:mm:ss')

const lessThanTwentyFourHoursAgo = (date) => {
    return moment(date).isAfter(moment().subtract(24, 'hours'));
}

const lessThan7DaysAgo = (date) => {
    return moment(date).isAfter(moment().subtract(7, 'days'));
}
//MongoDB Connection Information
const db = config.get('mongoURI');

const uri = process.env.MONGODBAPISTRING;
const client = new MongoClient(uri, {
    useNewUrlParser: true
});

var speedTestPayload = []

mongoose
    .connect(db, {
        useNewUrlParser: true,
        useCreateIndex: true,
        useFindAndModify: false,
        useUnifiedTopology: true,
    })
    .then(() => console.log('MongoDB Connected... ' + moment().format('LLLL')))
    .catch(err => console.log(err));

//Smart Things Data
var deviceID
var deviceName
var deviceStatusMain

//DarkSky Data
var longitude = process.env.LONGITUDE
var latitude = process.env.LATITUDE

//Google News API Data
var newsSearchScope = "top-headlines"
var newsCategoryTech = "technology"
var newsCountry = "us"

//Instantiate the object that we will pass to our client
var devices = {}

const getDeviceName = async () => {

    console.log("Getting Device Names from SmartThings")
    superagent
        .get('https://api.smartthings.com/v1/devices')
        .set('Authorization', `Bearer ${smartThingsApiToken}`)
        .set('Accept', 'application/json')
        .set('Content-type', 'application/json')
        .then(response => {
            deviceResponse = response.body
            deviceItems = deviceResponse.items

            for (let device in deviceItems) {
                deviceName = deviceItems[device].label
                deviceID = deviceItems[device].deviceId
                //Pass device names and ID's to our getDeviceStatus function then run getDeviceStatuses for each device within
                getDeviceStatuses(deviceID, deviceName)
            }

        }).catch(error => {
            //console.log("There was an error: ", error)
        }).finally()

}

const getDeviceStatuses = (deviceID, deviceName) => new Promise((resolve, reject) => {


    superagent
        .get(`https://api.smartthings.com/v1/devices/${deviceID}/status`)
        .set('Authorization', `Bearer ${smartThingsApiToken}`)
        .set('Accept', 'application/json')
        .set('Content-type', 'application/json')
        .then(response => {

            resolve(response)
            //Print out device names so for console logging
            //console.log(deviceName)
            var deviceStatusResponse = response.body
            var deviceStatusComponents = deviceStatusResponse.components
            deviceStatusMain = deviceStatusComponents.main

            //add devices, device names, all device status data to the object
            devices[deviceName] = {
                'deviceID': deviceID,
                'deviceName': deviceName,
                'statusData': deviceStatusMain
            }

        }).catch(error => {

            //console.log("There was an error: ", error)

        }).finally()

})

//Asynchronus function that grabs all weather data for specified location
const getForecast = async (weatherData) => {
    console.log("Querying DarkSky for New Weather Data")
    superagent
        .get(`https://api.darksky.net/forecast/${darkSkyApiToken}/${latitude},${longitude}`)
        .then(response => {
            weatherData = response.body
            //Adds the response from DarkSky to our JSON object
            devices['weatherData'] = weatherData
        }).catch(error => {
            console.log("There was an error: ", error)
            if (error.status == 403) {
                devices['weatherData'] = null
            }
        }).finally()

}

const getGoogleNewsTop = async () => {
    console.log("Querying Google News for Latest Top Headlines")
    superagent
        .get(`https://newsapi.org/v2/${newsSearchScope}?country=${newsCountry}`)
        .set('X-Api-Key', process.env.NEWSAPITOKEN)
        .set('Accept', 'application/json')
        .set('Content-type', 'application/json')
        .then(response => {

            devices['topNewsData'] = response.body.articles

        }).catch(error => {
            console.log("There was an error: ", error)
        }).finally()
    console.log("Querying Google News for Latest Tech News Headlines")
    superagent
        .get(`https://newsapi.org/v2/${newsSearchScope}?country=${newsCountry}&category=${newsCategoryTech}`)
        .set('X-Api-Key', process.env.NEWSAPITOKEN)
        .set('Accept', 'application/json')
        .set('Content-type', 'application/json')
        .then(response => {

            devices['topTechNewsData'] = response.body.articles

        }).catch(error => {
            console.log("There was an error: ", error)
        }).finally()
}

// Initialize PRTG API Information
const prtgUsername = process.env.PRTGUSERNAME
const prtgPassHash = process.env.PRTGPASSHASH

var servicesDown = [];

const getPrtgDownData = () => new Promise((resolve, reject) => {
    request.get(`https://prtg.hamadelan.me/api/table.json?content=all&username=${prtgUsername}&passhash=${prtgPassHash}&columns=device,sensor,probe,group,status,downtimesince`)
        .then(response => {
            var serviceList = response.data.all;
            var services


            for (var i = 0; i <= serviceList.length; i++) {
                if (serviceList[i] !== undefined) {
                    if (serviceList[i].probe !== undefined && serviceList[i].probe.slice(-6) === 'NETMON') {
                        var curService = serviceList[i];
                        var curStatus = curService.status;
                        var curRawStatus = curService.status_raw;
                        var curName = curService.sensor;
                        var curGroup = curService.group;
                        var curProbe = curService.probe;

                        if (curRawStatus == 5 || curRawStatus == 4 || curRawStatus == 10 || curStatus == "Down   (simulated error)" || curRawStatus == 13) {
                            servicesDown[i] = {
                                status: curStatus,
                                status_raw: curRawStatus,
                                name: curName,
                                group: curGroup,
                                probe: curProbe
                            }
                        }
                        //console.log(serviceList)
                        //console.log(servicesDown)
                        resolve(response)
                        devices['servicesDown'] = _(servicesDown).omit(_.isUndefined).omit(_.isNull).value();

                    }
                }
            }
        }).catch(error => {

            console.log("There was an error: ", error)

        }).finally()
})

const getMongoDbData = async () => {

    speedTestPayload = {
        '24hour': [],
        '7day': [],
    }

    holder24 = []
    holder7 = []

    NetworkTests
        .find({
            dateOfEntry: {
                $lt: new Date(),
                $gte: new Date(new Date().setDate(new Date().getDate() - 7))
            }
        }) //Finds data from MongoDB Atlas in the last 24 hours
        .sort({
            date: -1
        })
        .then(data => data.forEach(item => {
            if (lessThanTwentyFourHoursAgo(item.speedTest.timestamp)) {
                speedTestPayload['24hour'].push({
                    timestamp: moment(item.speedTest.timestamp).format('MMMDD, h:mm'),
                    date: moment(item.speedTest.timestamp).format('MMDDYYYY'),
                    hour: moment(item.speedTest.timestamp).format('HH'),
                    pingLatency: Math.round(((item.speedTest.ping.latency) + Number.EPSILON) * 100) / 100,
                    downloadSpeed: Math.round(((item.speedTest.download.bytes / formulaCoversionValue) + Number.EPSILON) * 100) / 100,
                    uploadSpeed: Math.round(((item.speedTest.upload.bytes / formulaCoversionValue) + Number.EPSILON) * 100) / 100,
                    packetLoss: item.speedTest.packetLoss,
                })
            }
            if (lessThan7DaysAgo(item.speedTest.timestamp)) {
                speedTestPayload['7day'].push({
                    timestamp: moment(item.speedTest.timestamp).format('MMMDD, h:mm'),
                    date: moment(item.speedTest.timestamp).format('MMDDYYYY'),
                    hour: moment(item.speedTest.timestamp).format('HH'),
                    pingLatency: Math.round(((item.speedTest.ping.latency) + Number.EPSILON) * 100) / 100,
                    downloadSpeed: Math.round(((item.speedTest.download.bytes / formulaCoversionValue) + Number.EPSILON) * 100) / 100,
                    uploadSpeed: Math.round(((item.speedTest.upload.bytes / formulaCoversionValue) + Number.EPSILON) * 100) / 100,
                    packetLoss: item.speedTest.packetLoss,
                })
            }
            /*             var sortByDate24Hour = _.groupBy(holder24, function (item) {
                            return item.date;
                        });
                        _.forEach(sortByDate24Hour, function (value, key) {
                            sortByDate24Hour[key] = _.groupBy(sortByDate24Hour[key], function (item) {
                                speedTestPayload['24hour'].push(item.hour)
                                return item.hour
                            })
                        })

                        function sortByDate7Day () { 
                            
                            _.groupBy(holder7, function (item) {
                            return item.date;
                        });
                        _.forEach(sortByDate7Day, function (value, key) {
                            sortByDate7Day[key] = _.groupBy(sortByDate7Day[key], function (item) {
                                speedTestPayload['7day'].push(item.hour)
                                return item.hour
                            })
                        })} */



            /*             console.log (sortByDate24Hour)
             */
            devices['speedTestPayload'] = speedTestPayload
            //console.log(devices)
        }))

}

wss.on('connection', (ws, req) => {
    //Alert server of client connection, then send ONLY that client what data we have for them.
    console.log("Client Connected.")
    ws.send(JSON.stringify(devices))

    ws.on('message', (data) => {
        console.log("A client sent us a message: ", data)
    })

    ws.on('close', () => {
        console.log("A Client Has Disconnected.")
    });
})

//Sends the updated information to our clients
const updateClients = async () => {
    devices['action'] = "update"
    //Prints all data before sending
    console.log(devices)
    wss.clients.forEach((client) => {
        if (client.readyState == WebSocket.OPEN) {

            client.send(JSON.stringify(devices))
        }
    });
}

const reloadClients = async () => {
    devices['action'] = "refresh"
    wss.clients.forEach((client) => {
        if (client.readyState == WebSocket.OPEN) {
            client.send(JSON.stringify(devices))
        }
    });
}

//Creates function for async sleep if needed to delay functions
const sleep = ms => new Promise(res => setTimeout(res, ms))

const runProgram = async () => {
    await reloadClients()
    await getForecast()
    await getGoogleNewsTop()
    await getDeviceName()
    await getPrtgDownData()
    await getMongoDbData()
    //checkForUpdates()
}

runProgram()
setInterval(getMongoDbData, 30000)
setInterval(getForecast, 100000)
setInterval(getDeviceName, 10000)
setInterval(updateClients, 5000)