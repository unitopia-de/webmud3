import { LinemodeState } from '../../../features/telnet/utils/handle-linemode-option.js';

export interface ServerToClientEvents {
  mudOutput: (data: string) => void;
  mudDisconnected: () => void;
  mudConnected: () => void;
  setEchoMode: (showEchos: boolean) => void;
  requestTimingMark: (callback: () => void) => void;
  setLinemode: (state: LinemodeState) => void;
}
