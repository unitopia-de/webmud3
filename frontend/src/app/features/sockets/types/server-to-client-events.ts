import { LinemodeState } from './linemode-state';

export interface ServerToClientEvents {
  mudOutput: (data: string) => void;
  mudDisconnected: () => void;
  mudConnected: () => void;
  setEchoMode: (showEchos: boolean) => void;
  requestTimingMark: (callback: () => void) => void;
  setLinemode: (state: LinemodeState) => void;
}
