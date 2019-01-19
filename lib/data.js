/*
* library for storing and editing data
*/

//dependencies
var fs = require('fs');
var path = require('path');
var helpers = require('./helpers');

//container for module
var lib = {};

// define the base directory
lib.baseDir = path.join(__dirname,'../.data/');

// create function for writing data into a file
lib.create = function(dir, file, data, cb) {
	// open the file for writing into
	fs.open(lib.baseDir+dir+'/'+file+'.json','wx', function(err,fileDescriptor){
		if (!err && fileDescriptor) {
			//convert data into a string
			var stringData = JSON.stringify(data);
			// write to file and close it
			fs.writeFile(fileDescriptor, stringData, function(err){
				if (!err){
					fs.close(fileDescriptor, function(err){
						if (!err) {
							cb(false);
						} else {
							cb('Error closing new file');
			o			}
					});
				} else {
					cb('Error writing to file');
				}
			});
		} else {
			cb('Could not create new file, it may already exist');
		}
	});
};

// function for reading data in specified file
lib.read = function(dir, file, cb) {
	fs.readFile(lib.baseDir+dir+'/'+file+'.json', 'utf-8', function(err,data){
		if (!err && data){
			var parsedData = helpers.parseJsonToObject(data);
			cb(false, parsedData);				
		} else {
			cb(err, data);			
		}
	});
};

// function to update data inside a file
lib.update = function (dir, file, data, cb) {
	//open the file for writing
	fs.open(lib.baseDir+dir+'/'+file+'.json','r+', function(err,fileDescriptor) {
		if (!err && fileDescriptor) {
			// convert data into a string
			var stringData = JSON.stringify(data);
			// truncate the file
			fs.truncate(fileDescriptor, function(err){
				if (!err) {
					// write to the file and close it
					fs.writeFile(fileDescriptor, stringData, function(err) {
						if (!err) {
							fs.close(fileDescriptor, function(err){
								if (err) {
									cb('Error closing file');
								} else {
									cb(false);
								}
							})
						} else {
							cb('Error in writing to file');
						}
					});
				} else {
					cb('Error truncating the file');	
				}
			});
		} else {
			cb('Error accessing file')
		}
	})
};

// delete a file
lib.delete = function(dir, file, cb) {
	// unlink the file
	fs.unlink(lib.baseDir+dir+'/'+file+'.json', function(err){
		if (!err) {
			cb(false);
		} else {
			cb('Error in deleting file', err);
		}	
	});	
};

lib.list = function(dir, cb){
	fs.readdir(lib.baseDir+dir+'/', function(err, data){
		if (!err && data && data.length>0) {
			var trimmedFileNames = [];
			data.forEach(function(fileName){
				trimmedFileNames.push(fileName.replace('.json',''));
			});
			cb(false, trimmedFileNames);
		} else {
			cb(err, data);
		}
	});
};

//export the module
module.exports = lib;