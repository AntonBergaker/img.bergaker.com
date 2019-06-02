import express = require('express');
import multer = require('multer');
import crypto = require('crypto');
import fs = require('fs');
import path = require('path');
import http = require('http');
import https = require('https');

const app = express();

const imgDirectory = 'images/';
const vidDirectory = 'videos/';

// Certificate
const privateKey = fs.readFileSync('/etc/letsencrypt/live/img.bergaker.com/privkey.pem', 'utf8');
const certificate = fs.readFileSync('/etc/letsencrypt/live/img.bergaker.com/cert.pem', 'utf8');
const ca = fs.readFileSync('/etc/letsencrypt/live/img.bergaker.com/chain.pem', 'utf8');

const credentials = {
	key: privateKey,
	cert: certificate,
	ca: ca
};


function chooseFilename(directory : string, extension : string) : string {
	let path;
	do {
		path = crypto.randomBytes(3).toString('base64') + extension;
	} while(fs.existsSync(directory + path))
	return path;
}

const imgStorage = multer.diskStorage( {
	destination: function(req, file, cb) {
		cb(null, imgDirectory);
	},
	filename: function (req, file, cb) {
		cb(null, chooseFilename(imgDirectory, path.extname(file.originalname)))
	}
})
const vidStorage = multer.diskStorage( {
	destination: function(req, file, cb) {
		cb(null, vidDirectory);
	},
	filename: function (req, file, cb) {
		cb(null, chooseFilename(vidDirectory, path.extname(file.originalname)))
	}
})


const imgUpload = multer({storage: imgStorage})
const vidUpload = multer({storage: vidStorage})

app.set('view engine', 'pug');

function authorize(req: express.Request, res: express.Response, next: express.NextFunction) {
	if (req.headers.Authorization == "notasecret") {
		res.sendStatus(403);
	} else {
		next();
	}
}

app.post('/upload_image',
	authorize,
	imgUpload.single('file_image'),
	(req, res) => {
		res.type('application/json').send( JSON.stringify({url: "https://img.bergaker.com/" + req.file.filename}));
	}
);
app.post('/upload_video',
	authorize,
	vidUpload.single('file_video'),
	(req, res) => {
		res.type('application/json').send( JSON.stringify({url: "https://vid.bergaker.com/" + path.basename(req.file.filename, path.extname(req.file.filename))}));
	}
);

app.get('*', (req, res) => {
	if (req.path.length < 4) {
		res.sendStatus(404);
		return;
	}

	if ((req.subdomains.length > 0 && req.subdomains[0] == "vid") || req.query.video == "1") {
		const fileId = req.path.replace('/', '');
		const fullPath = vidDirectory + fileId;
		const hasExt = path.extname(fullPath) != "";
		const filePath = hasExt ? fullPath : fullPath + ".mp4";

		if (fs.existsSync(filePath) == false) {
			res.sendStatus(404);
			return;
		}

		// With extension, serve the file itself
		if (hasExt) {
			res.contentType('video/' + path.extname(filePath).replace('.', ''));
			res.end(fs.readFileSync(filePath));
		}
		// If no extension, serve a website to view it
		else {
			const query = (req.query.video == "1") ? "?video=1" : ""
			res.render("video", {
				fileId: fileId,
				filePath: fileId + ".mp4" + query,
				fileExt: "mp4"
			})

		}


	} else {
		// look for the file
		const fullPath = imgDirectory + req.path.replace('/', '');
		if (fs.existsSync(fullPath) == false) {
			res.sendStatus(404);
			return;
		}

		res.contentType('image/' + path.extname(fullPath).replace('.', ''));
		res.end(fs.readFileSync(fullPath));
	}


});

// Starting both http & https servers
const httpServer = http.createServer(app);
const httpsServer = https.createServer(credentials, app);

httpServer.listen(80, () => {
	console.log('HTTP Server running on port 80');
});

httpsServer.listen(443, () => {
	console.log('HTTPS Server running on port 443');
});
