
module.exports = IpcCmd

var Lazy = require('lazy')
  , Stream = require('stream').Stream

function IpcCmd(ipc, conn) {
  if(!(this instanceof IpcCmd)) return new IpcCmd(ipc, conn)
  var self = this
  
  self.ipc = ipc
  self._cmds = {}
  
  
  // stream commands to executor
  var stream = new Stream()
  self.ipc.on('connection', function(conn) {
    conn.write('Welcome!')
    conn.write('Type "help" for help.')
  })
  self.ipc.on('connection', introspect)
  self.ipc.on('reconnect', introspect)
  self.ipc.on('data', function(d, c) {
    stream.emit('data', {conn: c, data: d})
  })
  Lazy(stream)
    .filter(function(d) {
      return isCmd(d.data)
    })
    .forEach(function(d) {
      // executor
      var conn = d.conn
        , name = d.data.name
        , args = d.data.args||[]
        , cmd = self._cmds[name]
      if(cmd) {
        var missing = cmd.length - args.length
        if(cmd.countArgs !== false && (cmd.countArgs > -1 || !(cmd.countArgs != null))) {
          if(missing < 0) {
            exec('.error', 'Too much arguments: %s %s', name, args.join(' '), conn)
            return;
          }
        }
        while(missing > 0) {
          if(missing === 1) {
            args.push(conn)
            missing -= 1
          } else if(missing === 2) {
            args.push(conn)
            args.push(self)
            missing -= 2
          } else {
            args.push(null)
            missing -= 1
          }
        }
        cmd.apply(null, args||[])
        if(conn.writable) {
          // conn.write('Command '+name+': '+cmd.length)
        }/*  */
      } else {
        exec('.error', 'Unknown command: %s', name, conn)
      }
    })
  
  // stream rest to stdout
  /* Lazy(stream)
    .filter(function(d) {
      return ! isCmd(d.data)
    })
    .forEach(function(d) {
      console.log(d.data)
    }) */
  
  // some very basic commands used by almost all applications
  
  self.add('.commands', function(conn) {
    exec('.commands-remote', Object.keys(self._cmds), conn)
  })
  
  self.add('.commands-remote', function(cmds, conn) {
    conn.cmd = conn.cmd || {}
    cmds.forEach(function(name) {
      conn.cmd[name] = function() {
        var args = Array.prototype.slice.call(arguments, 0)
        args.unshift(name)
        args.push(conn)
        exec.apply(exec, args)
      }
    })
  })
  
  self.add('help', function help(name, conn, ipc) {
    if(name) {
      if(self._cmds[name]) {
        conn.write(self._cmds[name].doc)
      } else {
        exec('.error', 'Unknown command: %s', name, conn)
      }
    } else {
      var cmds = Object.keys(self._cmds).filter(function(v) {
        return v[0] !== '.'
      })
      exec('.info', 'Available commands: %s, %d total.', cmds.join(', '), cmds.length, conn)
    }
  }, null, 'Prints this help. Type help [command] to get detailed informations.')
  
  self.add('.log', function() {
    console.log.apply(console.log, arguments)
  }, null, '', false)
  
  self.add('.info', function() {
    console.info.apply(console.info, arguments)
  }, null, '', false)
  
  self.add('.warn', function() {
    console.warn.apply(console.warn, arguments)
  }, null, '', false)
  
  self.add('.error', function() {
    console.error.apply(console.error, arguments)
  }, null, '', false)
    
  self.add('exit', function(conn, ipc) {
    conn.end()
  }, null, '')
  
  if(conn) {
    introspect(conn)
  }
}

IpcCmd.prototype.set = function(obj) {
  var self = this
  Object.keys(obj).forEach(function(name) {
    self.add(name, obj[name], null, obj[name].doc, obj[name].countArgs)
  })
  return this
}

IpcCmd.prototype.add = function(name, func, scope, doc, countArgs) {
  if(this._cmds[name])
    throw new Error('Command already defined: '+name)
  this._cmds[name] = func.bind(scope || this)
  this._cmds[name].doc = doc != null ? doc : ''
  this._cmds[name].countArgs = countArgs != null ? countArgs : null
  return this
}

var introspect = IpcCmd.introspect = function(conn) {
  exec('.commands', conn)
}

var exec = IpcCmd.exec = function(/* cmdName, arg1, arg2, ..., conn*/) {
  var args = Array.prototype.slice.call(arguments, 0)
    , conn = args.pop()
  conn.write(mkCmd.apply(mkCmd, args))
}

var isCmd = IpcCmd.isCmd = function(d) {
  return d && d.type === 'cmd'
}

var mkCmd = IpcCmd.mkCmd = function(/* cmd, arg1, arg2, ... */) {
  var args = Array.prototype.slice.call(arguments, 0)
  return {type: 'cmd', name: args[0], args: args.slice(1)}
}

var line2cmd = IpcCmd.line2cmd = function(line) {
  line = line.split(' ')
  return {type: 'cmd', name: line[0], args: line.slice(1)}
}
