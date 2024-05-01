export interface MudListItem {
  key: string;
  name: string;
  host: string;
  port: number;
  ssl: boolean;
  rejectUnauthorized: boolean;
  description: string;
  playerlevel: string;
  mudfamily: string;
}
