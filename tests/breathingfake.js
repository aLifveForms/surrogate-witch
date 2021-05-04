console.log(`
rather than using the fakebreath code in server.js this code simulates a full socket.io client to fake breathing
arguments: max_clients
`);
var max_clients = process.argv[1]

var io = require('socket.io-client');


function new_socket () { 
  var socket = io.connect('http://localhost:8080');
  socket.on('connect', data => { console.log('connect',data);
    setInterval(function(){
      socket.emit('breath', socket.id);
    },2000);
  });
  socket.on('device_start', data => { console.log('device_start',data) })
  socket.on('device_stop', data => { console.log('device_stop',data) })
  socket.on('state', data => { console.log('state',data) })
  socket.on('force', data => { console.log('force',data) })
  socket.on('debug', data => { console.log('debug',data) })
  socket.on('info', data => { console.log('info',data) })
  socket.on('breath_tempo_bang', data => { console.log('breath_tempo_bang',data) })
  socket.on('breathing', data => { console.log('breathing',data) })
  socket.on('breathing_init', data => { console.log('breathing_init',data) })
  socket.on('breathing_in_sync', data => { console.log('breathing_in_sync',data) })
  socket.on('breathing_audio_stop', data => { console.log('breathing_audio_stop',data) })
  socket.on('breathing_audio_start', data => { console.log('breathing_audio_start',data) })
  socket.on('breath_tempo_bang', data => { console.log('breath_tempo_bang',data) })
  socket.on('event', data => { console.log('event',data) })
  socket.on('disconnect', data => { console.log('disconnect',data) })
  sockets.push(socket);
  return socket;
}

var sockets = []; // just storage so they are not lost

//
// <copied_from_server.js> with minor modifications
// 
var clients = {}; // index by id
var client_breath_min_ms    = 2500
var client_breath_max_ms    = 2600
var new_client_every_min_ms = 5000
var new_client_every_max_ms = 5010
var masterhandle = null
function new_client () {
  // make it look like socket io ids
  // /#O-sBioQB99lw9XZcAAAA /#xjnuLO4hce8khYlkAAAI /#Z47SLo0Ms4B-jC7KAAAJ /#xR8ae6v6lNK3CpLNAAAH /#mgsL4ZhPlVE3WThuAAAF
  var socket = new_socket();
  var id = socket.id();
  //var id = '/#'+base64id.generateId();
  var interval = parseInt(Math.random() * (client_breath_max_ms-client_breath_min_ms) ) + client_breath_min_ms
  console.log('new ', id, 'interval', interval)
  if (clients[id])
      clearInterval(clients[id])
  clients[id] = setInterval(function(id){breath(id)}, interval, id)
  // /#73lUFnJhI9xJ3K1lAAAB
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
//
// </copied_from_server.js>
// 

master_add_client_loop()

if (Object.keys(clients).length >= max_clients) {
  console.log('max clients reached', max_clients)
  return
}


