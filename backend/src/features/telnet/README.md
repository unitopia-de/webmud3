# Telnet Negotiations

## Overview

Telnet negotiations are a crucial part of the Telnet protocol, allowing clients and servers to agree on various options that affect the communication session. This document explains how Telnet negotiations work and how we handle different options in our implementation.

## Negotiation Process

The Telnet negotiation process is a bidirectional protocol in which both the client and server can initiate and respond to requests for specific options. This process enables both parties to agree on features and settings to be used during the session. The typical negotiation commands are as follows:

- DO: Sent by one party (client or server) to request that the other party enable a specific option. This command is a request for the peer to start using the option if supported.

- DON'T: Sent by a party to instruct the peer not to enable a particular option or as a response to decline a previously sent DO request.

- WILL: Sent in response to a DO command to indicate willingness to enable the specified option. This command signifies that the sender is ready to start using the requested option.

- WON'T: Used to refuse enabling an option. If a peer sends a DO command and the recipient cannot or will not enable the option, it responds with WON'T.

- SUBNEGOTIATION: Some options require additional data to be configured beyond simply being enabled. In such cases, either party can initiate subnegotiation, sending a command with necessary data. For example, options like NAWS (Negotiate About Window Size) or CHARSET (character set) often involve subnegotiation to specify values (e.g., window size or encoding).

The TelnetClient class handles these negotiation commands, regardless of their origin, and emits events for each command received, allowing the application to respond accordingly. This event-driven structure enables dynamic handling of each negotiation state, supporting a flexible exchange of capabilities.

## Supported Options

| Telnet Option                             | Client Support | Client Negotiation | Server Negotiation | Remarks                                                                                                                                                                                                                                                                  | Discussion                                        |
| ----------------------------------------- | -------------- | ------------------ | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------- |
| ECHO                                      | Full           | Dynamic            | Dynamic            | Is used in the telnet login flow to hide user input (password). This option is negotiated on the fly and can be enabled or disabled whenever needed.                                                                                                                     |                                                   |
| SGA (Suppress Go Ahead)                   | Full           | DO                 | WONT               | We offer a DO at startup and can handle changes on the fly. However, Unitopia WONT accept this option for unknown reasons.                                                                                                                                               | https://github.com/unitopia-de/webmud3/issues/115 |
| NAWS (Negotiate About Window Size)        | Partial        | WILL (+ Sub)       | DO                 | We support this option to subnegotiate the window size. However, we send static values for the window size (80x25) and it does look like Unitopia is ignoring these values.                                                                                              | https://github.com/unitopia-de/webmud3/issues/108 |
| CHARSET                                   | Partial        | DO / WILL (+ Sub)  | WILL (+ Sub) / DO  | We support this option to subnegotiate the character set with the server. However, we only accept UTF-8. If the server does not subnogitiate for UTF-8, an error will be thrown and the connection will be closed.                                                       | https://github.com/unitopia-de/webmud3/issues/111 |
| LINEMODE                                  | Partial        | WILL               | DO                 | We support the LINEMODE option. However, the server wants us to send our input buffer whenever ANY ASCII control character is entered (FORWARDMASK), which is unsupported. On the other side, we do support SOFT_TAB and EDIT MODES                                      | https://github.com/unitopia-de/webmud3/issues/114 |
| EOR (End of Record)                       | Todo           | DONT               | WILL               | Allows for the server to signal the end of a record which is not needed for our client.                                                                                                                                                                                  | https://github.com/unitopia-de/webmud3/issues/112 |
| MSSP (Mud Server Status Protocol)         | Todo           | DO                 | WILL               | Allows our client to retrieve basic information about the mud, like the current player count or the server name.                                                                                                                                                         |                                                   |
| TTYPE                                     | Todo           | WILL               | DO                 | Allows the client to send its name to the server.                                                                                                                                                                                                                        |                                                   |
| STARTTLS                                  | Unsupported    | WONT               | DO                 | This option allows to upgrade any existing connection to a secure one. However, we don't support this intentionally and recommend you to initialize a secure connection from the beginning.                                                                              | https://github.com/unitopia-de/webmud3/issues/113 |
| XDISPLOC                                  | Unsupported    | WONT               | DO                 | Crazy option to redirect graphical output directly to a X display. Probably not used by Unitopia.                                                                                                                                                                        |                                                   |
| TSPEED (Terminal Speed)                   | Unsupported    | WONT               | DO                 | Allows the client to report its connection speed (in baud) to the server, which can adjust data transmission rates accordingly. Although we do not support this option now, it could be valuable, especially for managing data flow over unstable or mobile connections. |                                                   |
| ENVIRON                                   | Unsupported    | WONT               | DO                 | Allows the client to send environment variables to the server. However, we don't support this option now.                                                                                                                                                                |                                                   |
| NEWENV                                    | Unsupported    | WONT               | DO                 | Never version of ENVIRON. Still unsupported.                                                                                                                                                                                                                             |                                                   |
| COMPRESS                                  | Unsupported    | WONT               | DO                 | LZW based compression. We dont need nor support this option now.                                                                                                                                                                                                         |                                                   |
| COMPRESS 2                                | Unsupported    | WONT               | DO                 | Compression based on zlib - which is better, but still not supported.                                                                                                                                                                                                    |                                                   |
| STATUS                                    | Unsupported    | DONT               | WILL               | Allows for comparisson of the status of the server and the client. Matches negotiated options. We dont support this option now.                                                                                                                                          |                                                   |
| AUTH                                      | Unsupported    | WONT               | DO                 | We dont support any authentication options for now.                                                                                                                                                                                                                      |                                                   |
| MXP (Mud Extention Protocol)              | Unsupported    | WONT               | DO                 | We dont support the MXP option for now, but we want to support this option in the future.                                                                                                                                                                                |                                                   |
| GMCP (Generic Mud Communication Protocol) | Unsupported    | WONT               | DO                 | We dont support the GMCP option for now, but we want to support this option in the future.                                                                                                                                                                               |                                                   |

