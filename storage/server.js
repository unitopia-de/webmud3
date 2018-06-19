// Load requirements
var http = require('http');
var io = require('socket.io');
var mysql      = require('mysql');
var pool = mysql.createPool({ // TODO get parameters from central secure storage...
  host     : 'localhost',
  port     : 3306,
  user     : 'webmud',
  password : 'oQa0sHmjkGf2v1hARLAo',
  database : 'webmud'
  /*
  user     : '< MySQL username >',
  password : '< MySQL password >',
  database : '<your database name>'
  */
});

// Create server & socket
var server = http.createServer(function(req, res)
{
  // Send HTML headers and message
  res.writeHead(404, {'Content-Type': 'text/html'});
  res.end('<h1>No html pages available. 404</h1>');
});
server.listen(8000);
console.log("storage process startet at port 8000");
io = io.listen(server);

// Add a connect listener
io.sockets.on('connection', function(socket)
{
  console.log('Client connected.');

  // Disconnect listener
  socket.on('disconnect', function() {
    console.log('Client disconnected.');
  });

  socket.on('chat-message', function(chatOb){
    // CREATE TABLE webchat ( timemsec INT, msgfrom VARCHAR(50), message TEXT );
    const insertChat = "INSERT INTO webchat (timemsec,msgfrom,message) VALUES (?,?,?)";
    // const chatOB = { type: 'new-message', from: msgOb.from, text: msgOb.text, date: timeStamp };
    const chatData = [chatOb.date,chatOb.from,chatOb.text];

    pool.getConnection(function(err, connection) {
        connection.query(insertChat,chatData, function (error, results, fields) {
            connection.release();// And done with the connection.
            if (error) {
                console.log('chat-message-db-error:',error);
                socket.emit('db-error',error);
            } else {
                // console.log('Chat message stored!');
            }
        });
      });
  });
});