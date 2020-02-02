/* eslint-disable require-jsdoc */
const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('database.db');
const qbt = require('../qbit-api');
const ffmpeg = require('fluent-ffmpeg');
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
	qbt.getTorrentProperties(rows[i].hash, function(data){
		if (data.completion_date > -1){
			working = true;
			getContents(rows[i], data);
		} else if (i < rows.length - 1){
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
function transcode(row, data, filename){
	const match = JSON.parse(row.match);
	const new_filename = filename.slice(0,-4) + '.mp4';
	const hash = row.hash;
	const sourcefile = match.savepath + filename;
	const escsourcefile = sourcefile.replace(':', '\\:');
	const command = ffmpeg(sourcefile);
	var timeout;

	for(let i = 0; i < match.tcp.filters.length; i++){
		if(match.tcp.filters[i].filter === 'subtitles' && match.tcp.filters[i].options === 'source'){
			match.tcp.filters[i].options = '\'' + escsourcefile + '\''
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
			if(err.includes('Failed to inject frame into filter network: No such file or directory')){
				console.log('spaces smh');
			}
		})
		.on('end', function(stdout, stderr) {
			console.log('[Transcoder] Transcoding succeeded!');
			db.run('DELETE FROM `hashes` WHERE `hash` = ?', [hash], function(err){
				if (err){
					console.error(err);
				}
				working = false;
				start();
			});
			db.run('INSERT INTO `transcoded` (filename, match) VALUES (?,?);', [new_filename, JSON.stringify(match)],(err)=>{
				if(err) return console.error(err);
			})
		})

		.save(config.transcoder.directory + new_filename);

}

start();
