// retrieve node module that allows you to listen to a port and respond with data
var http = require('http');
var https = require('https');
var path = require('path');

// retrieve the url parser
var url = require('url');
// get the string decorder library
var StringDecoder = require('string_decoder').StringDecoder;
var config = require('./config');
var fs = require('fs');
var handlers = require('./handlers');
var helpers = require('./helpers');
var util = require('util');
var debug = util.debuglog('server');

//instantiate the server module object
var server = {};

// instantiate the http server
server.httpServer = http.createServer(function(req, res){
	server.unifiedServer(req, res);
});

// instantiate the https server
server.httpsServerOptions = {
	'key': fs.readFileSync(path.join(__dirname,'/../https/key.pem')),
	'cert': fs.readFileSync(path.join(__dirname,'/../https/cert.pem'))
};

server.httpsServer = https.createServer(server.httpsServerOptions, function(req, res){
	server.unifiedServer(req, res);
});


// All the server logic for both http & https servers
server.unifiedServer = function(req, res) {
	// get the url & parse it
	var parsedUrl = url.parse(req.url, true);	

	// get the path
	var path = parsedUrl.pathname;
	var trimmedPath = path.replace(/^\/+|\/+$/g,'');

	// get the query string as an object
	var queryStringObject = parsedUrl.query;

	// get the request method
	var method = req.method.toLowerCase();

	// get the request headers as an object
	var headers = req.headers;

	// get the request payload, if any
	var decoder = new StringDecoder('utf-8');
	var buffer = '';
	req.on('data', function(data){
		buffer += decoder.write(data);
	});

	req.on('end', function(){
		buffer +=decoder.end();

		// choose the handler the request received should go to
		var choosenHandler = typeof(server.router[trimmedPath]) !== 'undefined' ? server.router[trimmedPath] : handlers.notFound;

		//if the request is within the the public folder, use the public handler then
		choosenHandler = trimmedPath.indexOf('public/') > -1 ? handlers.public : choosenHandler;

		// construct the data object to send to the handler
		var data = {
			'trimmedPath': trimmedPath,
			'queryStringObject': queryStringObject,
			'method': method,
			'headers': headers,
			'payload': helpers.parseJsonToObject(buffer)
		};

		// route the request to the handler specified in the request route
		choosenHandler(data, function(statusCode, payload, contentType){

			//determine the type of response, default fall back to JSON
			contentType = typeof(contentType) == 'string' ? contentType : 'json';

			//use the status code called back by the handler or defualt to 200
			statusCode = typeof(statusCode) == 'number' ? statusCode : 200;

			//return the response parts that are content specific
			var payloadString = '';
			if (contentType == 'json') {
				//return the response to the user
				res.setHeader('Content-Type', 'application/json');	
				//use the payload called back by the handler or default to and empty object
				payload = typeof(payload) == 'object' ? payload : {};
				payloadString = JSON.stringify(payload);		
			}
			if (contentType == 'html') {
				//return the response to the user
				res.setHeader('Content-Type', 'text/html');	
				payloadString = typeof(payload) == 'string' ? payload : '';					
			}
			if (contentType == 'favicon') {
				//return the response to the user
				res.setHeader('Content-Type', 'image/x-icon');	
				payloadString = typeof(payload) !== 'undefined' ? payload : '';					
			}
			if (contentType == 'css') {
				//return the response to the user
				res.setHeader('Content-Type', 'text/css');	
				payloadString = typeof(payload) !== 'undefined' ? payload : '';					
			}
			if (contentType == 'png') {
				//return the response to the user
				res.setHeader('Content-Type', 'image/png');	
				payloadString = typeof(payload) !== 'undefined' ? payload : '';					
			}
			if (contentType == 'jpg') {
				//return the response to the user
				res.setHeader('Content-Type', 'image/jpeg');	
				payloadString = typeof(payload) !== 'undefined' ? payload : '';					
			}

			//return the response parts that are common to all content types
			res.writeHead(statusCode);
			res.end(payloadString);


			//if status code is 200 return green else return red
			if (statusCode == 200) {
				debug('\x1b[36m%s\x1b[0m',method.toUpperCase()+'/'+trimmedPath+' '+statusCode); 
			} else {
				debug('\x1b[34m%s\x1b[0m',method.toUpperCase()+'/'+trimmedPath+' '+statusCode); 
			}
		});	
	});		
};

server.router = {
	'': handlers.index,
	'acount/create': handlers.accountCreate,
	'account/edit': handlers.accountEdit,
	'account/deleted': handlers.accountDeleted,
	'session/create': handlers.sessionCreate,
	'session/deleted': handlers.sessionDeleted,
	'checks/all': handlers.checkList,
	'checks/create': handlers.checksCreate,
	'checks/edit': handlers.checksEdit,
	'ping': handlers.ping,
	'api/users': handlers.users,
	'api/tokens': handlers.tokens,
	'api/checks': handlers.checks,
	'favicon.ico': handlers.favicon,
	'public': handlers.public
};

//start the server
server.init = function() {
	//start the http server
	server.httpServer.listen(config.httpPort, function(){
		console.log('\x1b[32m%s\x1b[0m','Server listening on port '+config.httpPort);		
	});	

	//start the https server
	server.httpsServer.listen(config.httpsPort, function(){
		console.log('\x1b[31m%s\x1b[0m','Server listening on port '+config.httpsPort);		
	});

};

module.exports = server;