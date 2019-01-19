/*
* These are the request handlers
*/

// dependencies
var _data = require('./data');
var helpers = require('./helpers');
var config = require('./config');


//define the route handlers object
var handlers = {};

/*
* HTML handlers
*/

//index handler
handlers.index = function(data, cb) {
	//reject any request that is not a GET
	if (data.method == 'get') {
		//prepare data for interpolation
		var templateData = {
			'head.title': 'This is the title',
			'head.description': 'This is the meta edscription',
			'body.title': 'Hello templated world!',
			'body.class': 'index'
		};		
		helpers.getTemplate('index', templateData, function(err, str){
			if (!err && str) {
				// add the universal header and footer
				helpers.addUniversalTemplates(str, templateData, function(err, str){
					if (!err && str) {
						cb(200, str, 'html');						
					} else {
						cb(500,'undefined','html')
					}
				});
			} else {
				cb(500,'undefined','html');
			}
		});
	} else {
		cb(405, 'undefined', 'html');
	}
};

//favicon
handlers.favicon = function(data, cb){
	//reject any call that isnt a 'get'
	if (data.method == 'get') {
		helpers.getStaticAsset('favicon.ico', function(err, data){
			if (!err && data) {
				cb(200, data, 'favicon');
			} else {
				cb(500);
			}
		});
	} else {
		cb (405);
	}
};

//public assets
handlers.public = function(data, cb){
	//reject any call that isnt a 'get'
	if (data.method == 'get') {
		//get the filename being requested
		var trimmedAssetName = data.trimmedPath.replace('public/', '').trim();
		if (trimmedAssetName.length > 0) {
			helpers.getStaticAsset(trimmedAssetName, function(err, data){
				if (!err && data) {
					// determine the content type, default to plain text
					var contentType = 'plain';
					if (trimmedAssetName.indexOf('.css') > -1) {
						contentType = 'css';
					}
					if (trimmedAssetName.indexOf('.png') > -1) {
						contentType = 'png';
					}
					if (trimmedAssetName.indexOf('.jpg') > -1) {
						contentType = 'jpg';
					}
					if (trimmedAssetName.indexOf('.ico') > -1) {
						contentType = 'favicon';
					}
					cb(200, data, contentType);
				} else {
					cb(404);
				}
			});			
		} else {
			cb('Valid asset file not found');
		}
	} else {
		cb (405);
	}
};
/*
* JSON API handlers
*/

//users
handlers.users = function(data, cb) {
	var acceptableMethods = ['post', 'get', 'put', 'delete'];
	if (acceptableMethods.indexOf(data.method) > -1) {
		handlers._users[data.method](data, cb);
	} else {
		cb(405);
	}
};

// container for the users submethods
handlers._users = {};

//users - post
//required data: firstname, lastname, phone, password, tosAgreement
//optional data: none
handlers._users.post = function(data, cb){
	//ensure validity of inputs
	var firstName = typeof(data.payload.firstName) == 'string' && data.payload.firstName.trim().length > 0 ? data.payload.firstName.trim() : false;
	var lastName = typeof(data.payload.lastName) == 'string' && data.payload.lastName.trim().length > 0 ? data.payload.lastName.trim() : false;
	var phone = typeof(data.payload.phone) == 'string' && data.payload.phone.trim().length == 10 ? data.payload.phone.trim() : false;
	var password = typeof(data.payload.password) == 'string' && data.payload.password.trim().length > 0 ? data.payload.password.trim() : false;
	var tosAgreement = typeof(data.payload.tosAgreement) == 'boolean' && data.payload.tosAgreement == true ? true : false;

	if (firstName && lastName && phone && password && tosAgreement) {
		// make sure that the user does not exist
		_data.read('users', phone, function(err, data){	
			if (err) {
				//hash password
				var hashedPassword = helpers.hash(password);
				if (hashedPassword) {
					//create the user object
					var userObject = {
						'firstName': firstName,
						'lastName': lastName,
						'phone': phone,
						'hashedPassword': hashedPassword,
						'tosAgreement': true
					};			
					//store the user
					_data.create('users', phone, userObject, function(err){
						if (!err){
							cb(200);
						} else {
							console.log(err);
							cb(500, {'Error':'Could not create user'});
						}
					});								
				} else {
					cb(500, {'Error':'Could not hash password'});
				}
			} else {
				cb(400, {'Error': 'User with phone no. already exists'});
			}
		});
	} else {
		cb (400, {'Error': 'Invalid inputs'});
	}
};

