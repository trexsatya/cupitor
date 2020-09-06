const request = require('request');
const express = require('express');
const app = express();

app.get('/', (req, res) => {
    res.send('An alligator approaches!');
});

//app.listen(3000, () => console.log('Gator app listening on port 3000!'));

export default function(req, resMain, next) {
  const searchParams = new URLSearchParams(req._parsedUrl.query)
  const name = searchParams.get('url')


  if (typeof name === 'string' && name.length) {
    resMain.setHeader('Content-type', 'application/json')

    request(name, { json: false }, (err, res, body) => {
	  if (err) { 
	  	return console.log(err); 
	  	res.statusCode = 500
    	res.end()
	  }

	  console.log(body.url);
	  console.log(body.explanation);

	  const result = {
	      rawText: body,//whole html page
	      parsedText: ""
	  }
	  resMain.statusCode = 200
	  resMain.end(JSON.stringify(result));

	}); //end request

  } else {
    resMain.statusCode = 500
    resMain.end()
  }

}

async function fetchPage(url){

}