var LIVE = false; // if false only 2 active breathers required
var TRANSMEDIALE = false; // true = breathing starts breathfake clients
var PRAHA = true; // also enable TRANSMEDIALE since this a revision of that
var MULTISCRIPT = true; // allows editor to choose which script file is master atm

// TODO: test sockets with a bunch of clients
//       optimize? http://buildnewgames.com/optimizing-websockets-bandwidth/
var DEBUG = !LIVE;
var DEBUG_BREATH_AUDIO = false;
var passcode = require('./passcode.js'); 
//"AusADUTNAOW" : "testing"; // poor mans passcode
//var passcode = "AusADUTNAOW";// : "testin"; // poor mans passcode

// BUGBUG: self sync not wosafarirking exactly as expected. something to do with client thresholds
var breathing_self_sync  = true; // when false breath sequence end only when master says so

var fs = require('fs');

var script_download_url = "https://pad.riseup.net/p/fanboy/export/txt";
var script_file         = './client/script_applestore.txt'
if (TRANSMEDIALE)
    script_file = './client/script_transmediale.txt'
if (PRAHA)
    script_file = './client/script_praha.txt' // PRAHA version
if (MULTISCRIPT) {
    script_file = 'client/script_current.txt'
    script_file_target = 'client/'+fs.readlinkSync(script_file);
}
var express     = require('express');
var serve_index = require('serve-index');
var app         = express();
var server      = require('http').createServer(app);
var io          = require('socket.io').listen(server);
var util        = require('util');
var path        = require('path');

var app_port = process.env.app_port || 8080;
var app_host = process.env.app_host || '0.0.0.0';

var state  = {
    time:  0,
    slide: 0
};
var breathing_completed = false;

server.listen(app_port);

var enabled = true; // just lets master turn it off just before show
app.get('/enable/'+passcode, function (req, res) {
    console.log('enabled');
    enabled = true;
    res.send('OK');
});
app.get('/disable/'+passcode, function (req, res) {
    console.log('enabled');
    enabled = false;
    res.send('OK');
});
if (enabled) {
    app.get('/', function (req, res) {
        res.sendFile(__dirname + '/client/slavemasterslave.html');
    });
    // transmediale
    // the parameters are not actually used here but instead...
    // path is parsed in client and device_id is echoed back to server
    app.get('/device/:device_id/start/:start_at', function (req, res) {
        res.sendFile(__dirname + '/client/slavemasterslave.html');
    });
    // praha
    app.get('/master', function (req, res) {
        res.sendFile(__dirname + '/client/master.html');
    });
    app.get('/read', function (req, res) {
        res.sendFile(__dirname + '/client/script_praha_text.txt');
    });
}
else {
    app.get('/', function (req, res) {
        res.sendFile(__dirname + '/client/slavemasterslave_disabled.html');
    });
}
// app.get('/5.5.5.1', function (req, res) {
//     res.sendFile(__dirname + '/client/slavemasterslave.html');
// });
app.get('/check', function (req, res) {
    res.send('OK');
});
app.get('/reset/'+passcode, function (req, res) {
    console.log('reset state');
    res.send('OK');
    state  = {
        time:  0,
        slide: 0
    };
    breathing_completed = false;
});
app.use('/client', express.static(__dirname + '/client'));
app.use('/client/files', serve_index(__dirname + '/client/files'));
app.use('/client/scripts', serve_index(__dirname+'/client/scripts'));