//users - get
// required data: phone
//optional data: none
//@TODO Only let authentiacted usere access their object. Dont let them access any other objects
handlers._users.get = function(data, cb){
	//check that the phone no. provided is valid
	var phone = typeof(data.queryStringObject.phone) == 'string' && data.queryStringObject.phone.trim().length == 10 ? data.queryStringObject.phone.trim() : false;
	if (phone) {
		// authentiate the user via token
		var token = typeof(data.headers.token) == 'string' && data.headers.token.trim().length == 20 ? data.headers.token.trim() : false;
		handlers._tokens.verifyToken(token, phone, function(tokenIsVaild){
			if (tokenIsVaild) {
				//lookup the user
				_data.read('users', phone, function(err, data){
					if (!err && data) {
						// remove the hashed password before returning it to user
						delete data.hashedPassword;
						cb(200, data);
					} else {
						cb(404);
					}			
				});					
			} else {
				cb(403, {'Error': 'Token is invalid or has expired'});				
			}
		});
	} else {
		cb(400, {'Error': 'Missing required field'});
	}
};

//users - put
// required data: phone
//optional data: firstname, lastname, password (at least one must be specified)
//@TODO Only let authentiacted users access their oject. Dont let them access any other objects
handlers._users.put = function(data, cb){
	//check that the phone no. provided is valid
	var phone = typeof(data.payload.phone) == 'string' && data.payload.phone.trim().length == 10 ? data.payload.phone.trim() : false;
	// check for optional entries
	var firstName = typeof(data.payload.firstName) == 'string' && data.payload.firstName.trim().length > 0 ? data.payload.firstName.trim() : false;
	var lastName = typeof(data.payload.lastName) == 'string' && data.payload.lastName.trim().length > 0 ? data.payload.lastName.trim() : false;
	var password = typeof(data.payload.password) == 'string' && data.payload.password.trim().length > 0 ? data.payload.password.trim() : false;	
	if (phone) {
		// authentiate the user via token
		var token = typeof(data.headers.token) == 'string' && data.headers.token.trim().length == 20 ? data.headers.token.trim() : false;
		handlers._tokens.verifyToken(token, phone, function(tokenIsVaild){
			if (tokenIsVaild) {
				if (firstName || lastName || password) {
					//lookup the user
					_data.read('users', phone, function(err, updateData){
						if (!err && updateData) {
							if (firstName){
								updateData.firstName = firstName;
							}
							if (lastName){
								updateData.lastName = lastName;
							}
							if (password){
								var hashedPassword = helpers.hash(password);						
								updateData.hashedPassword = hashedPassword;
							}
							_data.update('users', phone, updateData, function(err){
								if (!err) {
									cb(200);						
								} else {
									console.log(err);
									cb(500, {'Error': 'Error updating user data'});
								}
							});				
						} else {
							cb(400, {'Error': 'Error, user not found'});
						}			
					});			
				} else {
					cb(400, {'Error': 'Missing entries to update'});
				}				
			} else {
				cb(403, {'Error': 'Token is invalid or has expired'});					
			}	
		});
	} else {
		cb(400, {'Error': 'Missing required field'});
	}	
};

//users - delete
// required data: phone
//optional data: firstname, lastname, password (at least one must be specified)
handlers._users.delete = function(data, cb){
	//check that the phone no. provided is valid
	var phone = typeof(data.queryStringObject.phone) == 'string' && data.queryStringObject.phone.trim().length == 10 ? data.queryStringObject.phone.trim() : false;
	if (phone) {
		// authentiate the user via token
		var token = typeof(data.headers.token) == 'string' && data.headers.token.trim().length == 20 ? data.headers.token.trim() : false;
		handlers._tokens.verifyToken(token, phone, function(tokenIsVaild){
			if (tokenIsVaild) {
				//lookup the user
				_data.read('users', phone, function(err, data){
					if (!err) {
						_data.delete('users', phone, function(err){
							if (!err) {
								//delete any checks associated with the user
								var userChecks = typeof(data.checks) == 'object' && data.checks instanceof Array ? data.checks : [];
								checksToDelete = userChecks.length;
								if (checksToDelete > 0) {
									var checksDeleted = 0;
									var deletionErrors = false;
									userChecks.forEach(function(checkId){
										//delete the check
										_data.delete('checks', checkId, function(err){
											if (err) {
												deletionErrors = true;
											}
											checksDeleted++;
											if (checksDeleted == checksToDelete) {
												if (!deletionErrors) {
													cb(200);
												} else {
													cb(500, {'Error': 'Error encountered in deleting some checks associated with user'});
												}
											}
										});
									});
								} else {
									cb(200);
								}			
							} else {
								console.log(err);
								cb(500, {'Error': 'Error deleting user'});
							}
						});				
					} else {
						cb(400, {'Error': 'Error, user not found'});
					}
				});			
			} else {
				cb(403, {'Error': 'Token is invalid or has expired'});					
			}	
		});
	} else {
		cb(400, {'Error': 'Missing required field'});
	}	
};

