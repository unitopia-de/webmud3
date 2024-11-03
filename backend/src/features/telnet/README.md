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

| Telnet Option                      | Client Support            | Client Negotiation | Remarks                                                                                                                                                                                                                    | Discussion                                        |
| ---------------------------------- | ------------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| NAWS (Negotiate About Window Size) | Partial                   | WILL (+ Sub)       | We support this option to subnegotiate the window size. However, we send static values <br>for the window size (80x25) and it does look like Unitopia is ignoring these values.                                            | https://github.com/unitopia-de/webmud3/issues/108 |
| CHARSET                            | Partial                   | WILL (+ Sub)       | We support this option to subnegotiate the character set with the server. <br>However, we only accept UTF-8. If the server does not subnogitiate <br>for UTF-8, an error will be thrown and the connection will be closed. | https://github.com/unitopia-de/webmud3/issues/111 |
| ECHO                               | Full                      | Dynamic            | Is used in the telnet login flow to hide user input (password)                                                                                                                                                             |                                                   |
| SGA (Suppress Go Ahead)            | Todo                      |                    |                                                                                                                                                                                                                            | https://github.com/unitopia-de/webmud3/issues/115 |
| LINEMODE                           | Todo                      |                    |                                                                                                                                                                                                                            | https://github.com/unitopia-de/webmud3/issues/114 |
| STARTTLS                           | Intentionally Unsupported | WONT               | This option allows to upgrade any existing connection to a secure one. However, we <br>don't support this intentionally and recommend you to initialize a secure <br>connection from the beginning.                        | https://github.com/unitopia-de/webmud3/issues/113 |
| EOR (End of Record)                | Todo                      |                    |                                                                                                                                                                                                                            |                                                   |

## How to handle a new option

Define a new TelnetOptionHandler object for the option you want to handle.

```typescript
const newOptionHandler: TelnetOptionHandler = {
  negotiate: () => {
    // In this handler you can send a negotiation yourself uppon initialization.
    // Use this if you want the server to enable/disable the option.
  }
  handleDo: () => {
    // Handle the DO command for the new option
    // Return a TelnetNegotiationResult object with the appropriate control sequence and subnegotiation result
  },
  handleDont: () => {
    // Handle the DON'T command for the new option
    // Return a TelnetNegotiationResult object with the appropriate control sequence and subnegotiation result
  },
  handleWill: () => {
    // Handle the WILL command for the new option
    // Return a TelnetNegotiationResult object with the appropriate control sequence and subnegotiation result
  },
  handleWont: () => {
    // Handle the WON'T command for the new option
    // Return a TelnetNegotiationResult object with the appropriate control sequence and subnegotiation result
  },
  handleSub: (serverChunk: Buffer) => {
    // Handle the subnegotiation data for the new option
    // Return a TelnetSubnegotiationResult object with the appropriate client chunk and client option
  },
};
```

Add the `newOptionHandler` object to the optionsHandler map in your TelnetClient class:

```typescript
this.optionsHandler.set(TelnetOptions.TELOPT_LINEMODE, newOptionHandler);
```
