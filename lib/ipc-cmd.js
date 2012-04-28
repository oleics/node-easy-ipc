
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
      
      // console.log(name, args)
      
      if(cmd) {
        // if sig exists, check args against it
        if(cmd.sig) {
          var missing = cmd.sig.length - args.length
          
          // too much arguments will break every command that
          // uses conn or self
          if(missing < 0) {
            exec('.error', 'Too much arguments: %s %s', name, args.join(' '), conn)
            return
          }
          
          // check if all required argument were passed
          var mr = cmd.sig.reduce(function(p, s, i) {
            if(s.required && !(args[i]!=null)) {
              return p+1
            }
            return p
          }, 0)
          if(mr) {
            exec('.error', 'Missing %d required arguments: %s %s', mr, name, args.join(' '), conn)
            self._cmds.usage(name, conn, self)
            return
          }
          
          // fill the holes
          while(missing > 0) {
            args.push(null)
            missing -= 1
          }
          
          // Always put conn and self at the end of the argument-list
          // Never mention both in the .sig
          // This is suboptimal, but i don't know how to solve this
          // FIXME
          args.push(conn)
          args.push(self)
        } else {
          // if sig does not exist, use cmd.length as a basic arg check
          var missing = cmd.length - args.length
          
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
        }
        
        cmd.apply(self, args||[])
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
  
  self.add('.log', function() {
    console.log.apply(console.log, arguments)
  })
  
  self.add('.info', function() {
    console.info.apply(console.info, arguments)
  })
  
  self.add('.warn', function() {
    console.warn.apply(console.warn, arguments)
  })
  
  self.add('.error', function() {
    console.error.apply(console.error, arguments)
  })
    
  self.add('exit', function(conn, server) {
    conn.end()
  })
  
  self.set(require('./ipc-cmd-help'))
  
  if(conn) {
    introspect(conn)
  }
}

IpcCmd.prototype.set = function(obj) {
  var self = this
  Object.keys(obj).forEach(function(name) {
    self.add(name, obj[name], null, obj[name].doc, obj[name].sig)
  })
  return this
}

IpcCmd.prototype.add = function(name, func, scope, doc, sig) {
  if(this._cmds[name])
    throw new Error('Command already defined: '+name)
  this._cmds[name] = func.bind(scope || this)
  this._cmds[name].doc = doc != null ? doc : ''
  this._cmds[name].sig = sig != null ? sig : null
  return this
}

var introspect = IpcCmd.introspect = function(conn) {
  exec('.commands', conn)
}

var exec = IpcCmd.exec = function(/* cmdName, arg1, arg2, ..., conn*/) {
  var args = Array.prototype.slice.call(arguments, 0)
    , conn = args.pop()
  if(conn.write) {
    conn.write(mkCmd.apply(mkCmd, args))
    return true
  }
  return false
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
