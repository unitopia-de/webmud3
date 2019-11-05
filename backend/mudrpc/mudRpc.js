'use strict';

const net = require('net');
const LDJClient = require('./ldjClient');

var MudRpc;

// [ Request, ID, App, Funktion, Argumente, ... ]
// Request ist die Art des Paketes (2: Aufruf, 1: Antwort auf Aufruf, 0: Fehler bei Aufruf)
// ID ist eine eindeutige ID, um die Antwort/Fehler dem Aufruf zuzuordnen
// App ist das Objekt, wo die Funktion aufgerufen werden soll (z.b. "mail" fuer Mail-Funktionen)
// Antwort: [ Request, ID, Fehlertext bzw. Rueckgabewert ]
// Fuer die Authentifizierung haben wir "mud", "password"


MudRpc = class MudRpc extends LDJClient {
    constructor(client) {
      super(client);
        let i_id = 1000;
        let cache = {};
        let other = this;
          other.on('message', (data) => {
              // console.log("rpc-message: ",data);
              const r_id = data[1];
              const r_req = data[0];
              let r_cb = undefined;
              if (typeof cache[r_id] !== 'undefined' && typeof cache[r_id].cb !== 'undefined' ) {
                r_cb = cache[r_id].cb;
              } else {
                other.emit('error','response without request: '+r_id);
                return;
              }
              if (r_req == 0) {
                r_cb(data[2],null); // internal error from mudrpc...
              } else if (r_req == 1) {
                r_cb(null,data[2]);
              }
          });
          other.on('request', (app,data,cb) => {
            i_id = i_id + 1;
            cache[i_id] = {cb:cb};
            const s2 = JSON.stringify(data);
            const s1 = "[ 2, "+i_id+", \""+app+"\", "+s2.substr(1,s2.length-2)+" ]\n";
            const b1 = Buffer.from(s1);
            client.write(b1);
            // console.log("rpc-request: ",s1);
          })
          client.on('end', () => {
            console.log('MudRpc: disconnected from server');
            other.enit('disconnected');
          });
    }; // constructor

}; // class MudRpc

module.exports = MudRpc;