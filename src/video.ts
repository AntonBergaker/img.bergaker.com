import fs = require('fs');
import ffmpeg = require('fluent-ffmpeg');
import path = require('path');
import { rejects } from 'assert';

export class Video {
	public id = "";
	public videoPath = "";
	public path = "";
	public thumbnailPath = "";
	public width = 0;
	public height = 0;
	public duration = 0;



	public async import(videoPath: string) {
		this.id = path.basename(videoPath, path.extname(videoPath));
		this.path = path.dirname(videoPath) + "/" + this.id
		this.videoPath = videoPath;
		this.thumbnailPath = this.path + "_thumb.png";

		const metadata = await Video.getMetadata(videoPath);
		this.width = metadata["streams"][0]["width"];
		this.height = metadata["streams"][0]["height"];
		this.duration = metadata["format"]["duration"];

		ffmpeg(videoPath).screenshot({
			timestamps: [0],
			filename: this.thumbnailPath
		})

		this.save();
	}

	public fromFile(path: string) {
		const json = JSON.parse(fs.readFileSync(path + ".meta", "utf8"));
		this.id = json.id;
		this.videoPath = json.video;
		this.path = path;
		this.thumbnailPath = json.thumbnail;
		this.width = json.width;
		this.height = json.height;
		this.duration = json.duration;
	}

	public static exists(path: string) : boolean {
		return fs.existsSync(path + ".meta");
	}

	private save() {
		fs.writeFileSync(this.path + ".meta", JSON.stringify(
			{
				id: this.id,
				video: this.videoPath,
				thumbnail: this.thumbnailPath,
				width: this.width,
				height: this.height,
				duration: this.duration
			}
		));
	}

	private static getMetadata(videoPath : string) : Promise<ffmpeg.FfprobeData> {
		const promise = new Promise<ffmpeg.FfprobeData>( (resolve, reject) => {
			ffmpeg.ffprobe(videoPath, (err, metadata) => {
				if (err) {
					reject();
				}
				resolve(metadata);
			});
		}
		);

		return promise;
	}
}