//tokens
handlers.tokens = function(data, cb) {
	var acceptableMethods = ['post', 'get', 'put', 'delete'];
	if (acceptableMethods.indexOf(data.method) > -1) {
		handlers._tokens[data.method](data, cb);
	} else {
		cb(405);
	}
};

// container for the tokens submethods
handlers._tokens = {};

//tokens - post
//require phone & password
handlers._tokens.post = function(data, cb){
	//check that the phone no. provided is valid
	var phone = typeof(data.payload.phone) == 'string' && data.payload.phone.trim().length == 10 ? data.payload.phone.trim() : false;
	var password = typeof(data.payload.password) == 'string' && data.payload.password.trim().length > 0 ? data.payload.password.trim() : false;

	if (phone && password) {
		//lookup the user
		_data.read('users', phone, function(err, userData){
			if (!err && userData) {
				var hashedPassword = helpers.hash(password);
				if (userData.hashedPassword == hashedPassword) {
					//generate token
					var tokenId = helpers.createRandomString(20);
					if (tokenId) {
						var expires = Date.now() + 1000 * 60 * 60;
						var tokenObject = {
							'phone': phone,
							'id': tokenId,
							'expires': expires
						};
						_data.create('tokens', tokenId, tokenObject, function(err){
							if (!err){
								cb(200, tokenObject);
							} else {
								console.log(err);
								cb(500, {'Error':'Could not create token'});
							}
						});							
					}
				} else {
					cb(400, {'Error': 'Error, password not correct'});
				}
			} else {
				cb(400, {'Error': 'Error, user not found'});
			}			
		});	
	} else {
		cb(400, {'Error': 'Missing required field(s)'});
	}
};

//tokens - get
//required data: id
//optional data: none
handlers._tokens.get = function(data, cb){
	//check that the phone no. provided is valid
	var id = typeof(data.queryStringObject.id) == 'string' && data.queryStringObject.id.trim().length == 20 ? data.queryStringObject.id.trim() : false;
	if (id) {
		//lookup the user
		_data.read('tokens', id, function(err, tokenData){
			if (!err && tokenData) {
				cb(200, tokenData);
			} else {
				cb(404);
			}			
		});
	} else {
		cb(400, {'Error': 'Missing required field'});
	}	
};

//tokens - put
//required data: id, extend
//optional data: none
handlers._tokens.put = function(data, cb){
	var id = typeof(data.payload.id) == 'string' && data.payload.id.trim().length == 20 ? data.payload.id.trim() : false;
	var extend = typeof(data.payload.extend) == 'boolean' && data.payload.extend == true ? true : false;
	if (id && extend) {
		//lookup the token
		_data.read('tokens', id, function(err, tokenData){
			if (!err && tokenData) {
				if (tokenData.expires > Date.now()) {
					tokenData.expires = Date.now() + 1000 * 60 * 60;
					_data.update('tokens', id, tokenData, function(err){
						if (!err) {
							cb(200);						
						} else {
							console.log(err);
							cb(500, {'Error': 'Error updating token data'});
						}
					});						
				} else {
					cb(400, {'Error': 'Token expired'});
				}				
			} else {
				cb(400, {'Error': 'Error, token not found'});
			}			
		});	
	} else {
		cb(400, {'Error': 'Missing required field(s)'});
	}		
};

//tokens - delete
//required id
//optional data: none
handlers._tokens.delete = function(data, cb){
	//check that the id. provided is valid
	var id = typeof(data.queryStringObject.id) == 'string' && data.queryStringObject.id.trim().length == 20 ? data.queryStringObject.id.trim() : false;
	if (id) {
		//lookup the token
		_data.read('tokens', id, function(err, data){
			if (!err) {
				_data.delete('tokens', id, function(err){
					if (!err) {
						cb(200);						
					} else {
						console.log(err);
						cb(500, {'Error': 'Error deleting token'});
					}
				});				
			} else {
				cb(400, {'Error': 'Error, token not found'});
			}			
		});	
	} else {
		cb(400, {'Error': 'Missing required field'});
	}		
};

