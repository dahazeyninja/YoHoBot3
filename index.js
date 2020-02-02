require('./database');
setTimeout(()=>{
	require('./rss');
	require('./transcoder');
	require('./renamer');
}, 1000)
