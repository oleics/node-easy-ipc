
module.exports = IpcCmd

var Lazy = require('lazy')
  , Stream = require('stream').Stream

function IpcCmd(ipc) {
  if(!(this instanceof IpcCmd)) return new IpcCmd(ipc)
  var self = this
  
  self.ipc = ipc
  self._cmds = {}
  
  
  // stream commands to executor
  var stream = new Stream()
  self.ipc.on('connection', function(conn) {
    conn.write('Welcome!')
    conn.write('Type "help" for help.')
  })  
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
            // console.warn('Too much arguments: '+name+' '+args.length+', '+cmd.length+', '+cmd.countArgs)
            if(conn.writable) {
              conn.write('Too much arguments: '+name+' '+args.join(' ')+'')
            }
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
        if(conn.writable) {
          conn.write('Unknown command: '+name)
        }
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
  
  self.add('help', function help(name, conn, ipc) {
    if(name) {
      if(self._cmds[name]) {
        conn.write(self._cmds[name].doc)
      } else {
      }
    } else {
      var cmds = Object.keys(self._cmds).filter(function(v) {
        return v[0] !== '.'
      })
      conn.write(mkCmd('.info', 'Available commands: %s, %d total.', cmds.join(', '), cmds.length))
      // conn.write('Available commands: '+cmds.join(', ')+', '+cmds.length+' total.')
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
