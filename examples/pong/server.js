
module.exports = {
  join: join
  , ping: ping
}

var Ipc = require('../..')

function join(foo, bar, conn, server) {
  conn.write('joined')
  conn.write(Ipc.Cmd.mkCmd('joined'))
}
join.doc = 'Join the table.'

function ping(now, conn, server) {
  conn.write(Ipc.Cmd.mkCmd('pong', Date.now(), now))
}
ping.doc = ''
