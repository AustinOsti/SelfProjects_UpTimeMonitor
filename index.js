/*
* Primary file for the API
*/

//dependencies
var server = require('./lib/server');
var workers = require('./lib/workers');

/* twilio api testor
var helpers = require('./lib/helpers');
helpers.sendTwilioSms('4158375309', 'Hello There!', function(error){
	console.log('There was an error', error);
});
*/

//declare the app
var app = {};

//init function
app.init = function(){
	//start the server
	server.init();

	//start the workers
	workers.init();
}

//execute
app.init();

//export the app
module.exports = app;