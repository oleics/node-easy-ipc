
module.exports = {
  joined: joined
  , pong: pong
}

var Ipc = require('../..')

function joined(conn) {
  conn.write(Ipc.Cmd.mkCmd('ping', Date.now()))
}
joined.doc = ''

function pong(servertime, now, conn) {
  console.info('pong: %d', Date.now()-now)
  setTimeout(function() {
    conn.write(Ipc.Cmd.mkCmd('ping', Date.now()))
  }, 1000)
}
pong.doc = ''
pong.countArgs = -1