## How to handle a new option

Define a new TelnetOptionHandler object for the option you want to handle.

```typescript
const newOptionHandler: TelnetOptionHandler = {
  negotiate: (socket) => {
    // In this handler you can send a negotiation yourself uppon initialization.
    // Use this if you want the server to enable/disable the option.
  },
  handleDo: (socket, getPreviousNegotiation?) => {
    // Handle the DO command for the new option
    // Return a TelnetNegotiationResult object with the appropriate control sequence and subnegotiation result
  },
  handleDont: (socket, getPreviousNegotiation?) => {
    // Handle the DON'T command for the new option
    // Return a TelnetNegotiationResult object with the appropriate control sequence and subnegotiation result
  },
  handleWill: (socket, getPreviousNegotiation?) => {
    // Handle the WILL command for the new option
    // Return a TelnetNegotiationResult object with the appropriate control sequence and subnegotiation result
  },
  handleWont: (socket, getPreviousNegotiation?) => {
    // Handle the WON'T command for the new option
    // Return a TelnetNegotiationResult object with the appropriate control sequence and subnegotiation result
  },
  handleSub: (socket, serverChunk: Buffer) => {
    // Handle the subnegotiation data for the new option
    // Return a TelnetSubnegotiationResult object with the appropriate client chunk and client option
  },

  // Whether this handler is dynamic and can be called again after initial negotiation
  isDynamic?: boolean,
};
```

_Note_: If you mark an option handler as dynamic, it will be called again after the initial negotiation with the server if the server requests a change to the option. This allows for more flexible and dynamic negotiation of Telnet options between the client and server.

Add the `newOptionHandler` object to the optionsHandler map in your TelnetClient class:

```typescript
this.optionsHandler.set(TelnetOptions.TELOPT_LINEMODE, newOptionHandler);
```

### Accessing Previous Negotiation State

In some cases, you may need to access the previous negotiation state to determine how to respond to a new negotiation command. The `TelnetOptionHandler` provides a way to do this through the `getPreviousNegotiation` function.

The `getPreviousNegotiation` function returns the previous negotiation result, which can be used to determine the current state of the option. This can be useful in cases where the client needs to respond differently depending on the previous state of the option.

Here is an example of how to use `getPreviousNegotiation` in a `TelnetOptionHandler`:

```typescript
const newOptionHandler: TelnetOptionHandler = {
  // ...
  handleDo: (getPreviousNegotiation: () => TelnetNegotiationResult | undefined) => {
    const previousNegotiation = getPreviousNegotiation();
    if (previousNegotiation?.client !== undefined) {
      // Handle the case where the option is already enabled
    } else {
      // Handle the case where the option is not enabled
    }
  },
  // ...
};
```