var walkSync = function(dir, filelist) {
  var fs = fs || require('fs'),
      files = fs.readdirSync(dir);
  filelist = filelist || [];
  files.forEach(function(file) {
    if (fs.statSync(dir +'/'+ file).isDirectory()) {
      filelist = walkSync(dir + '/'+ file + '/', filelist);
    }
    else {
      filelist.push(file);
    }
  });
  return filelist;
};
app.get(['/editor','/editor/:script_file'], function (req, res) {
    console.log('editor get params',req.params);
    var media    = walkSync(__dirname+ '/client/files').map(f=>'/client/files/'+f);
    var scripts  = walkSync(__dirname +'/client/scripts').map(f=>'/client/scripts/'+f);
    var allfiles = media.concat(scripts);

    var script = "";
    var selected_script = ""
    if (req.params.hasOwnProperty('script_file') && req.params.script_file) {
        var param_script_path = '/client/scripts/'+req.params.script_file
        if (scripts.indexOf(param_script_path)<0) {
            res.send("invalid script file chosen: "+param_script_path)
            return;
        }
        else {
            script = fs.readFileSync(__dirname + param_script_path);
            selected_script = param_script_path;
        }
    }
    else {
        // no specific script selected so we are using the global
        // default symlink file
        script = fs.readFileSync(__dirname +'/'+ script_file);//global link
        selected_script = '/'+script_file_target;
    }

    var uihtml = fs.readFileSync(__dirname + '/client/editor.html');
    if(uihtml) {

        // ui allows deletion of media files and scripts
        var filelisthtml = allfiles;
        filelisthtml.forEach(function(v,i,r){
            r[i] = '<option value="'+v+'">'+ v+'</option>'
        }  )
        filelisthtml = '<select name=files size='+(filelisthtml.length+1)+' multiple><option value="" selected>&nbsp;</option>'+filelisthtml+'</select>';

        var scriptlisthtml = scripts;
        scriptlisthtml.forEach(function(v,i,r){
            var isdefault = "";
            var isselected  = "";
            if (v === '/'+script_file_target) 
                var isdefault = " (default)";
            if (v === selected_script) 
                var isselected = " selected";
            r[i] = '<option value="'+v+'"'+isselected+'>'+v+isdefault+'</option>'
        }  )
        scriptlisthtml = '<select name=files size=1><option value="" selected>&nbsp;</option>'+scriptlisthtml+'</select>';

        res.send(
            // template:
            uihtml.toString()
                .replace('!!FILELISTHTML!!',filelisthtml)
                .replace('!!SCRIPT!!',script.toString().replace(/&/g,'&amp;'))
                .replace('!!SCRIPTLISTHTML!!',scriptlisthtml)
            );
    }
});
//
// ugly captive portal
//
// How android needs it in order to be happy
//   Sends 2 or more requests to generate domains and should get back redirects first to get the login page, but then 204s after to get connected
//  https://twitter.com/nathanafain/status/1304015296118874114
//   
// wifi clients timestamp when last pressed ok
// if we get 204 request and it has been more than 30 seconds, give a 302 again, else 204
var wifis = {//ip: timestamp
}
app.get(['/generate_204','/gen_204'], function (req, res) {
    console.log('generate_204',wifis);
    // don't for get in nginx proxy definition: proxy_set_header X-Forwarded-For $remote_addr;
    var clientip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    var now = (new Date()).getTime()/1000;
    if (wifis.hasOwnProperty(clientip) && now < wifis[clientip]+30 ) {
        res.status(204).send({});
    }
    else {
        // user has to click ok
        // res.end('<html><form action=/captiveportalok><input type=submit></form></html>')
        // don't ask, just go:
        res.redirect('http://l.ptxx.cc/captiveportalok/'+clientip)
    }
    //res.end('<html><head><meta http-equiv="refresh" content="0;url=/captiveportal204"></head><body>Success</body></html>');    
    // if (okpressed)
    //     return res.status(204).send({});
    // res.redirect('http://l.ptxx.cc/captiveportalok')
});
app.get('/captiveportalask', function (req, res) {
    console.log('captiveportalask')
    res.end('<html><form action=/captiveportalok><input type=submit></form></html>')
});
app.get(['/captiveportalok','/captiveportalok/:ip'], function (req, res) {
    var clientip = req.headers['x-forwarded-for'] || req.params.ip || req.connection.remoteAddress;
    console.log('captiveportalok',clientip);
    wifis[clientip] = (new Date()).getTime()/1000;
    res.end('<html><head><meta http-equiv="refresh" content="0;url=/captiveportal204"></head><body>Success</body></html>');
    //res.status(204).send({});
});
app.get('/captiveportal204', function (req, res) {
    console.log('captiveportal204')
    res.status(204).send();
});
// handle microsoft
// handle apple.com and older www.apple.com
//   www.apple.com /library/test/success.html 192.168.22.82
//   10.0.0.1 - - [13/Sep/2020 13:43:52] "GET /library/test/success.html HTTP/1.0" 200 -
app.get(['/success.html','/library/test/success.html'], function (req, res) {
    console.log('captiveportal success.html apple.com captive.apple.com www.apple.com')
    res.end('<HTML><HEAD><TITLE>Success</TITLE></HEAD><BODY>Success</BODY></HTML>');
});
// detectportal.firefox.com
app.get('/success.txt', function (req, res) {
    console.log('captiveportal success.txt detectportal.firefox.com')
    res.end('success');
});
app.get('/ncsi.txt', function (req, res) {
    console.log('captiveportal ncsi.txt microsoft')
    res.end('Microsoft NCSI');
});


