var http = require('http'),
	app = require('./route'),
	crypto = require('crypto'),
	fs = require('fs'),
	mongoose = require('mongoose');
		
mongoose.createConnection('localhost', 'test');

var formDigest = function(username, password) {
	var sha256 = crypto.createHash("sha256");
	sha256.update(username+"ioquewrn"+password+"iqenfklc", "utf-8");
	return sha256.digest("base64").match(/[a-zA-Z0-9]+/g).join('');
};

var auth = function(token, username, password) {
	return formDigest(username, password) == token;
};

var divideUrl = function(url) {
	return url.substr(1).split(/\/|\?/);
};

var setupUserFolder = function(username, cb) {
	fs.stat(__dirname + '/' + username, function(err, stats) {
		if( err ) {
			fs.mkdir(__dirname + '/' + username, cb);
		} else {
			cb();
		}
	});
};

var trip = mongoose.Schema({
	distance: Number,
	id: Number,
	location: String,
	Names: String,
	Purpose: String,
	username: String
});
var Trip = mongoose.model('Trip', trip);

var user = mongoose.Schema({
	username: String,
	password: String,
	email: String
});
var User = mongoose.model('MileageUser', user);

var users = [{
	username: "matt",
	password: "drowssap"
}];
var trips = {
	matt: []/*[{
	        distance: 0,
	        id : 403118680,
	        location : "",
	        names : "",
	        purpose : "",
	    },
	        {
	        distance : 0,
	        id : 822328688,
	        location : "",
	        names : "",
	        purpose : "",
	    },
	        {
	        distance : 0,
	        id : 403118680,
	        location : "",
	        names : "",
	        purpose : "",
	    },
	        {
	        distance : "2446.486083984375",
	        id : 403118680,
	        location : "",
	        names : "",
	        purpose : "",
	    },
	        {
	        distance : "6288.80615234375",
	        id : 822328688,
	        location : "",
	        names : "",
	        purpose : "",
	    },
	        {
	        distance : 0,
	        id : 403118680,
	        location : "Work",
	        names : "Matt Neary",
	        purchase : "2 Coffees",
	        purpose : "App Meeting",
	    }]*/
};

var userPresent = function(username, cb) {
	/*
	var matches;
	return (matches = users.filter(function(elm) {
		return elm.username == username;
	})).length > 0 ? matches[0] : false;
	*/
	User.findOne({username:username}, function(err, docs) {
		cb(docs);
	});
};

var getTrips = function(username, cb) {
	//cb(trips[username]);
	Trip.find({ username: username }, function(err, docs) {
		if( !err ) cb(docs);
		else { cb([]); }
	});
};
var insertTrip = function(username, info) {
	//trips[username].push(trip);
	trip.username = username;	
	var trip = new Trip(info);
	trip.save();
};
var insertUser = function(info) {
	//trips[username].push(trip);
	var user = new User(info);
	user.save();
};

