export interface ServerToClientEvents {
  mudOutput: (data: string) => void;
  mudDisconnected: () => void;
  mudConnected: () => void;
  setEchoMode: (showEchos: boolean) => void;
  requestTimingMark: () => void;
}
