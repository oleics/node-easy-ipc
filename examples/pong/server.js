
module.exports = {
  join: join
  , ping: ping
}

function join(name, conn, server) {
  conn.write('joined')
  conn.cmd.joined()
}
join.doc = 'Join the table.'
join.sig = [
  {
    name: 'name'
    , required: true
    , type: 'String'
    , description: 'Player name.'
  }
]

function ping(now, conn, server) {
  conn.cmd.pong(Date.now(), now)
}
ping.doc = ''
ping.sig = [
  {
    name: 'now'
    , required: true
    , type: 'Number'
    , description: ''
  }
]