//verify that a token is valid for a given user
handlers._tokens.verifyToken = function(id, phone ,cb){
	_data.read('tokens', id, function(err, tokenData){
		if (!err && tokenData) {
			//check if the token is valid
			if(tokenData.phone = phone && tokenData.expires > Date.now()){
				cb(true);
			} else {
				cb(false);
			}
		} else {
			cb(false);
		}			
	});	
};

//checks
handlers.checks = function(data, cb) {
	var acceptableMethods = ['post', 'get', 'put', 'delete'];
	if (acceptableMethods.indexOf(data.method) > -1) {
		handlers._checks[data.method](data, cb);
	} else {
		cb(405);
	}
};

// container for the checks methods
handlers._checks = {};

//checks - post
//required data: protocol, url, method, successCodes, timeoutSeconds
//optional data: none
handlers._checks.post = function(data, cb){
	//validate inputs
	var protocol = typeof(data.payload.protocol) == 'string' && ['https','http'].indexOf(data.payload.protocol) > -1 ? data.payload.protocol : false;
	var url = typeof(data.payload.url) == 'string' && data.payload.url.trim().length > 0 ? data.payload.url.trim() : false;
	var method = typeof(data.payload.method) == 'string' && ['post','get','put','delete'].indexOf(data.payload.method) > -1 ? data.payload.method : false;
	var successCodes = typeof(data.payload.successCodes) == 'object' && data.payload.successCodes instanceof Array && data.payload.successCodes.length > 0 ? data.payload.successCodes : false;
	var timeoutSeconds = typeof(data.payload.timeoutSeconds) == 'number' && data.payload.timeoutSeconds % 1 === 0 && data.payload.timeoutSeconds >= 1 && data.payload.timeoutSeconds <= 5 ? data.payload.timeoutSeconds : false;

	if (protocol && url && method && successCodes && timeoutSeconds) {
		var token = typeof(data.headers.token) == 'string' ? data.headers.token : false;
		_data.read('tokens', token, function(err,tokenData){
			if (!err && tokenData){
				var userPhone = tokenData.phone;
				//lookup user data
				_data.read('users', userPhone, function(err,userData){
					if (!err && userData){
						//lookup user checks
						var userChecks = typeof(userData.checks) == 'object' && userData.checks instanceof Array ? userData.checks : [];
						// verify that the user has less that the max no. of checks allowed for user
						if (userChecks.length < config.maxChecks){
							//create a random id for the check
							var checkId = helpers.createRandomString(20);
							//create the check object and include the user phone no.
							var checkObject = {
								'id': checkId,
								'userPhone': userPhone,
								'protocol': protocol,
								'url': url,
								'method': method,
								'successCodes': successCodes,
								'timeoutSeconds': timeoutSeconds
							};
							//save the object
							_data.create('checks', checkId, checkObject, function(err){
								if (!err){
									// add the checkId to the users object
									userData.checks = userChecks;
									userData.checks.push(checkId);
									_data.update('users', userPhone, userData, function(err){
										if (!err) {
											//return the data about the new check
											cb(200, checkObject)
										} else {
											cb(500, 'could not update user');
										}
									});
								} else {
									cb(500, 'could not create check');
								}
							});

						} else {
							cb(400, {'Error': 'user has maxed out allowed checks '+(config.maxChecks)});
						}
					} else {
						cb(403);
					}
				});
			} else {
				cb(403);
			}
		});
	} else {
		cb(400, 'Missing required inputs');
	}
};

//checks - get
//required data: id
//optional data: none
handlers._checks.get = function(data, cb){
	//check that the id is valid
	var id = typeof(data.queryStringObject.id) == 'string' && data.queryStringObject.id.trim().length == 20 ? data.queryStringObject.id.trim() : false;
	if (id) {
		//lookup the check
		_data.read('checks', id, function(err, checkData){
			if (!err && checkData){
				// authentiate the user via token
				var token = typeof(data.headers.token) == 'string' && data.headers.token.trim().length == 20 ? data.headers.token.trim() : false;
				if (token){
					handlers._tokens.verifyToken(token, checkData.userPhone, function(tokenIsValid){
						if (tokenIsValid) {
							//return the check data
							cb(200, checkData);				
						} else {
							cb(403);				
						}
					});						
				} else {
					cb(403);
				}		
			} else {
				cb(403);
			}
		});
	} else {
		cb(400, {'Error': 'Missing required field'});
	}
};

