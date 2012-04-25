
var Ipc = require('..')
  , ipc = new Ipc({
      socketPath: '/tmp/ipc-test.sock'
      , port: 7100
      , reconnect: true
    })

ipc
  .on('warn', function(err) {
    console.warn(err.toString())
  })
  .on('listening', function(server) {
    // server-mode
    console.log('server-mode', server.address())
    
    // listen to data-events
    ipc.on('data', function(data, conn, server) {
      console.log('got data:', data)
      conn.end('world!')
    })
    
    ipc.on('close', function(had_error, conn) {
      // print a notice that a client disconnected:
      console.log('client disconnected, had_error %s', had_error)
    })
  })
  .on('connection', function(conn, server) {
    // print a notice that a client connected:
    console.log('client connected: %s:%s, %j', conn.remoteAddress, conn.remotePort, conn.address())
  })
  .once('connect', function(conn) {
    // client-mode
    console.log('client-mode')
    
    ipc.on('reconnect', function(conn) {
      console.log('client reconnected')
      ipc.reconnect = false
      conn.write('back again!')
    })
    
    ipc.on('data', function(data, conn) {
      console.log('got data:', data)
    })
    
    ipc.on('close', function(had_error, conn) {
      // print a notice that the client disconnected:
      console.log('client disconnected, had_error %s', had_error)
    })
   
    conn.write('hello')
  })
.start()