app.get({
	path: /^/,
	cb: function(req, res) {
		res.end("Please refer to API docs.");
	}
}).get({
	path: /^\/admin\/dump/,
	cb: function(req, res) {
		User.find({}, function(err, users) {
			Trip.find({}, function(err, trips) {
				res.end(JSON.stringify({
					users: users,
					trips: trips
				}));
			});	
		});
	}
}).post({
	path: /^\/api\/login/,
	cb: function(req, res) {
		var buffer = [];
		req.on("data", function(chunk){buffer.push(chunk)});
		req.on("end", function() {
			var data = JSON.parse(buffer.join(""));
			userPresent(data.username, function(match) {
				var success = match && match.password == data.password;
				res.end(JSON.stringify({ 
					success: !!success, 
					error: success?null:"Auth Failed.", 
					token: success?formDigest(data.username, data.password):null 
				})+'\n');
			});			
		});
	}
}).post({
	path: /^\/api\/register/,
	cb: function(req, res) {
		var buffer = [];
		req.on("data", function(chunk){buffer.push(chunk)});
		req.on("end", function() {
			var data = JSON.parse(buffer.join(""));
			userPresent(data.username, function(match) {
				if( match ) {
					res.end(JSON.stringify({ 
						success: false, 
						error: "Username taken.", 
						token: null
					})+'\n');
				} else {
					insertUser({
						username: data.username,
						password: data.password,
						email: data.email
					});
					res.end(JSON.stringify({ 
						success: true, 
						error: null, 
						token: formDigest(data.username, data.password) 
					})+'\n');
				}
			});			
		});
	}
}).get({
	path: /^\/api\/trips\/[^\/]+/,
	cb: function(req, res) {
		var parts, username, token;
		try {
			parts = divideUrl(req.url);
			username = parts[2];
			// TODO: actual parameter parsing
			token = req.url.split('?')[1].split('=')[1];
		} catch(err) {
			res.end(JSON.stringify({
				success: false, 
				error: "A parse error occurred." 
			}) + '\n');
		}

		var user;
		userPresent(username, function(present) {
			if( !(user = present) ) {
				// Reject invalid usernames.
				res.end(JSON.stringify({
					success: false, 
					error: "User does not exist." 
				}) + '\n');
				return;
			}
			
			if( !auth(token, user.username, user.password) ) {
				// Reject invalid tokens.
				res.end(JSON.stringify({
					success: false, 
					error: "Token invalid." 
				}) + '\n');
				return;
			}
			
			getTrips(user.username, function(trips) {
				res.end(JSON.stringify({
					success: !!trips.length,
					error: trips.length?null:"No trips available.",
					trips: trips
				}) + '\n');
			});
		});		
	}
}).post({
	path: /\/api\/trip\/[^\/]+/,
	cb: function(req, res) {
		var parts, username, token;
		try {
			parts = divideUrl(req.url);
			username = parts[2];
			// TODO: actual parameter parsing
			token = req.url.split('?')[1].split('=')[1];
		} catch(err) {
			res.end(JSON.stringify({
				success: false, 
				error: "A parse error occurred." 
			}) + '\n');
		}

		var buffer = [];
		req.on("data", function(chunk){buffer.push(chunk)});
		req.on("end", function() {
			var data = JSON.parse(buffer.join(""));
			
			var user;
			userPresent(username, function(present) {
				if( !(user = present) ) {
					// Reject invalid usernames.
					res.end(JSON.stringify({
						success: false, 
						error: "User does not exist." 
					}) + '\n');
					return;
				}
				
				if( !auth(token, user.username, user.password) ) {
					// Reject invalid tokens.
					res.end(JSON.stringify({
						success: false, 
						error: "Token invalid." 
					}) + '\n');
					return;
				}
				
				insertTrip(user.username, data);
				res.end(JSON.stringify({ 
					success: true, 
					error: null 
				}) + '\n');
			});									
		});
	}
}).post({
	path: /\/api\/asset\/[^\/]+/,
	cb: function(req, res) {
		var username = req.url.substr(1).split('/')[2].split('?')[0];
		var writeUpload = function(id_str, data) {
			setupUserFolder(username, function() {
				fs.writeFile(__dirname+'/'+username+'/'+id_str+'.jpg', data, function(err) {
					res.end(JSON.stringify({ success: !err, error: err }) + '\n');
				});
			});
		};		
		var buffer = [];
		var boundary = req.headers['content-type'].split('=')[1];
		req.on("data", function(chunk) {
			buffer.push(chunk);
		});
		req.on("end", function() {
			var id_str = buffer.join("").match(/^Content-Disposition: form-data;[^\n]+\r\n\r\n([^\r]+)\r\n/m)[1];
			var data = buffer.join("").split(boundary)[2].split('\r\n\r\n').slice(1).join('\r\n\r\n').replace(/\r\n--$/,'');
			if( !id_str || !data ) {
				res.end(JSON.stringify({ success: false, error: "id or data not provided." }) + '\n');
				return;
			}
			writeUpload(id_str, data);
		});		
	}
}).get({
	path: /\/api\/asset\/[^\/]+\/[^\/]+/,
	cb: function(req, res) {
		var parts, username, id_str;
		try {
			parts = divideUrl(req.url);
			username = parts[2];
			id_str = parts[3];
		} catch(err) {
			res.end(JSON.stringify({
				success: false, 
				error: "A parse error occurred." 
			}) + '\n');
		}
		
		fs.stat([__dirname, username, id_str+'.jpg'].join('/'), function(err) {
			if( err ) {
				res.writeHead(404);
				res.end(JSON.stringify({
					success: false, 
					error: "Asset is not present." 
				}) + '\n');
			} else {
				res.writeHead(200, { 'Content-Type': 'image/jpeg' });
				fs.createReadStream([__dirname, username, id_str+'.jpg'].join('/')).pipe(res);
			}
		});
	}
});

exports.module = http.createServer(app);