//checks - put
//required data: id
//optional data: protocol, url, method, successCodes, timeoutSeconds
handlers._checks.put = function(data, cb){
	//check that the id is valid
	var id = typeof(data.queryStringObject.id) == 'string' && data.queryStringObject.id.trim().length == 20 ? data.queryStringObject.id.trim() : false;
	//validate inputs
	var protocol = typeof(data.payload.protocol) == 'string' && ['https','http'].indexOf(data.payload.protocol) > -1 ? data.payload.protocol : false;
	var url = typeof(data.payload.url) == 'string' && data.payload.url.trim().length > 0 ? data.payload.url.trim() : false;
	var method = typeof(data.payload.method) == 'string' && ['post','get','put','delete'].indexOf(data.payload.method) > -1 ? data.payload.method : false;
	var successCodes = typeof(data.payload.successCodes) == 'object' && data.payload.successCodes instanceof Array && data.payload.successCodes.length > 0 ? data.payload.successCodes : false;
	var timeoutSeconds = typeof(data.payload.timeoutSeconds) == 'number' && data.payload.timeoutSeconds % 1 === 0 && data.payload.timeoutSeconds >= 1 && data.payload.timeoutSeconds <= 5 ? data.payload.timeoutSeconds : false;

	if (id) {
		//check for at least one field to update
		if (protocol || url || method || successCodes || timeoutSeconds ) {
			//lookup the check
			_data.read('checks', id, function(err, updateData){
				if (!err && updateData){
					// authentiate the user via token
					var token = typeof(data.headers.token) == 'string' && data.headers.token.trim().length == 20 ? data.headers.token.trim() : false;
					if (token){
						handlers._tokens.verifyToken(token, updateData.userPhone, function(tokenIsValid){
							if (tokenIsValid) {
								if (protocol){
									updateData.protocol = protocol;
								}
								if (url){
									updateData.url = url;
								}
								if (method){					
									updateData.method = method;
								}
								if (successCodes){					
									updateData.successCodes = successCodes;
								}
								if (timeoutSeconds){					
									updateData.timeoutSeconds = timeoutSeconds;
								}																				
								_data.update('checks', id, updateData, function(err){
									if (!err) {
										cb(200);						
									} else {
										console.log(err);
										cb(500, {'Error': 'Error updating checks data'});
									}
								});	
							} else {
								cb(403, {'Error': 'Invalid token'});
							}
						});	
					} else {
						cb(403, {'Error': 'Missing token'});
					}	
				} else {
					cb(403, {'Error': 'Missing checks data'});
				}	
			});	
		} else {
			cb(400, {'Error': 'Missing required field(s) to update'});
		}							
	} else {
		cb(400, {'Error': 'Missing required field'});
	}
};

//checks - delete
//required data: id
//optional data: none
handlers._checks.delete = function(data, cb){
	//check that the id is valid
	var id = typeof(data.queryStringObject.id) == 'string' && data.queryStringObject.id.trim().length == 20 ? data.queryStringObject.id.trim() : false;

	if (id) {
		//lookup the check in user data
		_data.read('checks', id, function(err, checkData){
			if (!err && checkData){
				// authentiate the user via token
				var token = typeof(data.headers.token) == 'string' && data.headers.token.trim().length == 20 ? data.headers.token.trim() : false;
				if (token){
					handlers._tokens.verifyToken(token, checkData.userPhone, function(tokenIsValid){
						if (tokenIsValid) {																			
							_data.delete('checks', id, function(err){
								if (!err) {
									//lookup user check in user
									_data.read('users',checkData.userPhone, function(err, userData){
										if (!err && userData) {
											var userChecks = typeof(userData.checks) == 'object' && userData.checks instanceof Array ? userData.checks : [];
											//get the position of the check id in the checks array and remove it
											var checkPosition = userChecks.indexOf(id);
											if (checkPosition > -1) {
												userChecks.splice(checkPosition,1);
												//userData.checks = userChecks;
												_data.update('users', checkData.userPhone, userData, function(err){
													if (!err) {
														cb(200);						
													} else {
														cb(500, {'Error': 'Error updating user data'});
													}
												});	
											} else {
												cb(500, {'Error': 'Check ID not found in checks array'});
											}												
										} else {
											cb(403);
										}
									});
					
								} else {
									cb(500, {'Error': 'Error check id in user data not found'});
								}
							});	
						} else {
							cb(403, {'Error': 'Invalid token'});
						}
					});	
				} else {
					cb(403, {'Error': 'Missing token'});
				}	
			} else {
				cb(403, {'Error': 'Missing checks data'});
			}	
		});	
						
	} else {
		cb(400, {'Error': 'Missing required field'});
	}

};

//assign sample route handler
handlers.ping = function(data, cb) {
	cb(200);
};

handlers.notFound = function(data, cb){
	cb(404);
};

module.exports = handlers;