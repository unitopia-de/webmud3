/**
 * Telnet options that can be negotiated.
 * @todo
 * Todo[myst]: Remove all special options that are not negotiated. Leave only the true ones and special ones, that
 * are negociated. See https://www.iana.org/assignments/telnet-options/telnet-options.xhtml for all the options.
 * Rename this to "SupportedTelnetOptions" after that.
 */
export enum TelnetOptions {
  /**
   * Interpret as subnegotiation.
   */
  SB = 250,

  /**
   * You may reverse the line.
   */
  GA = 249,

  /**
   * Erase the current line.
   */
  EL = 248,

  /**
   * Erase the current character.
   */
  EC = 247,

  /**
   * Are you there.
   */
  AYT = 246,

  /**
   * Abort output--but let program finish.
   */
  AO = 245,

  /**
   * Interrupt process--permanently.
   */
  IP = 244,

  /**
   * Break.
   */
  BREAK = 243,

  /**
   * Data mark--for connection cleaning.
   * Todo[myst] = This is a duplication of
   */
  DM = 242,

  /**
   * No operation.
   */
  NOP = 241,

  /**
   * End sub-negotiation.
   */
  SE = 240,

  /**
   * End of record (transparent mode).
   */
  EOR = 239,

  /**
   * Abort process.
   */
  ABORT = 238,

  /**
   * Suspend process.
   */
  SUSP = 237,

  /**
   * For telnet function calls.
   * Todo[myst] = What is this? Duplicates with DM (data mark)
   */
  // SYNCH = 242,

  /**
   * 8-bit data path.
   */
  TELOPT_BINARY = 0,

  /**
   * Echo.
   */
  TELOPT_ECHO = 1,

  /**
   * Prepare to reconnect.
   */
  TELOPT_RCP = 2,

  /**
   * Suppress go ahead.
   */
  TELOPT_SGA = 3,

  /**
   * Approximate message size.
   */
  TELOPT_NAMS = 4,

  /**
   * Give status.
   */
  TELOPT_STATUS = 5,

  /**
   * Timing mark.
   */
  TELOPT_TM = 6,

  /**
   * Remote controlled transmission and echo.
   */
  TELOPT_RCTE = 7,

  /**
   * Negotiate about output line width.
   */
  TELOPT_NAOL = 8,

  /**
   * Negotiate about output page size.
   */
  TELOPT_NAOP = 9,

  /**
   * Negotiate about CR disposition.
   */
  TELOPT_NAOCRD = 10,

  /**
   * Negotiate about horizontal tab stops.
   */
  TELOPT_NAOHTS = 11,

  /**
   * Negotiate about horizontal tab disposition.
   */
  TELOPT_NAOHTD = 12,

  /**
   * Negotiate about form feed disposition.
   */
  TELOPT_NAOFFD = 13,

  /**
   * Negotiate about vertical tab stops.
   */
  TELOPT_NAOVTS = 14,

  /**
   * Negotiate about vertical tab disposition.
   */
  TELOPT_NAOVTD = 15,

  /**
   * Negotiate about output LF disposition.
   */
  TELOPT_NAOLFD = 16,

  /**
   * Extended ASCII character set.
   */
  TELOPT_XASCII = 17,

  /**
   * Force logout.
   */
  TELOPT_LOGOUT = 18,

  /**
   * Byte macro.
   */
  TELOPT_BM = 19,

  /**
   * Data entry terminal.
   */
  TELOPT_DET = 20,

  /**
   * SUPDUP protocol.
   */
  TELOPT_SUPDUP = 21,

  /**
   * SUPDUP output.
   */
  TELOPT_SUPDUPOUTPUT = 22,

  /**
   * Send location.
   */
  TELOPT_SNDLOC = 23,

  /**
   * Terminal type.
   */
  TELOPT_TTYPE = 24,

  /**
   * End of record.
   */
  TELOPT_EOR = 25,

  /**
   * TACACS user identification.
   */
  TELOPT_TUID = 26,

  /**
   * Output marking.
   */
  TELOPT_OUTMRK = 27,

  /**
   * Terminal location number.
   */
  TELOPT_TTYLOC = 28,

  /**
   * Negotiate about window size.
   */
  TELOPT_NAWS = 31,

  /**
   * Terminal speed.
   */
  TELOPT_TSPEED = 32,

  /**
   * Remote flow control.
   */
  TELOPT_LFLOW = 33,

  /**
   * Linemode.
   */
  TELOPT_LINEMODE = 34,

  /**
   * X display location.
   */
  TELOPT_XDISPLOC = 35,

  /**
   * Environment option.
   */
  TELOPT_ENVIRON = 36,

  /**
   * Authentication option.
   */
  TELOPT_AUTHENTICATION = 37,

  /**
   * Encryption option.
   */
  TELOPT_ENCRYPT = 38,

  /**
   * New environment option.
   */
  TELOPT_NEWENV = 39,

  /**
   * Charset option.
   */
  TELOPT_CHARSET = 42,

  /**
   * Start TLS option.
   */
  TELOPT_STARTTLS = 46,

  /**
   * MSSP option.
   */
  TELOPT_MSSP = 70,

  /**
   * Compression option.
   */
  TELOPT_COMPRESS = 85,

  /**
   * MCCP (Mud Client Compression Protocol).
   */
  TELOPT_MCCP = 86,

  /**
   * MSP option.
   */
  TELOPT_MSP = 90,

  /**
   * MXP option.
   */
  TELOPT_MXP = 91,

  /**
   * ZMP option.
   */
  TELOPT_ZMP = 93,

  /**
   * MUSH client option.
   */
  TELOPT_MUSHCLIENT = 102,

  /**
   * ATCP option.
   */
  TELOPT_ATCP = 200,

  /**
   * GMCP option.
   */
  TELOPT_GMCP = 201,

  /**
   * Extended options list.
   */
  TELOPT_EXOPL = 255,
}
