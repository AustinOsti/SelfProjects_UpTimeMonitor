/*
* worker related tasks
*/

//dependencies
var path = require('path');
var fs = require('fs');
var _data = require('./data');
var https = require('https');
var http = require('http');
var helpers = require('./helpers');
var url = require('url');
var _logs = require('./logs');
var util = require('util');
var debug = util.debuglog('workers');

//instantiate the worker object
var workers = {};

//sanity checking the chack data
workers.validateCheckData = function(originalCheckData) {
	originalCheckData = typeof(originalCheckData) == 'object' && originalCheckData !== null ? originalCheckData : {};
	originalCheckData.id = typeof(originalCheckData.id) == 'string' && originalCheckData.id.trim().length == 20 ? originalCheckData.id.trim() : false;
	originalCheckData.userPhone = typeof(originalCheckData.userPhone) == 'string' && originalCheckData.userPhone.trim().length == 10 ? originalCheckData.userPhone.trim() : false;
	originalCheckData.protocol = typeof(originalCheckData.protocol) == 'string' && ['https','http'].indexOf(originalCheckData.protocol) > -1 ? originalCheckData.protocol : false;
	originalCheckData.url = typeof(originalCheckData.url) == 'string' && originalCheckData.url.trim().length > 0 ? originalCheckData.url.trim() : false;
	originalCheckData.method = typeof(originalCheckData.method) == 'string' && ['post','get','put','delete'].indexOf(originalCheckData.method) > -1 ? originalCheckData.method : false;
	originalCheckData.successCodes = typeof(originalCheckData.successCodes) == 'object' && originalCheckData.successCodes instanceof Array && originalCheckData.successCodes.length > 0 ? originalCheckData.successCodes : false;
	originalCheckData.timeoutSeconds = typeof(originalCheckData.timeoutSeconds) == 'number' && originalCheckData.timeoutSeconds % 1 == 0 && originalCheckData.timeoutSeconds >=1 && originalCheckData.timeoutSeconds <=5 ? originalCheckData.timeoutSeconds : false;	

	//set the keys that do not exist if this check had not been performed before
	originalCheckData.state = typeof(originalCheckData.state) == 'string' && ['up','down'].indexOf(originalCheckData.state) > -1 ? originalCheckData.state : 'down';
	originalCheckData.lastChecked = typeof(originalCheckData.lastChecked) == 'number' && originalCheckData.lastChecked > 0 ? originalCheckData.lastChecked : false;	

	//if all the checks pass pass the data to the next step
	if (
		originalCheckData.id &&
		originalCheckData.userPhone &&
		originalCheckData.protocol &&
		originalCheckData.url &&
		originalCheckData.method &&
		originalCheckData.successCodes &&
		originalCheckData.timeoutSeconds
	) {
		workers.performCheck(originalCheckData);
	} else {
		debug('Error. One of the checks is not validly formatted. Skipping it.');
	}	
};

//perform the check and send the original check data and the outcome of the check to the next process
workers.performCheck = function(originalCheckData){
	//prepare the initial check outome
	var checkOutcome = {
		'error': false,
		'responseCode': false
	};

	//mark that the outcome has not been sent
	var outcomeSent = false;

	//parse the hostname and the path out of originalCheckData
	var parseUrl = url.parse(originalCheckData.protocol+'://'+originalCheckData.url,true);
	var hostName = parseUrl.hostname;
	var path = parseUrl.path; //require the full path not just pathname
		
	//construct the request
	var requestDetails = {
		'protocol': originalCheckData.protocol+':',
		'hostname': hostName,
		'method': originalCheckData.method.toUpperCase(),
		'path': path,
		'timeout': originalCheckData.timeoutSeconds * 1000
	};

	//instantiate the request object using either https or http
	var _moduleToUse = originalCheckData.protocol == 'http' ? http : https;
	var req = _moduleToUse.request(requestDetails, function(res){

		//grab the status of the sent request
		var status = res.statusCode;

		//update the check outcome and pass it along the process
		checkOutcome.responseCode = status;
		if (!outcomeSent) {
			workers.processCheckOutcome(originalCheckData, checkOutcome);
			outcomeSent = true;
		}
	});

	//bind to the err event so that it does not get thrown
	req.on('error', function(e){
		//update the check outcome and pass it along the process
		checkOutcome.error = {
			'error': true,
			'value': e
		};
		debug(checkOutcome.error);
		if (!outcomeSent) {
			workers.processCheckOutcome(originalCheckData, checkOutcome);
			outcomeSent = true;
		}		
	});

	//bind to the timeout event
	req.on('timeout', function(e){
		//update the check outcome and pass it along the process
		checkOutcome.error = {
			'error': true,
			'value': 'timeout'
		};
		if (!outcomeSent) {
			workers.processCheckOutcome(originalCheckData, checkOutcome);
			outcomeSent = true;
		}		
	});	

	//end the request
	req.end();
};

