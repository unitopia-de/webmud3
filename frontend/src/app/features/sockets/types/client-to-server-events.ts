export interface ClientToServerEvents {
  mudConnect: () => void;
  mudDisconnect: () => void;
  mudInput: (data: string) => void;
}
