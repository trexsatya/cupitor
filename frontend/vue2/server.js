var express = require('express');
var app = express();


//const publicDir = express.static(__dirname + '/public')
//app.use('/images', express.static(__dirname + '/images'))

var allowCrossDomain = function(req, res, next) {
	res.header('Access-Control-Expose-Headers', 'Access-Control-Allow-Origin');
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, X-Auth, Access-Control-Request-Headers');

	if ('OPTIONS' == req.method) {
      res.send(200);
    }
    else {
      next();
    }
}

app.use(allowCrossDomain);
app.use(express.static('dist'))
//app.use('/app', express.static('app'))

var port = process.env.PORT || 80;

var paths = ['/', '/profile','/technology', '/technology/:subject', '/articles/:subject', '/article/:id', '/debates', '/tools/:name', '/notepad.html', '/play.html']
for(var i in paths){
	app.use(paths[i], express.static('index.html'))
}

app.listen(port, function() { console.log('listening on '+port)});