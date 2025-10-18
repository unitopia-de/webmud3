export interface ClientToServerEvents {
  mudConnect: (initialViewPort: { columns: number; rows: number }) => void;
  mudDisconnect: () => void;
  mudInput: (data: string) => void;
  mudViewportSize: (columns: number, rows: number) => void;
}
