
module.exports = {
  joined: joined
  , pong: pong
}

function joined(conn) {
  conn.cmd.ping(Date.now())
}
joined.doc = ''

function pong(servertime, now, conn) {
  console.info('pong: %d', Date.now()-now)
  setTimeout(function() {
    conn.cmd.ping(Date.now())
  }, 1000)
}
pong.doc = ''
pong.countArgs = -1
