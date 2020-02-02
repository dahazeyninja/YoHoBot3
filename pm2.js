require('./database');
const pm2 = require('pm2');
let i = 0;

const apps = [
	{
		"name"      : "RSS",
		"script"    : "./rss/index.js",
		"exec_mode" : "fork",
		"instances" : 1,
		"watch"     : false,
		"max_memory_restart": "500M",
		"env" : {
			"NODE_ENV" : "development"
		},
		"env_production" : {
			"NODE_ENV" : "production"
		}
	},
	{
		"name"      : "Transcoder",
		"script"    : "./transcoder/index.js",
		"exec_mode" : "fork",
		"instances" : 1,
		"watch"     : false,
		"max_memory_restart": "500M",
		"env" : {
			"NODE_ENV" : "development"
		},
		"env_production" : {
			"NODE_ENV" : "production"
		}
	},
	{
		"name"      : "Renamer",
		"script"    : "./renamer/index.js",
		"exec_mode" : "fork",
		"instances" : 1,
		"watch"     : false,
		"max_memory_restart": "500M",
		"env" : {
			"NODE_ENV" : "development"
		},
		"env_production" : {
			"NODE_ENV" : "production"
		}
	}
]

function startApp(appData){
    pm2.connect(function(){
        pm2.start(appData, function(err){
            if (err) {
                return console.error('Error while launching ' + appData.name, err.stack || err);
            } else {
                console.log(appData.name + ' has been succesfully started by PM2');
            }
        });
    });
}

setInterval(()=>{
	if(i === apps.length) return process.exit();
	startApp(apps[i]);
	i++;
}, 1000)