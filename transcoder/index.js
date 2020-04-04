/* eslint-disable require-jsdoc */
const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('database.db');
const qbt = require('../qbit-api');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs').promises;
const config = require('../config.json');
var working = false;

function start(){
	if (working === true) return;
	if(config.transcoder.enabled){
		qbt.login(config.rss.qbittorrent.url, config.rss.qbittorrent.user, config.rss.qbittorrent.pass).then(()=>{
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
	qbt.getTorrentProperties(rows[i].hash, async function(err, data){
		if(err && err.status == 404){
			await removeHashEntry(rows[i].hash)
				.catch(err=>console.error(err));
		} else if (err) return console.error(err);

		if (data && data.completion_date > -1){
			working = true;
			return getContents(rows[i], data);
		}
		
		if (i < rows.length - 1){
			hashLoop(rows, i + 1);
		} else {
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
async function transcode(row, data, filename){
	const match = JSON.parse(row.match);
	const new_filename = filename.slice(0,-4) + '.mp4';
	const hash = row.hash;
	const ogsourcefile = match.savepath + filename;
	// const newsourcefilename = filename.replace(/\s/g, '_');
	const newsourcefile = match.savepath + 'target.mkv';
	await fs.rename(ogsourcefile, newsourcefile);
	const escsourcefile = newsourcefile.replace(/\\/g, '/').replace(':', '\\:');
	const command = ffmpeg(newsourcefile);
	var timeout;

	for(let i = 0; i < match.tcp.filters.length; i++){
		if(match.tcp.filters[i].filter === 'subtitles' && match.tcp.filters[i].options === 'source'){
			match.tcp.filters[i].options = '\'' + escsourcefile + '\'';
		}
	}

	command
		.outputOptions(match.tcp.options)

		.videoFilters(match.tcp.filters)

		.on('start', function(commandLine){
			console.log('[Transcoder] Spawned Ffmpeg with command: ' + commandLine);
		})
		.on('progress', function(progress) {

			if (!timeout){
				console.log('[Transcoder] Processing: ' + progress.currentFps + ' FPS; ' + progress.currentKbps + ' kBps; ' + progress.targetSize + ' kB written; Timestamp: ' + progress.timemark + ' ');
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
		.on('end', function() {
			console.log('[Transcoder] Transcoding succeeded!');
			fs.rename(newsourcefile, ogsourcefile);
			db.run('DELETE FROM `hashes` WHERE `hash` = ?', [hash], function(err){
				if (err){
					console.error(err);
				}
				working = false;
				start();
			});
			db.run('INSERT INTO `transcoded` (filename, match) VALUES (?,?);', [new_filename, JSON.stringify(match)],(err)=>{
				if(err) return console.error(err);
			});
		})

		.save(config.transcoder.directory + new_filename);

}

function removeHashEntry(hash){
	return new Promise((resolve, reject)=>{
		db.run('DELETE FROM `hashes` WHERE hash = ?;', hash, (err)=>{
			if(err) return reject(err);

			resolve();
		});
	});
}

start();
