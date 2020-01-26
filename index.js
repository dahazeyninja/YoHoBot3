require('./database');
setTimeout(()=>{
	require('./rss');
	require('./transcoder');
}, 1000)
