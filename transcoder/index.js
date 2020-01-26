/* eslint-disable require-jsdoc */
const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('database.db');
const qbt = require('../qbit-api');
const ffmpeg = require('fluent-ffmpeg');
const config = require('../config.json');
var working = false;

function start(){
	if (working === true) return;
	if(config.transcoder){
		qbt.login(config.qbittorrent.url, config.qbittorrent.user, config.qbittorrent.pass).then(()=>{
			db.all('SELECT * FROM `hashes` ORDER BY `timestamp`', function(err, rows){
				if(err) return console.error(err);
                
				if(rows.length == 0){
					return setTimeout(()=>{
						start();
					}, 30000);
				}
                
				hashLoop(rows, 0);
			});
		});
	}
}

function hashLoop(rows, i){
	qbt.getTorrentProperties(rows[i].hash, function(data){
		if (data.completion_date > -1){
			working = true;
			getContents(rows[i], data);
		} else if (i < rows.length - 1){
			hashLoop(rows, i + 1);
		} else {
			console.log('[Transcoder] No Torrents ready for transcode');
			return setTimeout(()=>{
				start();
			},30000);
		}
	});
}

function getContents(row, data){
	qbt.getTorrentContents(row.hash, function(files){
		if(files.length === 1){
			transcode(row, data, files[0].name);
		} else {
			console.log('lul multiple file torrents not supported yet idiot');
		}
	});
}

// eslint-disable-next-line max-statements
function transcode(row, data, filename){
	const match = JSON.parse(row.match);
	const hash = row.hash;
	const sourcefile = match.savepath + '/' + filename;
	const escsourcefile = sourcefile.replace(':', '\\:');
	const command = ffmpeg(sourcefile);
	var timeout;

	// console.log(row);
	// console.log(data);
	// console.log(match);
	// console.log(filename);
	// console.log('------------------------------------------------------------------------------------');

	command
		.outputOptions([

			/* '-map 0',*/
			'-c:v libx264',
			'-preset ultrafast',
			'-crf 18',
			'-tune animation',
			'-movflags +faststart',
			'-profile:v high',
			'-pix_fmt yuv420p',
			'-level 4.1',
			'-threads 0',
			'-c:a copy',
			'-strict',
			'-2'])

		.videoFilters([
			{
				filter: 'subtitles',
				options: '\'' + escsourcefile + '\''
			}
		])

		.on('start', function(commandLine){
			console.log('[Transcoder] Spawned Ffmpeg with command: ' + commandLine);
		})
		.on('progress', function(progress) {
			const percent = progress.percent.toString();

			if (!timeout){
				console.log('[Transcoder] Processing: ' + percent.slice(0, 4) + '% done; ' + progress.currentFps + ' FPS; ' + progress.currentKbps + ' kBps; ' + progress.targetSize + ' kB written');
				timeout = true;
				setTimeout(function(){
					timeout = false;
				}, 5000);
			}

		})
		.on('error', function(err, stdout, stderr) {
			console.log('[Transcoder] Cannot process video: ' + err.message + '\n' + stdout + '\n' + stderr);
			console.error(err);
		})
		.on('end', function(stdout, stderr) {
			console.log('[Transcoder] Transcoding succeeded!');
			db.run('DELETE FROM `hashes` WHERE `hash` = ?', [hash], function(err){
				if (err){
					console.log(err);
				}
			});
			working = false;
			start();
		})

		.save('N://node/YohoBot2/test/' + filename + '.mp4');

}

start();