var multer = require('multer');
var bodyParser = require('body-parser');
// Add this line below
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json());
var storage =   multer.diskStorage({
 destination: function (req, file, callback) {
   callback(null, './client/files');
 },
 filename: function (req, file, callback) {
    var filename = path.basename(path.resolve(file.originalname))
    console.log('storage>filename:', filename);
    callback(null, filename);
 }
});
var upload = multer({ storage : storage }).array('files',999);
app.post('/upload',function(req,res){
    console.log('/upload',req.file)
    upload(req,res,function(err) {
        if(err) {
            console.error(err)
            return res.end("Error uploading file.");
        }
        res.redirect('back');
    });
});
app.post('/submitscript',function(req,res){
    console.log('/submitscript post body params',req.body)
    if (!isPasscodeValid(req.body.passcode))
        return res.send('invalid password');

    // Endpoint used for saving new name file
    // changing default also
    if (req.body.makedefault && req.body.makedefault.length>0) {
        // just change a script to be default and redirect there
        var filename = path.basename(path.resolve(req.body.files))
        var target = 'scripts/'+filename;
        var link = __dirname +'/client/script_current.txt';

        if (fs.existsSync('client/'+target)) {
            fs.unlinkSync(link)
            fs.symlink(target, link, 'file', (err) => { 
                if (err) {
                    console.log(err); 
                    return res.send('error1');
                }
                else { 
                    console.log("\nSymlink created. Update script_file_target global\n"); 
                    // update global default reference so editor html loader knows:
                    script_file_target = 'client/scripts/'+filename;
                    return res.redirect('/editor/'+filename);
                } 
            }) 
        }
        else {
            return res.send('error2');
        }
        return 
    }

    console.log("The script of length '"+req.body.script.length+"' was saved!");
    if (req.body.saveas_filename && req.body.saveas_filename.length > 0)
        var filename = path.basename(path.resolve(req.body.saveas_filename))
    else 
        var filename = path.basename(path.resolve(req.body.files))
    fs.writeFile(__dirname +'/client/scripts/'+ filename, req.body.script, function(err) {
        if(err) {
            console.log(err);
            return res.end("Error editing script.");
        }
        return res.redirect('/editor/'+filename);
    });

});

app.post('/delete',function(req,res){
    console.log('delete files:',req.body.files, typeof req.body.files);
    if (!isPasscodeValid(req.body.passcode))
        return res.send('invalid password');

    // one file selected:
    var files = []
    if (typeof req.body.files == "string") {
        files.push(req.body.files)
    }
    else {
        files = req.body.files;
    }
    // limit files we will allow to be deleted to:
    // This is likely not secure enough
    var media = walkSync(__dirname+ '/client/files').map(f=>'/client/files/'+f);
    var scripts = walkSync(__dirname +'/client/scripts').map(f=>'/client/scripts/'+f);
    var allowed = media.concat(scripts);

    
    files.forEach(function(filestr){
        // use path.resolve() to prevent '../' security issues
        var file = path.resolve(filestr)
        if (allowed.indexOf(file) >= 0) {
            fs.unlink(__dirname + file, function(err) {
                    if (err) {
                        console.log('err delete file:', file, err);
                        return res.end("Error deleting file.");
                    } else {
                        console.log('deleted file:', file);
                    }        
            });
        }
        else {
            console.error('delete error. file not allowed:',file)
        }
    })
    res.redirect('back');
});



console.log('Web server running at http://' + app_host + ':' + app_port);

var offby = 1000000; // this used later.when < breathing_time_window we are in sync
var breathing_slaves = {};
var breathing_time_window    = 2200; //ms that all have breath to be true
var breathing_time_threshold = 60000; // ignore slaves that haven't been breathing for this long
var check_time_threshold     = true; // if false ignore the threshold. effectively then everyone needs to be in sync
var required_active          = LIVE ? 15 : 2; // regardless, require at least this many active slaves
var required_active_percent  = LIVE ? 0.7 : 1.0; // io.engine.clientsCount*this

