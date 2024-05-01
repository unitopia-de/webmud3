import { GmcpConfig } from './gmcp-config';

export interface GmcpMenu {
  name: string;
  active: boolean;
  action: string;
  index: number;
  mud_id: string;
  cfg: GmcpConfig;
}
