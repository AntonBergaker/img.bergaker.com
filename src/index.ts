import express = require('express');
import multer = require('multer');
import crypto = require('crypto');
import fs = require('fs');
import path = require('path');
import http = require('http');
import https = require('https');
import {Video} from "./video";

const app = express();

const imgDirectory = 'images/';
const vidDirectory = 'videos/';

const vidUrl = "https://vid.bergaker.com/"
const imgUrl = "https://img.bergaker.com/"

const secretKey = fs.readFileSync('secret.key', 'utf8');

let credentials = undefined;

if (fs.existsSync('/etc/letsencrypt/live/img.bergaker.com/privkey.pem')) {
	// Certificate
	const privateKey = fs.readFileSync('/etc/letsencrypt/live/img.bergaker.com/privkey.pem', 'utf8');
	const certificate = fs.readFileSync('/etc/letsencrypt/live/img.bergaker.com/cert.pem', 'utf8');
	const ca = fs.readFileSync('/etc/letsencrypt/live/img.bergaker.com/chain.pem', 'utf8');

	credentials = {
		key: privateKey,
		cert: certificate,
		ca: ca
	};
}


function chooseFilename(directory : string, extension : string) : string {
	let path;
	do {
		path = crypto.randomBytes(3).toString('base64').replace('/', '_').replace('+', '-') + extension;
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
	if (req.headers.authorization != secretKey) {
		res.sendStatus(403);
	} else {
		next();
	}
}

app.post('/upload_image',
	authorize,
	imgUpload.single('file_image'),
	(req, res) => {
		res.type('application/json').send( JSON.stringify({url: imgUrl + req.file.filename}));
	}
);
app.post('/upload_video',
	authorize,
	vidUpload.single('file_video'),
	async (req, res) => {
		const video = new Video();
		await video.import(vidDirectory + req.file.filename);
		res.type('application/json').send( JSON.stringify({url: vidUrl + path.basename(video.path)}));
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

		// If ext just serve the file
		if (hasExt) {
			if (fs.existsSync(fullPath) == false) {
				res.sendStatus(404);
				return;
			}

			const ext = path.extname(fullPath).replace('.', '');
			const contentType = ext == '.png' ? 'image' : 'video'

			res.contentType(contentType + '/' + path.extname(fullPath).replace('.', ''));
			res.end(fs.readFileSync(fullPath));
		}
		else {
			if (Video.exists(fullPath) == false) {
				res.sendStatus(404);
				return;
			}
			const video = new Video();
			video.fromFile(fullPath);

			res.render('video', {
				fileId: video.id,
				filePath: vidUrl + path.basename(video.videoPath),
				fileThumb: vidUrl + path.basename(video.thumbnailPath),
				fileWidth: video.width,
				fileHeight: video.height,
				fileDuration: video.duration,
				fileGif: vidUrl + video.id + ".gif",
				fileExt: path.extname(video.videoPath).replace('.', '')
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

httpServer.listen(80, () => {
	console.log('HTTP Server running on port 80');
});

if (credentials != undefined) {
	const httpsServer = https.createServer(credentials, app);
	httpsServer.listen(443, () => {
		console.log('HTTPS Server running on port 443');
	});

}