//
// for transmediale fake breathing
//
// BUG BUG: This only works for one client at the moment
// if we need to work with several clients... more work
// BUG BUG: should probably just move this into the client code
var max_clients             = 11
var client_breath_min_ms    = 2500
var client_breath_max_ms    = 2600
var new_client_every_min_ms = 5000
var new_client_every_max_ms = 5010
// for now just run breathing forever... as the end of the station?
var breathfake_length_ms    = ( (60*4) + 40 ) * 1000 // should be length of the breathing mp3. If 0 it runs forever
var base64id = require('base64id')
var breathfake_socketid = null
var breathfake = (function () {
    var clients = {}
    var masterhandle = null
    var synchandle = null

    var breath_callback = null // we use this to access socket.io cb
    var sync_callback = null // we use this to send the in sync end signal

    function breath (id) {
        //console.log(id)
        if (breath_callback)
            breath_callback(id)
    }
    function sync() {
        console.log('breathing sync cb')
        if (sync_callback) {
            sync_callback()
            end()
            clients = {}
        }
    }
    function new_client () {
        // make it look like socket io ids
        // /#O-sBioQB99lw9XZcAAAA /#xjnuLO4hce8khYlkAAAI /#Z47SLo0Ms4B-jC7KAAAJ /#xR8ae6v6lNK3CpLNAAAH /#mgsL4ZhPlVE3WThuAAAF
        var id = '/#'+base64id.generateId()
        var interval = parseInt(Math.random() * (client_breath_max_ms-client_breath_min_ms) ) + client_breath_min_ms
        console.log('new ', id, 'interval', interval)
        if (clients[id])
            clearInterval(clients[id])
        clients[id] = setInterval(function(id){breath(id)}, interval, id)
        // /#73lUFnJhI9xJ3K1lAAAB
    }
    function end () {
        // clear master loop
        if (masterhandle) clearTimeout(masterhandle)
        // clear delayed sync ending
        if (synchandle) clearTimeout(masterhandle)

        Object.keys(clients).forEach(function(id){
            console.log('stop',id)
            clearTimeout(clients[id])
            delete clients[id]
        })
    }
    function master_add_client_loop () {
        if (masterhandle) clearTimeout(masterhandle)
        if (Object.keys(clients).length >= max_clients) {
            console.log('max clients reached', max_clients)
            return
        }
        var interval = parseInt(Math.random() * (new_client_every_max_ms-new_client_every_min_ms) ) + new_client_every_min_ms
        // meh. randomly choose to wait between 1 to 3 cycles
        // so that they don't always start at 5000ms if that is set as both max+min
        interval *= parseInt((Math.random()*3)+1)
        console.log('new  in', interval)
        masterhandle = setTimeout(function () {
            new_client()
            master_add_client_loop()
        }, interval)
    }
    function begin (breath_cb, sync_cb) {
        end()
        console.log('breathfake begin()')
        if (typeof breath_cb != 'function') {
            console.log ('breathfake cb not func')
        }
        else {
            breath_callback = breath_cb
            // let end() cleanup finish
            master_add_client_loop()
        }
        if (typeof sync_cb == 'function' && breathfake_length_ms > 0) {
            sync_callback = sync_cb
            if (synchandle) clearTimeout(synchandle)
            synchandle = setTimeout(sync, breathfake_length_ms)
        }
    }
    return {
        begin: function (breath_cb, end_cb) { begin(breath_cb, end_cb) },
        end: function () { end () },
        new_client: function () { new_client() },
        clients: function () { console.log(clients) },
    }
}())

// for transmediale
// client may call back and give device id which is used as a endpoint name to start/stop
devices = {} //format: {socket.id: device_id}
function device_start(device_id) {
    socket_ids = Object.keys(devices).filter(function(key) {
        return devices[key] === device_id })
    socket_ids.forEach(function(socket_id) {
        console.log('emit device_start', socket_id)
        io.to(socket_id).emit('device_start') })
}
function device_stop(device_id) {
    socket_ids = Object.keys(devices).filter(function(key) {
        return devices[key] === device_id })
    socket_ids.forEach(function(socket_id) {
        console.log('emit device_stop', socket_id)
        io.to(socket_id).emit('device_stop') })
    // if device was breathing, we need to stop breather on disconnect
    // breathfake_socketid contains the socket id that started breather
    // we have to see if the current device id matches the breather socket
    // if so call breathfake.end()
    if (breathfake_socketid && devices[breathfake_socketid] && devices[breathfake_socketid] == device_id) {
        console.log('device that was breather disconnected. stop breathfake')
        breathfake.end()
    }
}
app.get('/device/:device_id/plugin', function (req, res) {
    res.send('OK')
    console.log('/device/'+req.params.device_id+'/plugin')
    device_start(parseInt(req.params.device_id))
});
app.get('/device/:device_id/plugout', function (req, res) {
    res.send('OK')
    console.log('/device/'+req.params.device_id+'/plugout')
    device_stop(parseInt(req.params.device_id))
});


