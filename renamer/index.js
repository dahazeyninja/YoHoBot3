const config = require('../config.json');

const fs = require('fs').promises;
const path = require('path');

const TVDB = require('node-tvdb');
let tvdb = new TVDB(config.renamer.tvdb_key);

const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('database.db');

function refreshTVDB(){
	tvdb = new TVDB(config.renamer.tvdb_key);
	start();
}

function start(){
	db.all('SELECT * FROM `transcoded`;', (err, rows)=>{
		if(err) return console.error(err);

		setTimeout(()=>{
			start();
		}, 30000);

		if (rows.length === 0) return;
		
		filesLoop(rows, 0);
	})
}

async function filesLoop(files, i){
	if (!files[i]) return;

	const filename = files[i].filename;
	const ext = getExtension(filename);
	const HS_episode = filename.match(/-\s[0-9]{1,3}/g);
	const match = JSON.parse(files[i].match);
	let directory, season, ep_num, ep_name;

	if(match.directory){
		directory = match.directory;
	} else {
		directory = config.renamer.directory;
	}

	season = match.season;

	if(!season){
		season = 01;
	}

	if(HS_episode){
		let ep_string = HS_episode.toString().slice(2);
		ep_num = parseInt(ep_string);
	} else {
		return console.error('pls fix later')
	}

	if(match.offset){
		ep_num += match.offset;
	}

	const data = await getShow(match.tvdbId);
	// console.log(data);
	const show = data.seriesName.replace(/[\\\/\:\?\*\"\<\>\|]/g, '');

	data.episodes.forEach((episode)=>{
		if(episode.airedSeason == season && episode.airedEpisodeNumber == ep_num){
			ep_name = episode.episodeName.replace(/[\\\/\:\?\*\"\<\>\|]/g, '');
		}
	})

	if(!ep_name){
		ep_name = `Episode ${ep_num.toString().padStart(2,'0')}`;
	}

	const show_dir = `${show} [tvdb-${match.tvdbId}]`;
	const season_dir = `Season ${season.toString().padStart(2,'0')}`;
	const ep_filename = `${show} - S${season.toString().padStart(2,'0')}E${ep_num.toString().padStart(2,'0')} - ${ep_name}.${ext}`;
	const ep_sfilename = `${show} - S${season.toString().padStart(2,'0')}E${ep_num.toString().padStart(2,'0')}.${ext}`;
	const source = config.transcoder.directory + filename;
	let destination;
	destination = `${directory}${show_dir}/${season_dir}/${ep_filename}`;
	if (destination.length > 255){
		destination = `${directory}${show_dir}/${season_dir}/${ep_sfilename}`
	}
	
	//console.log(`Source: ${source}`)
	//console.log(`Destination: ${destination}`)

	// const start = Date.now()
	// console.log(start);

	fs.rename(source, destination)
		.then(()=> {
			console.log(`[Renamer] Renamed ${source} to ${destination}`);
			finishedRename(files, i);
		})
		.catch((err)=>{
			if(err.code !== 'ENOENT') return console.error(err);

			console.log(`[Renamer] Attempting to create directory ${directory}${show_dir}/${season_dir}`)
			fs.mkdir(`${directory}${show_dir}/${season_dir}`, {recursive:true})
				.then(()=>{
					console.log(`[Renamer] Successfully created ${directory}${show_dir}/${season_dir}`);
					fs.rename(source, destination)
						.then(()=>{
							console.log(`[Renamer] Renamed ${source} to ${destination}`);
							finishedRename(files, i);
						})
						.catch((err)=> console.error(err));
				})
				.catch((err)=>console.error(err));
		});
}

function finishedRename(files, i){
	db.run('DELETE FROM `transcoded` WHERE filename = ?;', files[i].filename, (err)=>{
		if(err) return console.error(err);

		filesLoop(files, i + 1);
	})
}

function getShow(id){
	return new Promise((resolve)=>{
		tvdb.getSeriesAllById(id)
			.then(response => resolve(response))
			.catch(error => console.error(error));
	})
	
}


function getExtension(filename) {
    const ext = path.extname(filename || '').split('.');


    return ext[ext.length - 1];
}

start();