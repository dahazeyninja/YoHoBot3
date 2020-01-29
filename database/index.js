const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('database.db');

db.serialize(function(){
	db.run('CREATE TABLE IF NOT EXISTS `rss` (`link` TEXT, PRIMARY KEY (`link`));', (err) => {
		if (err) return console.error(err);

		console.log('[Database] RSS Link Database Ready!');
	});

	db.run('CREATE TABLE IF NOT EXISTS `hashes` (`hash` TEXT, `match` TEXT, `timestamp` DATETIME DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (`hash`));', (err) => {
		if (err) return console.error(err);

		console.log('[Database] Hash Database Ready!');
	});

	db.run('CREATE TABLE IF NOT EXISTS `transcoded` (`filename` TEXT, `match` TEXT);', (err)=>{
		if(err) return console.error(err);

		console.log('[Database] Renamer Database Ready!');
	})
});

db.close();