io.sockets.on('connect', function (socket) {
    console.log('connected', io.engine.clientsCount);
    console.log('client id', socket.id)
    console.log('client query', socket.handshake.query)
    if (socket.handshake.query && socket.handshake.query.device_id) {
        devices[socket.id] = parseInt(socket.handshake.query.device_id)
        console.log('new device', devices)
    }
    socket.on("disconnect",function(){
        delete devices[socket.id]
        console.log('disconnect', devices)
    })
    // this channel is whence server/admin sends commands to client (avoiding interacting with UI)
    socket.join('protektoramea');

    // give client all information
    socket.on('init', function() {
        socket.emit('state', state);
    });

    // get some info for master
    socket.on('get_info', function(id) {
        socket.emit('info', {
                clientCount: io.engine.clientsCount,
                breathingActive: activeSlaveIds(new Date().getTime()).length,
            });
    });
    socket.on('download_script', function(data) {
        if (isPasscodeValid(data.passcode)) {
            console.log('passcode correct')
            download_script();
        }
        else {
            console.log('download_script invalid passcode', data.passcode)
        }
    });
    socket.on('set_state', function(data){
        if (isPasscodeValid(data.passcode)) {
            state.time  = new Date().getTime();
            state.slide = data.slide;
            console.log('set_state', state);
            if (DEBUG)
                socket.emit('debug', "new state: "+JSON.stringify(state));
        }
        else {
            console.log('set_state invalid passcode')
            if (DEBUG)
                socket.emit('debug', "invalid passcode");
        }
    });
    if (DEBUG) {
    socket.on('ack_force', function(data){
        console.log('ack_force');
    })
    }
    socket.on('set_force', function(data){
        if (isPasscodeValid(data.passcode)) {
            console.log('set_force and broadcast', data);
            // make sure init also set
            state.time  = new Date().getTime();
            state.slide = data.slide;
            // send out force, except to sender (master)
            socket.broadcast.to('protektoramea').emit('force', state); //io.to('protektoramea').emit('force', state);
            if (breathing_completed && data.slide <= 1) // another way to re-allow breathing sequence
                breathing_completed = false;
            if (DEBUG)
                socket.emit('debug', "new force: "+JSON.stringify(state.force));
        }
        else {
            console.log('set_force invalid passcode')
            if (DEBUG)
                socket.emit('debug', "invalid passcode");
        }
    });


    //
    function breathingInSync(slave_ids, now) {
        // during testing is low, for live set high
        if (slave_ids.length < required_active) {
            console.log('breath', 'not enough active:', slave_ids.length, '<', required_active)
            return false;
        }

        // for live show require certain % all connected to be breathing
        if (slave_ids.length < (io.engine.clientsCount*required_active_percent)) {
            console.log('skip sync check')
            console.log('slave_ids.length', slave_ids.length, '!>', io.engine.clientsCount*required_active_percent, '(io.engine.clientsCount',io.engine.clientsCount,'*','required_active_percent',required_active_percent,")");
            return false;
        }

        var total_time = 0;
        for (var i = 0; i<slave_ids.length; i++)
            total_time += breathing_slaves[slave_ids[i]];
        var avg = parseInt(total_time/slave_ids.length);
        offby = (now - avg)*slave_ids.length;
        console.log('breathing slaves:', slave_ids.length, 'tot:', total_time, 'avg:', avg, 'offby:',offby);

        if (offby <= breathing_time_window) {
            console.log('breathing in sync');
            return true;
        }
        return false;
    }
    socket.on('set_breath_sync', function(data) {
        console.log('set_breath_sync request forced');
        if (isPasscodeValid(data.passcode)) {
            io.to('protektoramea').emit('breathing_in_sync');
            breathing_completed = true;
        }
    });
    socket.on('breath', function(id) {
        console.log('breath id:', id, offby);
        // send this to everyone but sender, volatile (can be dropped)
        socket.broadcast.to('protektoramea').volatile.emit('breathing', {id:id});

        var now = parseInt(new Date().getTime());
        var active_ids = activeSlaveIds(now);
        if (typeof breathing_slaves[id] == 'undefined' && active_ids.length > 0) {
            // new client, send all valid ids to only this client
            // , except our own which has not be initialized yet so not in the activeSlaveIds yet
            socket.emit('breathing_init', {ids: active_ids });
            console.log('breath send slave_ids');
        }
        breathing_slaves[id] = parseInt(new Date().getTime());

        if(breathing_self_sync && breathingInSync(active_ids,now)) {
            io.to('protektoramea').emit('breathing_in_sync');
            breathing_completed = true;
        }

        // io.to('protektoramea').emit('breathing_in_sync');

    });
    socket.on('get_breath_tempo_bang', function(data) {
        if (TRANSMEDIALE) {
            socket.emit('breath_tempo_bang');
        }
        else {
            var now = new Date().getTime();
            waitfor = 4000-(now%4000);
            if (DEBUG_BREATH_AUDIO) console.log('get_breath_tempo_bang send in', waitfor);
            // tried to swap this out for a global send... doesn't help with syncronicity
            breath_audio_2_handle = setTimeout(function(){
                socket.emit('breath_tempo_bang');
                if (DEBUG_BREATH_AUDIO)
                    console.log('        breath_tempo_bang now', socket.id, new Date().getTime());
            },waitfor);
        }
        //
        // transmediale
        //
        // here we can start our local fake breathers
        // pass in a callback to a socket function that the faker can call
        // to emit a new breath
        if (TRANSMEDIALE) {
            breathfake_socketid = socket.id
            breathfake.begin(
                // breath callback
                function (id) {
                    // console.log('cb', id)
                    socket.volatile.emit('breathing', {id:id});
                },
                // breathing in sync / end callback
                function () {
                    socket.emit('breathing_in_sync');
                }
            )
            socket.on("disconnect",function(){
                delete devices[socket.id]
                console.log('disconnect fake breather', devices)
                breathfake.end()
            })
        }
    });
    if (TRANSMEDIALE) {
        // lets stop sending fake breathing when this client disconnects
    }
    // globally change breathing on/off
    socket.on('set_breath_audio_stop', function(data) {
        console.log('set_breath_audio_stop');
        if (isPasscodeValid(data.passcode))
            io.to('protektoramea').emit('breathing_audio_stop');
    });
    socket.on('set_breath_audio_start', function(data) {
        console.log('set_breath_audio_start');
        if (isPasscodeValid(data.passcode))
            io.to('protektoramea').emit('breathing_audio_start');
    });
});
function isPasscodeValid(recvpass) {
    if (recvpass != passcode)
        console.log('invalid passcode');
    return recvpass === passcode;
}

