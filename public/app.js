/*
* this is the front end logic of the application
*/

console.log("Hello World!");

//container for the f/e app
var app = {};

//config object - holds environment/state dependent variables
app.config = {
	'sessionToken': false
};

//AJAX client for the RESTful API
app.client = {};

//interface for making API calls
app.client.request = function(headers,path,method,queryStringObject,payload,cb){
	//set defaults
	headers	= typeof(headers) == 'object' && headers !== null ? headers : {};
	path = typeof(headers) == 'string'  ? path : '/';
	method = typeof(method) == 'string' && ['POST', 'GET', 'PUT', 'DELETE']indexOf(method) > -1 ? method.toUpperCase().trim() : 'GET';
	queryStringObject = typeof(queryStringObject) == 'object' && queryStringObject !== null ? queryStringObject : {};
	payload = typeof(payload) == 'object' && payload !== null ? payload : {};	
	cb = typeof(cb) == 'function' ? cb : false;


	//for each query string parameter sent, add it to the path
	var requestUrl = path+'?';
	var counter = 0;
	for (var queryKey in queryStringObject){
		if (queryStringObject.hasOwnProperty(queryKey)){
			counter++;
			//if at leat one query parameter has already been addend, prepend new ones with an &
			if (counter > 1){
				requestUrl+='&';
			}
			//add the key and value
			requestUrl+=queryKey+'='+queryStringObject[queryKey];
		}
	}
	//form the http request as a JSON type
	var xhr = new XMLHttpRequest();
	xhr.open(method, requestUrl, true);
	xhr.setRequestHeader('Content-Type', 'application/json');

	//for each header sent, add it to the request
	for(var headerKey in headers){
		if (headers.hasOwnProperty(headerKey)){
			xhr.setRequestHeader(headerKey, headers[headerKey]);			
		}
	}

	//if there is a current session token, add that as a header
	if (app.config.sessionToken) {
		xhr.setRequestHeader('token', app.config.sessionToken.id);
	}

	//when the request comes back, handle the response
	xhr.onreadystatechange = function() {
		if (xhr.readyState == XMLHttpRequest.DONE) {
			var statusCode = xhr.status;
			var responseReturned = xhr.responseText;

			//callback if requested
			if (cb) {
				try{
					var paresedResponse = JSON.parse(responseReturned);
					cb(statusCode, paresedResponse);
				} catch(e) {
					cb(statusCode, false);
				}
			}
		}
	}

	//send payload as JSON
	var payloadString = JSON.stringify(payload);
	xhr.send(payloadString);
};