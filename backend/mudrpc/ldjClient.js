/***
 * Excerpted from "Node.js 8 the Right Way",
 * published by The Pragmatic Bookshelf.
 * Copyrights apply to this code. It may not be used to create training material,
 * courses, books, articles, and the like. Contact us if you are in doubt.
 * We make no guarantees that this code is fit for any purpose.
 * Visit http://www.pragmaticprogrammer.com/titles/jwnode2 for more book information.
***/
'use strict';
const EventEmitter = require('events').EventEmitter;
class LDJClient extends EventEmitter {
  constructor(stream) {
    super();
    let buffer = '';
    let other= this;
    stream.on('connect', () => {
      other.emit('connected');
    })
    stream.on('data', data => {
      buffer += data;
      let boundary = buffer.indexOf('\n');
      while (boundary !== -1) {
        const input = buffer.substring(0, boundary);
        buffer = buffer.substring(boundary + 1);
        other.emit('message', JSON.parse(input));
        boundary = buffer.indexOf('\n');
      }
    });
    stream.on('error', (error) => {this.emit('error',error);});
  }

  static connect(stream) {
    return new LDJClient(stream);
  }
}

module.exports = LDJClient;