//process the check outcome and update the check data as needed, trigger an alert if needed
//special logic for accomodating a check that has never been tested before (dont alert on that one)
workers.processCheckOutcome = function(originalCheckData, checkOutcome) {
	//decide if the check is considered up or down
	var state = !checkOutcome.error && checkOutcome.responseCode && originalCheckData.successCodes.indexOf(checkOutcome.responseCode) > -1 ? 'up' : 'down';

	//decide if an alert is warranted (ie status has changed and do not include if no check has been performed)	
	var alertWarranted = originalCheckData.lastChecked && originalCheckData.state != state ? true : false;

	var timeOfCheck = Date.now();
	workers.log(originalCheckData, checkOutcome, state, alertWarranted, timeOfCheck);

	//update the check data
	var newCheckData = originalCheckData;
	newCheckData.state = state;
	newCheckData.lastChecked = timeOfCheck;

	//save the check
	_data.update('checks', newCheckData.id, newCheckData, function(err){
		if (!err) {
			//sent the check to the next step in the process (ie send an alert if applicable)
			if (alertWarranted) {
				workers.alertUserToStatusChange(newCheckData);
			} else {
				debug('Check outcome has not changed. No alert needed');
			}
		} else {
			debug('Error updating check data');
		}
	});
};

//alert the user to a change in their check status
workers.alertUserToStatusChange = function(newCheckData){
	var msg = 'Alert: Your check for '+newCheckData.method.toUpperCase()+' '+newCheckData.protocol+'://'+newCheckData.url+' is currently '+newCheckData.state;
	helpers.sendTwilioSms(newCheckData.userPhone,msg, function(err){
		if (!err) {
			debug('Success. User was alerted to change of state via sms: ', msg);
		} else {
			debug('Error: Unable to alert user to change of state via sms');
		}
	});
};


workers.log = function(originalCheckData, checkOutcome, state, alertWarranted, timeOfCheck){
	//form the log data
	var logData = {
		'check': originalCheckData,
		'outcome': checkOutcome,
		'state': state,
		'alert': alertWarranted,
		'time': timeOfCheck
	};

	//convert data to a string
	var logString = JSON.stringify(logData);

	//determine the name of the log file
	var logFileName = originalCheckData.id;

	//append the log strinng to the log file	
	_logs.append(logFileName, logString, function(err){
		if (!err){
			debug('Logging to file succeded');
		} else {
			debug('Error logging to file');
		}
	});

};


//function to gather all checks
workers.gatherAllChecks = function(){
	//get all the checks
	_data.list('checks', function(err, checks){
		if (!err && checks && checks.length > 0) {
			checks.forEach(function(check){
				_data.read('checks', check, function(err, originalCheckData){
					if (!err && originalCheckData){
						//pass the data to the check validator
						workers.validateCheckData(originalCheckData);
					} else {
						debug('Error reading one of the checks data');
					}
				});
			});
		} else {
			debug('Error. Could not find any checks to process');
		}
	});	
};

//timer to execute the worker process once per minute
workers.loop = function(){
	setInterval(function(){
		workers.gatherAllChecks();
	}, 1000*60);
};

//rotate (compress) the log files
workers.rotateLogs = function() {
	//list all non compressed files
	_logs.list(false, function(err, logs){
		if (!err && logs && logs.length > 0) {
			logs.forEach(function(logName){
				//compress the data into a different file
				var logId = logName.replace('.log','');
				var newFileId = logId+'-'+Date.now();
				_logs.compress(logId, newFileId, function(err){
					if (!err) {
						//truncate the log
						_logs.truncate(logId, function(err){
							if (!err) {
								debug('Success in truncating log file');
							} else {
								debug('Error truncating one of the log files');
							}
						});
					} else {
						debug('Error compressing one of the log files', err);
					}
				});
			});
		} else {
			debug('Could not find log files to compress');
		}
	});
};

//log-rotation process once per day
workers.logRotationLoop = function(){
	setInterval(function(){
		workers.rotateLogs();
	}, 1000*60*60*24);
};

//initialize the worker
workers.init = function(){
	//send to console in yellow
	console.log('\x1b[33m%s\x1b[0m','Background workers are running');

	//execute all the checks immediately
	workers.gatherAllChecks();

	//call a loop so that the workers continue to exceute on their own
	workers.loop();

	//compress all the logs immedietley
	workers.rotateLogs();

	//call the compression loop so logs will be compressed later on
	workers.logRotationLoop();
};

//export the worker object
module.exports = workers;