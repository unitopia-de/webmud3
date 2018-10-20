// Object to capture process exits and call app specific cleanup function

function noOp() {console.log('Empty Cleanup')};

exports.Cleanup = function Cleanup(callback) {

  // attach user callback to the process event emitter
  // if no callback, it will still exit gracefully on Ctrl-C
  callback = callback || noOp;
  process.on('cleanup',callback);

  // do app specific cleaning before exiting
  process.on('exit', function () {
    process.emit('cleanup');
  });

  // catch ctrl+c event and exit normally
  process.on('SIGINT', function () {
    console.log('Ctrl-C...');
    process.emit('cleanup');
    setTimout(function(){process.exit(2);});
  });

  // catch SIGTERM event and exit normally (docker exit!)
  process.on('SIGTERM', function () {
    console.log('SIGTERM ...');
    process.emit('cleanup');
    setTimout(function(){process.exit(2);},100);
  });

  process.on('SIGKILL', function () {
    console.log('SIGKILL ...');
    process.emit('cleanup');
    setTimout(function(){process.exit(2);},100);
  });

  // catches "kill pid" (for example: nodemon restart)
process.on('SIGUSR1', function () {
    console.log('SIGUSR1...');
    process.emit('cleanup');
    setTimout(function(){process.exit(2);});
  });
process.on('SIGUSR2', function () {
    console.log('SIGUSR2...');
    process.emit('cleanup');
    setTimout(function(){process.exit(2);});
  });

  //catch uncaught exceptions, trace, then exit normally
  process.on('uncaughtException', function(e) {
    console.log('Uncaught Exception...');
    console.log(e.stack);
    process.exit(99);
  });
};