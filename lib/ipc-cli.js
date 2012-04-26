
module.exports = IpcCli

var line2cmd = require('./ipc-cmd').line2cmd
  , mkCmd = require('./ipc-cmd').mkCmd
  , isCmd = require('./ipc-cmd').isCmd
  , readline = require('readline')
  , util = require('util')

function IpcCli(ipc, conn) {
  if(!(this instanceof IpcCli)) return new IpcCli(ipc, conn)
  var self = this
  
  self.ipc = ipc
  self.conn = conn
  
  // setup console
  
  self.stdin = process.openStdin()
  self.stdout = process.stdout
  
  self._rl = readline.createInterface(self.stdin, self.stdout)
  
  self._rl.on('line', function(line) {
    self.conn.write(line2cmd(line))
    self.consoleRefresh()
  })
  
  self.stdin.on('keypress', function(c, key) {
    if(key && key.name === 'c' && key.ctrl && ! key.meta && !key.shift) {
      self.console(false)
      self.writeToConsole('Press [Ctrl+C] again to quit.\n')
    }
  })
  
  // handle connect and reconnect
  self.ipc.on('connect', function(conn) {
    self.setConnection(conn)
  })
  self.ipc.on('reconnect', function(conn) {
    self.setConnection(conn)
  })
  
  // print everything that is not a command
  self.ipc.on('data', function(data) {
    if(!isCmd(data)) {
      self.writeToConsole(data)
    }
  })
  
  // set current connection
  self.setConnection(conn)
  
  // overwrite console.*
  console.log = self.writeToConsole.bind(self)
  console.info = self.writeToConsole.bind(self, 'info')
  console.warn = self.writeToConsole.bind(self, 'warn')
  console.error = self.writeToConsole.bind(self, 'error')
}

IpcCli.prototype.setConnection = function(conn) {
  var self = this
  
  if(self.conn) {
    self.conn = null
  }
  
  self.conn = conn
  self.console(true)
  self.writeToConsole('connected to '+conn.remoteAddress+':'+conn.remotePort+' from '+JSON.stringify(conn.address())+'\n')
  self.consoleRefresh()
  
  conn.on('close', function() {
    console.error('connection lost!')
    self.conn = null
    self.console(false)
    if(self.ipc.reconnect) {
      console.info('reconnecting...')
    }
  })
}

IpcCli.prototype.console = function(mode) {
  if(mode) {
    this.consoleEnabled = true
    this.stdin.resume()
    this._rl.resume()
    this._rl.prompt()
  } else {
    if(this.consoleEnabled) {
      this._rl.output.cursorTo(0)
    }
    this.consoleEnabled = false
    this.stdin.pause()
    this._rl.pause()
  }
}

var logTypes = {
  'log':     'grey'
  , 'info':  'cyan'
  , 'warn':  'magenta'
  , 'error': 'red'
  , 'fatal': 'inverse'
}

IpcCli.prototype.writeToConsole = function() {
  var type, args
  if(logTypes[arguments[0]] != null) {
    type = arguments[0]
    args = Array.prototype.slice.call(arguments, 1)
  } else {
    type = 'log'
    args = arguments
  }
  var str = stylizeWithColor(util.format.apply(util.format, args), logTypes[type])+'\n'
  if(this.consoleEnabled) {
    this._rl.output.cursorTo(0)
    this.stdout.write(str)
    this.consoleRefresh()
  } else {
    this.stdout.write(str)
  }
}

IpcCli.prototype.consoleRefresh = function() {
  if(this.consoleEnabled) {
    this._rl._refreshLine()
  }
}

// https://github.com/trentm/node-bunyan/blob/master/bin/bunyan
// http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
// Suggested colors (some are unreadable in common cases):
// - Good: cyan, yellow (limited use), grey, bold, green, magenta, red
// - Bad: blue (not visible on cmd.exe)
var colors = {
  'bold' : [1, 22],
  'italic' : [3, 23],
  'underline' : [4, 24],
  'inverse' : [7, 27],
  'white' : [37, 39],
  'grey' : [90, 39],
  'black' : [30, 39],
  'blue' : [34, 39],
  'cyan' : [36, 39],
  'green' : [32, 39],
  'magenta' : [35, 39],
  'red' : [31, 39],
  'yellow' : [33, 39]
};

function stylizeWithColor(str, color) {
  if (!str)
    return '';
  var codes = colors[color];
  if (codes) {
    return '\033[' + codes[0] + 'm' + str +
           '\033[' + codes[1] + 'm';
  } else {
    return str;
  }
}

function stylizeWithoutColor(str, color) {
  return str;
}
