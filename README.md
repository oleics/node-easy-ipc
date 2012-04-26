
Easy IPC
========

### Easy inter-process communication over TCP/IP and/or UNIX domain sockets for node.js

**Easy IPC** supports Text and JSON streams. Each line of the  
stream is one item of data.

#### Class Overview

``Ipc``  
This is th base class to create a server or a client (preferably  
both).  

**Complementing Classes**

``Ipc.Cmd``  
Easy command manager that plugs into the Ipc class.

``Ipc.Cli``  
Easy command line interface that plugs into the ``Ipc`` and  
``Ipc.Cmd`` class.

Notice: Although it is very nice to have those two classes, you  
are not forced to use them.

### Installation

``npm install easy-ipc``

### Usage

A short introduction:

```js
var Ipc = require('easy-ipc')
  , ipc = new Ipc({
      socketPath: '/tmp/ipc-test.sock'
      , port: 7100 // If socketPath fails, port is used
      , host: 'localhost'
    })

ipc
  .on('listening', function(server) { // server is an instance of net.Server
    // here we are in server-mode
    
    ipc.on('connection', function(conn, server) { // conn is an instance of net.Socket
      // a client connected to the server, good to know
      
      // end the connection after one second
      setTimeout(conn.end.bind(conn), 1000)
    })
    
    ipc.on('data', function(data, conn, server) {
      // a client sent a data-pack
      if(data.say == 'hello') {
        conn.write('world')
      }
    })
  })
  .on('connect', function(conn) { // conn is an instance of net.Socket
    // here we are in client-mode
    
    // we are connected to the server, be kind and say 'hello'
    conn.write({say: 'hello'})
    
    ipc.on('reconnect', function(conn) {
      // we reconnected to the server
      conn.write({say: 'back again'})
      conn.end()
    })
  })
.start()
```

Quick introduction to ``Ipc.Cmd`` and ``Ipc.Cli``:

```js
var Ipc = require('easy-ipc')
  , ipc = new Ipc()

ipc
  .on('listening', function(server) {
    // server-mode
    
    // set server-commands
    var ipccmd = new Ipc.Cmd(ipc)
    ipccmd.set({
      ping: function(now, conn) {
        // send a command to the client
        conn.cmd.pong(now)
        // Raw: conn.write(Ipc.Cmd.mkCmd('pong', now))
      }
    })
  })
  .on('connect', function(conn) {
    // client-mode
    
    // set client-commands
    var ipccmd = new Ipc.Cmd(ipc, conn)
    ipccmd.set({
      pong: function(now, conn) {
        console.log('rtt: %d', Date.now() - now)
      }
    })
    
    // create cli and use it to send commands to the server like 'ping'
    var ipccli = new Ipc.Cli(ipc, conn)
  })
```

Please see the [examples-folder](/oleics/node-easy-ipc/tree/master/examples) for more.

Class Ipc
---------

Inherits from stream.Stream

### Constructor

``new Ipc(options)``

### Options

``socketPath`` (default: false)  
The path to the socket to connect to.

``port`` (default: 7100)  
The port-number to connect to.

``host`` (default: localhost)  
The hostname to connect to.

``reconnect`` (default: true)  
Reconnect on disconnect.

``delayReconnect`` (default: 3000)  
Delay reconnection for X milliseconds.

``dataType`` (default: json)  
Type of the inter-process data. Until now, ``json`` or ``text``  
is supported.

### Properties

.socketPath  
.port  
.host  
.reconnect  
.delayReconnect  
.dataType

.numReconnects  
Number of reconnects done.

### Methods

``connect([port or socketPath] [, host] [, cb])``  
Connect to a server.

``listen([port or socketPath] [, host] [, cb])``  
Listen to a socket for connections. Aka be a server.

``start([port or socketPath] [, host] [, cb])``  
Combines ``connect()`` and ``listen()``: At first ``start()``  
tryes to connect to a server. If this fails, ``start()`` calls  
``listen()`` and creates a server on success.

Notice: This order (first **connect**, then **listen**) is very nice for  
UNIX domain sockets.

### Events

#### General Events

* warn
  * Error
* error
  * Error

#### Server Mode Events

* listening
  * net.Server
* connection
  * net.Socket
  * net.Server
* data
  * any data
  * net.Socket
  * net.Server
* close
  * boolean had_error
  * net.Socket
  * net.Server

#### Client Mode Events

* connect
  * net.Socket
* data
  * any data
  * net.Socket
* close
  * boolean had_error
  * net.Socket

Class Ipc.Cmd
-------------

### Constructor

``new Ipc.Cmd(ipc [, conn])``

### Methods

``add(name, func [, scope [, doc [, numArgs]]])``  
Adds a command.

``set(obj)``  
The properties of ``object`` will become commands.

### Functions

``Ipc.Cmd.introspect(conn)``  
``Ipc.Cmd.exec(cmdName, arg1, arg2, ..., conn)``  
``Ipc.Cmd.isCmd(data)``  
``Ipc.Cmd.mkCmd(name [, arg1 [, arg2 [, ...]]])``  
``Ipc.Cmd.line2cmd(line)``


Class Ipc.Cli
-------------

### Constructor

``new Ipc.Cli(ipc [, conn])``

### Methods

``setConnection(connection)``  
``console(true or false)``  
``consoleRefresh()``

MIT License
-----------

Copyright (c) 2012 Oliver Leics <oliver.leics@gmail.com>

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.