
module.exports = {
  join: join
  , ping: ping
}

function join(foo, bar, conn, server) {
  conn.write('joined')
  conn.cmd.joined()
}
join.doc = 'Join the table.'

function ping(now, conn, server) {
  conn.cmd.pong(Date.now(), now)
}
ping.doc = ''
