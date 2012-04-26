
var Ipc = require('../..')
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
    
    // load server-commands
    var ipccmd = new Ipc.Cmd(ipc)
    ipccmd.set(require('./server'))
    
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
    
    // load client-commands
    var ipccmd = new Ipc.Cmd(ipc, conn)
    ipccmd.set(require('./client'))
    
    // load cli
    var ipccli = new Ipc.Cli(ipc, conn)
  })
.start()
