
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
        if(cmd.sig && cmd.sig.length) {
          var missing = cmd.sig.length - args.length
          
          if(missing < 0) {
            exec('.error', 'Too much arguments: %s %s', name, args.join(' '), conn)
            return
          }
          
          while(missing > 0) {
            args.push(null)
            missing -= 1
          }
          
          args.push(conn)
          args.push(self)
        } else {
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
        
        cmd.apply(null, args||[])
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
  
  function wrap(str, len, indent) {
    len = len || 78
    indent = indent || ''
    var res = [indent], pos = 0
    str = str.split(' ')
    while(str.length) {
      var s = str.shift()
      if((res[pos]+s).length > len+indent.length) {
        res.push(indent)
        pos++
      } else if(res[pos] !== indent) {
        res[pos] += ' '
      }
      res[pos] += s
    }
    return res.join('\n').slice(indent.length)
  }
  
  function sig2str(sig) {
    var s = []
    sig.forEach(function(sig, i) {
      var name = sig.name || 'arg'+i
      if(sig.required) s.push(name)
      else s.push('['+name+']')
    })
    s = s.join(' ')
    return s
  }
  
  self.add('help'
    , function help(name, conn, server) {
      if(name) {
        // detailed help
        if(self._cmds[name]) {
          var cmd = self._cmds[name]
            , out = ''
            , args = []
          out += name
          if(cmd.doc) {
            out += '\n'+cmd.doc+'\n'
          }
          out += '\nUsage: '+name+' '+sig2str(cmd.sig)+'\n'
          cmd.sig.forEach(function(sig) {
            var s = []
            if(sig.type) s.push('<'+sig.type+'>')
            if(sig.required) s.push(sig.name)
            else s.push('['+sig.name+']')
            s = s.join(' ')
            if(sig.description) s += ' - '+sig.description
            args.push('  '+s)
          })
          if(args.length) {
            out += '\nArguments:\n\n'+args.join('\n')+'\n'
          }
          exec('.info', out, conn)
        } else {
          exec('.error', 'Unknown command: %s', name, conn)
        }
      } else {
        // list of commands
        // exclude commands starting with a .
        var cmds = Object.keys(self._cmds).filter(function(v) {
              return v[0] !== '.'
              return true
            })
          , prefix = cmds.reduce(function(p, c) {
              return Math.max(p, c.length)
            }, 0)
          , prefix = new Array(Math.max(17, prefix+1)).join(' ') + '  '
          , out = cmds.map(function(name) {
              var cmd = self._cmds[name]
              return (prefix+name).slice(-1*prefix.length) + ' - ' + wrap(cmd.doc, 48, prefix + '   ')
            })
        exec('.info', 'Available commands:\n\n%s\n\n%d total.', out.join('\n'), cmds.length, conn)
      }
    }
    , null
    , 'Prints this help. Type help [command] to get detailed informations.'
    , [
      {name: 'name', required: false, type: 'String', description: 'The name of a command.'}
    ]
  )
  
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
  this._cmds[name].sig = sig != null ? sig : []
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