function activeSlaveIds(now) {
    var slave_ids = Object.keys(breathing_slaves);
    if (!check_time_threshold)
        return slave_ids;
    var active_ids = []
    for (var i = 0; i < slave_ids.length; i++) {
        // if slave breath is older than now-threshold, ignore
        if (breathing_slaves[slave_ids[i]] > now-breathing_time_threshold) {
            active_ids.push(slave_ids[i]);
        }
    }
    return active_ids;
}


if (process.stdin.isTTY) {

    var stdin = process.openStdin();
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    stdin.on( 'data', function( key ){
      if ( key === '\u0003' ) { // ctrl+c aka quit
        process.exit();
      }
      else if ( key === '\u0014' || key === '\u001bt' ) { // ctrl+t or alt+t aka test
          console.log("state",util.inspect(state,{depth: null}));
          console.log("slaves",util.inspect(breathing_slaves,{depth: null}));
          var active_ids = activeSlaveIds(new Date().getTime());
          console.log("active",util.inspect(active_ids,{depth: null}));
          console.log('sync check condition:')
          console.log('active_ids.length', active_ids.length, '!>', io.engine.clientsCount*required_active_percent, '(io.engine.clientsCount',io.engine.clientsCount,'*','required_active_percent',required_active_percent,")");
          // transmediale
          if (TRANSMEDIALE)
            console.log('devices', devices)
      }
      else if ( key === '\u001bd' /*alt+d*/) { // download script file
          download_script();
      // write the key to stdout all normal like
      //process.stdout.write( key );
      }
      else if ( key === '\r' /*alt+d*/) { // download script file
          console.log("");
    }
      else {
         console.log("unknown key: ");
         console.log(util.inspect(key,{depth: null})); // use to see key
      }

    });
}
function download_script() {
    console.log('download', script_download_url);
    console.log('manually reload clients');
    if (script_download_url.substr(0,5) == 'https')
        var http    = require('https');
    else
        var http    = require('http');
    var file    = fs.createWriteStream(script_file);
    var request = http.get(script_download_url, function(response) {
      response.pipe(file);
    });
    file.on('finish', function() {
        console.log('download done');
        file.close();
    });
}
