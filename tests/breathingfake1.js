console.log(`
rather than using the fakebreath code in server.js this code simulates a full socket.io client to fake breathing
`);


var io = require('socket.io-client');

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

