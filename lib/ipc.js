
module.exports = Ipc

var net = require('net')
  , util= require('util')
  , EventEmitter = require('events').EventEmitter
  , Stream = require('stream').Stream
  , Lazy = require('lazy')

function Ipc(options) {
  if(!(this instanceof Ipc)) return new Ipc(options)
  Stream.call(this)
  
  var self = this
  
  options = options || {}
  
  self.socketPath = options.socketPath != null ? options.socketPath : false
  self.port = options.port != null ? options.port : 7100
  self.host = options.host != null ? options.host : 'localhost'
  
  self.reconnect = options.reconnect != null ? options.reconnect : true
  self.delayReconnect = options.delayReconnect != null ? options.delayReconnect : 3000
  
  self.dataType = options.dataType != null ? options.dataType : 'json'
  
  self.numReconnects = 0
}
util.inherits(Ipc, Stream)

Ipc.prototype.connect = function(port, host, cb) {
  var self = this
  
  if(port instanceof Function) {
    cb = port
    port = null
  }
  if(host instanceof Function) {
    cb = host
    host = null
  }
  
  port = port || self.socketPath || self.port
  host = host || (!isNaN(port) ? self.host : null)
  cb = cb || function(){}
  
  var conn
  
  function onError(err) {
    conn.removeListener('connect', onConnect)
    
    if(err.code === 'ENOENT' && isNaN(port) && self.port) {
      self.emit('warn', new Error(err.code+' on '+port+', '+host))
      self.connect(self.port, cb)
      return
    } else if(err.code === 'ECONNREFUSED' && self.numReconnects) {
      self.emit('warn', new Error(err.code+' on '+port+', '+host))
      return self._reconnect(port, host)
    }
    
    cb(err)
    self.emit('error', err)
  }
  
  function onConnect() {
    conn.removeListener('error', onError)
    
    self._parseStream(conn)
    
    conn.on('close', function(had_error) {
      self.emit('close', had_error, conn)
      
      // reconnect
      if(self.reconnect) {
        self._reconnect(port, host)
      }
    })
    
    cb(null, conn)
    
    if(self.numReconnects>0) {
      self.emit('reconnect', conn)
      self.numReconnects = 0
    } else {
      self.emit('connect', conn)
    }
  }
  
  if(port && host) {
    conn = net.connect(port, host)
  } else {
    conn = net.connect(port)
  }
  
  conn.once('error', onError)
  conn.once('connect', onConnect)
}

Ipc.prototype._reconnect = function(port, host) {
  var self = this
  self.numReconnects += 1
  if(self.delayReconnect) {
    setTimeout(function() {
      self.connect(port, host)
    }, self.delayReconnect)
  } else {
    self.connect(port, host)
  }
}

Ipc.prototype.listen = function(port, host, cb) {
  var self = this
  
  if(port instanceof Function) {
    cb = port
    port = null
  }
  if(host instanceof Function) {
    cb = host
    host = null
  }
  
  port = port || self.socketPath || self.port
  host = host || (!isNaN(port) ? self.host : null)
  cb = cb || function(){}
  
  function onError(err) {
    if(err.code === 'EACCES' && isNaN(port) && self.port) {
      self.emit('warn', new Error(err.code+' on '+port+', '+host))
      self.listen(self.port, cb)
      return
    }
    cb(err)
    self.emit('error', err)
  }
  
  function onConnection(conn) {
    self._parseStream(conn, server)
    
    conn.on('close', function(had_error) {
      self.emit('close', had_error, conn, server)
    })
    
    cb(null, conn, server)
    self.emit('connection', conn, server)
  }
  
  var server = net.createServer()
  
  server.once('error', onError)
  
  server.once('listening', function() {
    server.removeListener('error', onError)
    self.emit('listening', server)
  })
  
  server.on('connection', onConnection)
  
  if(port && host) {
    server.listen(port, host)
  } else {
    server.listen(port)
  }
}

Ipc.prototype.start = function(port, host, cb) {
  var self = this
  
  if(port instanceof Function) {
    cb = port
    port = null
  }
  if(host instanceof Function) {
    cb = host
    host = null
  }
  
  port = port || self.socketPath || self.port
  host = host || (!isNaN(port) ? self.host : null)
  cb = cb || function(){}
  
  function onError(err) {
    if(err.code == 'ECONNREFUSED') {
      self.emit('warn', new Error(err.code+' on '+port+', '+host))
      self.listen(port, host)
    } else {
      self.removeListener('listening', onListening)
      self.removeListener('connection', onConnection)
      self.removeListener('connect', onConnect)
      cb(err)
      self.emit('error', err)
    }
  }
  
  function onListening(server) {
    self.removeListener('error', onError)
    self.removeListener('connection', onConnection)
    self.removeListener('connect', onConnect)
    cb(null, true, server)
  }
  
  function onConnection(conn, server) {
    self.removeListener('error', onError)
    self.removeListener('listening', onListening)
    self.removeListener('connect', onConnect)
    cb(null, true, conn, server)
  }
  
  function onConnect(conn) {
    self.removeListener('error', onError)
    self.removeListener('listening', onListening)
    self.removeListener('connection', onConnection)
    cb(null, false, conn)
  }
  
  self.once('error', onError)
  self.once('listening', onListening)
  self.once('connection', onConnection)
  self.once('connect', onConnect)
  
  self.connect(port, host)
}

Ipc.prototype._parseStream = function(conn, server) {
  var self = this
  
  // each line of the stream is one unit of data
  Lazy(conn)
    .lines
    .map(String)
    .forEach(self._onData.bind(self, conn, server))
  
  // overwrite .write() of the connection
  var old_write = conn.write
  conn.write = function() {
    if(conn.writable) {
      if(self.dataType === 'json') {
        arguments[0] = JSON.stringify(arguments[0])+'\n'
      }
      return old_write.apply(conn, arguments)
    } else {
      self.emit('warn', new Error('Connection is not writable.'))
    }
  }
}

Ipc.prototype._onData = function(conn, server, data) {
  if(this.dataType === 'json') {
    data = JSON.parse(data)
  }
  
  if(server) {
    this.emit('data', data, conn, server)
  } else {
    this.emit('data', data, conn)
  }
}

// load complementing extensions
Ipc.Cmd = require('./ipc-cmd')
Ipc.Cli = require('./ipc-cli')
