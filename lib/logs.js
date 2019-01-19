/*
* library for storing & rotating logs
*/

var fs  = require('fs');
var path = require('path');
var zlib = require('zlib');

// container fo the module

var lib = {};

// define the base directory
lib.baseDir = path.join(__dirname,'../.logs/');

//append a string to a file. create the file if it does not exist.
lib.append = function(file,str,cb){
	//open the file for appending
	fs.open(lib.baseDir+file+'.log','a', function(err,fileDescriptor){
		if (!err && fileDescriptor){
			//append file and close it
			fs.appendFile(fileDescriptor, str+'\n', function(err){
				if (!err) {
					fs.close(fileDescriptor, function(err){
						if (!err) {
							cb(false);
						} else {
							cb('Error clsing file that was being appended');
						}
					});
				} else {
					cb('Error appending file');
				}
			});
		} else {
			cb('Could not open file for appending');
		}
	});
};

// list all logs and optionally include compressed logs
lib.list = function(includeCompressedFiles, cb){
	fs.readdir(lib.baseDir, function(err, data){
		if (!err && data && data.length > 0){
			data.forEach(function(fileName){
				var trimmedFileNames = [];
				if (fileName.indexOf('.log') > -1) {
					trimmedFileNames.push(fileName.replace('.log',''));
				}
				// if required to include zipped files
				if (fileName.indexOf('.gz.b64') > -1 && includeCompressedFiles) {
					trimmedFileNames.push(fileName.replace('.gz.b64',''));
				}
				cb(false, trimmedFileNames);
			});
		} else {
			cb(err, data);
		}
	});
};

//compress the contents of one .log file into a .gz.b64 file within the same directory
lib.compress = function(logId, newFileId, cb){
	var sourceFile = logId+'.log';
	var destFile = newFileId+'.gz.b64';

	fs.readFile(lib.baseDir+sourceFile, 'utf8', function(err, inputString){
		if (!err && inputString) {
			zlib.gzip(inputString, function(err, buffer){
				if (!err && buffer) {
					//send the data to the destination file
					fs.open(lib.baseDir+destFile,'wx', function(err, fileDescriptor){
						if (!err && fileDescriptor) {
							//write to destination file
							fs.writeFile(fileDescriptor, buffer.toString('base64'), function(err){
								if (!err) {
									//close the destinaiton file
									fs.close(fileDescriptor, function(err){
										if (!err) {
											cb(false);
										} else {
											cb(err);
										}
									});
								} else {
									cb(err);
								}
							});
						} else {
							cb(err);
						}
					});
				} else {
					cb(err);
				}
			});
		} else {
			cb(err);
		}
	});
};

//decompress the contents of a .gz.b64 file into a string variable
lib.decompress = function(fileId, cb){
	var fileName = fileId+'.gz.b64';
	fs.readFile(lib.baseDir+fileName, 'ut8', function(err, str){
		if (!err && str) {
			//decompress the data
			var inputBuffer = Buffer.from(str, 'base64');
			zlib.unzip(inputBuffer, function(err, outputBuffer){
				if (!err && outputBuffer) {
					//callback
					var str = outputBuffer.toString();
					cb(false, str);
				} else {
					cb(err);
				}
			});
		} else {
			cb(err);
		}
	});
};

//truncate log file (ie clear out the zipped data fro the log file)
lib.truncate = function(logId, cb){
	fs.truncate(lib.baseDir+logId+'.log',0, function(err){
		if (!err) {
			cb(false);
		} else {
			cb(err);
		}
	});
};
//export the module
module.exports = lib;