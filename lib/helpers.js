/*
* helpers for various asks
*/

//dependencies
var crypto = require('crypto');
var config = require('./config');
var querystring = require('querystring');
var https = require('https');
var path = require('path');
var fs = require('fs');

//container for all the helpers
var helpers = {};

// create a SHA256 hash
helpers.hash = function (str) {
	if (typeof(str) == 'string' && str.length > 0) {
		var hash = crypto.createHmac('sha256', config.hashingSecret).update(str).digest('hex');
		return hash;
	} else {
		return false;
	}	
};

helpers.parseJsonToObject = function(str) {
	try {
		var obj = JSON.parse(str);
		return obj;
	} catch(e) {
		return {};
	}
};

helpers.createRandomString = function(strLength) {
	strLength = typeof(strLength) == 'number' && strLength > 0 ? strLength : false;
	if (strLength) {
		var possibleCharacters = 'abcdefghijklmnopqrstuvwxyz1234567890';
		var str = '';
		for (var i=1; i <= strLength; i++) {
			var randomCharacters = possibleCharacters.charAt(Math.floor(Math.random() * possibleCharacters.length));
			str += randomCharacters;
		}
		return str;
	} else {
		return false;
	}
};

//send an SMS message via Twilio
helpers.sendTwilioSms = function(phone,msg,cb){
	//validate parameters
	phone = typeof(phone) == 'string' && phone.trim().length == 10 ? phone.trim() : false;
	msg = typeof(msg) == 'string' && msg.trim().length > 0 && msg.trim().length <= 16000 ? msg.trim() : false;

	if (phone && msg) {
		//configure the request payload
		var payload = {
			'From': config.twilio.fromPhone,
			'To': '+1'+phone,
			'Body': msg
		};
		//stringify the payload
		var stringPayload = querystring.stringify(payload);
		//configure the request details
		var requestDetails = {
			'protocol': 'https:',
			'hostname': 'api.twilio.com',
			'method': 'POST',
			'path': '/2010-04-01/Accounts/'+config.twilio.accountSid+'/Messages.json',
			'auth': config.twilio.accountSid+':'+config.twilio.authToken,
			'headers': {
				'Content-Type': 'application/x-www-form-urlencoded',
				'Content-Length': Buffer.byteLength(stringPayload)
			}
		};
		//instantiate the request object
		var req = https.request(requestDetails, function(res){
			//grab the status of the sent request
			var status = res.statusCode;
			//call succesfully if request went through
			if (status == 200 || status == 201) {
				cb(false);
			} else {
				cb('Status code returned is '+status);
			}
		});

		//bind to the error event so that it doesnt get thrown
		req.on('error', function(e){
			cb(e);
		});
		//add the payload
		req.write(stringPayload);
		//end the request
		req.end();

	} else {
		cb ('Given parameters were missing or invalid');
	}

};

helpers.getTemplate = function(templateName, data, cb){
	data = typeof(data) == 'object' && data !== null ? data : {};	
	templateName = typeof(templateName) == 'string' && templateName.length > 0 ? templateName : false;
	if (templateName) {
		var templatesDir = path.join(__dirname,'/../templates/');				
		fs.readFile(templatesDir+templateName+'.html', 'utf8', function(err, str){
			if (!err && str && str.length > 0) {
				//do interpolation on the string				
				var finalString = helpers.interpolate(str, data);
				cb(false, finalString);
			} else {
				cb('No template could be found');
			}			
		});
	} else {
		cb('Invalid template name specified');
	}
};


// add the universal header and footer to a string and pass provided data object
helpers.addUniversalTemplates = function(str, data, cb) {
	str = typeof(str) == 'string' && str.length > 0 ? str : '';
	data = typeof(data) == 'object' && data !== null ? data : {};
 	//get header
 	helpers.getTemplate('_header', data, function(err, headerString){
 		if (!err && headerString) {
 			//get footer
 			helpers.getTemplate('_footer', data, function(err, footerString){
 				if (!err && footerString) {
 					//add them all together
 					var fullString = headerString+str+footerString;
 					cb(false, fullString);
 				} else {
 					cb('Could not find the footer template');
 				}
 			});
 		} else {
 			cb('Could not find the header template');
 		}
 	});	
};


//take a given string and a data object and find/replace all the keys within it
helpers.interpolate = function(str, data) {
	str = typeof(str) == 'string' && str.length > 0 ? str : '';
	data = typeof(data) == 'object' && data !== null ? data : {};
 
	 //add template globals to the data object, prepending their key name with 'global'
	 for (var keyName in config.templateGlobals) {
	 	if (config.templateGlobals.hasOwnProperty(keyName)) {
	 		data['global.'+keyName] = config.templateGlobals[keyName];
	 	}
	 }	

	 //for each key in the data object, insert its value into the string at the corresponding key location
	 for (var key in data) {
	 	if (data.hasOwnProperty(key) && typeof(data[key]) == 'string') {
	 		var replace = data[key];
	 		var find = '{'+key+'}';

	 		str = str.replace(find, replace);
	 	}
	 }
	 return str;
};

//get the contents of a static (public) asset
helpers.getStaticAsset = function(fileName, cb){
	var fileName = typeof(fileName) == 'string' && fileName.length > 0 ? fileName : false;
	if (fileName) {
		var publicDir = path.join(__dirname,'/../public/');
		fs.readFile(publicDir+fileName, function(err, data){
			if (!err && data) {
				cb(false, data);
			} else {
				cb('No asset file found');
			}
		});
	} else {
		cb('A vaild file name not provided');
	}
};

//export container
module.exports = helpers;