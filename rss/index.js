/* eslint-disable require-jsdoc */
const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('database.db');
const qbt = require('../qbit-api');
const config = require('../config.json');
const request = require('request');
const FeedParser = require('feedparser');
const parseTorrent = require('parse-torrent');
var downloaded = [];

function start(){
	if(config.rss){
		qbt.login(config.qbittorrent.url, config.qbittorrent.user, config.qbittorrent.pass).then(()=>{
			db.all('SELECT * FROM `rss`', (err, rows) => {
				if (err) return console.error(err);
		
				rows.forEach((row)=>{
					downloaded.push(row.link);
				});
		
				getNextFeed(0);
			});
		});

		setTimeout(()=>{
			start();
		}, 300000);
	}
}


function getNextFeed(fi){

	if (fi < config.feeds.length){
		getFeed(config.feeds[fi]);
		setTimeout(() => {
			getNextFeed(fi + 1);
		}, 3000);
	}
}

function getFeed(feed){
	var req = request(feed.url);
	var feedparser = new FeedParser();

	req.on('error', function (error){
		console.error(feed.url, error);
	});

	req.on('response', function(res){
		// `this` is `req`, which is a stream
		var stream = this;

		if(res.statusCode !== 200){
			this.emit('error', new Error('Bad status code'));
		} else {
			stream.pipe(feedparser);
		}
	});

	feedparser.on('error', function(error){
		console.error(error);
	});

	feedparser.on('readable', function(){
		// This is where the action is!
		// `this` is `feedparser`, which is a stream
		var stream = this;
		var item;

		while (item = stream.read()){
			matchItem(item, feed);
		}
	});
}

function matchItem(item, feed){
	const {title} = item;
	const {link} = item;

	// eslint-disable-next-line max-statements
	feed.matches.forEach(function(match){
		let valid = true;


		for (let i = 0; i < match.keywords.length; i++){
			if(!title.includes(match.keywords[i])){
				valid = false;
			}
		}

		if (valid && downloaded.indexOf(link) == -1){
			console.log('[RSS] Matched: ' + title);
			sortLink(match, title, link);
		}
	});
}

function sortLink(match, title, link){
	if(link.includes('magnet:?')){
		parsTorrent(match, link, title);
	} else if (link.includes('.torrent')){
		parsRemoteTorrent(match, link, title);
	} else {
		console.log('Unknown link download type');
	}
}

function parsTorrent(match, link, title){
	const data = parseTorrent(link);

	addTorrentLink(match, link, title, data.infoHash);
}

function parsRemoteTorrent(match, link, title){
	parseTorrent.remote(link, (err, data) => {
		if (err){
			console.error(link, title, err);
		} else {
			addTorrentLink(match, link, title, data.infoHash);
		}
	});
}

// eslint-disable-next-line max-statements
function addTorrentLink(match, link, title, hash){
	var options = {
		urls: link
	};

	// console.log(match);
	// console.log(typeof match.paused);

	if (typeof match.paused === 'undefined'){
		options.paused = config.qbittorrent.paused;
	} else {
		options.paused = match.paused;
	}

	if (match.savepath){
		options.savepath = match.savepath;
	} else {
		options.savepath = config.qbittorrent.savepath;
	}

	if (match.category){
		options.category = match.category;
	} else {
		options.category = config.qbittorrent.category;
	}

	// console.log(options);

	qbt.addTorrent(options, function(res){
		// console.log(res, hash);
		setTimeout(() => {
			checkTorrent(match, link, title, hash);
		}, 5000);

	});
}

function checkTorrent(match, link, title, hash){
	const matchstring = JSON.stringify(match);
	let complete = false;

	qbt.getTorrentList(null, function(list){
		list.forEach((torrent) => {
			if (torrent.hash === hash){
				complete = true;
				console.log('[RSS] Added ' + title + ' to qBittorrent');

				torrentAdded(link, hash, matchstring);
			}
		});
	});

	setTimeout(() => {
		if (complete === false){
			addTorrentLink(match, link, title, hash);
			console.log('[RSS] Failed to add ' + title + ' to qBittorrent. Retrying...');
		}
	}, 1000);
}

function torrentAdded(link, hash, matchstring) {
	downloaded.push(link);
	db.run('INSERT INTO `rss` (link) VALUES (?);', [link], function (err) {
		if (err) {
			console.log(err);
		}
	});
	db.run('INSERT INTO `hashes` (hash, match) VALUES (?, ?);', [hash, matchstring], function (err) {
		if (err) {
			console.log(err);
		}
	});
}

start();