
module.exports = {
  help: help
}

help.doc = 'Prints this help. Type help [command] to get detailed informations.'

help.sig = [
  {   name: 'name'
    , required: false
    , type: 'String'
    , description: 'The name of a command.'
  }
]

function help(name, conn, ipc) {
  if(name) {
    // detailed help
    if(ipc._cmds[name]) {
      var cmd = ipc._cmds[name]
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
      conn.cmd['.info'](out)
    } else {
      conn.cmd['.error']('Unknown command: %s', name)
    }
  } else {
    // list of commands
    // exclude commands starting with a .
    var cmds = Object.keys(ipc._cmds).filter(function(v) {
          return v[0] !== '.'
          return true
        })
      , prefix = cmds.reduce(function(p, c) {
          return Math.max(p, c.length)
        }, 0)
      , prefix = new Array(Math.max(17, prefix+1)).join(' ') + '  '
      , out = cmds.map(function(name) {
          var cmd = ipc._cmds[name]
          return (prefix+name).slice(-1*prefix.length) + ' - ' + wrap(cmd.doc, 48, prefix + '   ')
        })
    conn.cmd['.info']('Available commands:\n\n%s\n\n%d total.', out.join('\n'), cmds.length)
  }
}

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
