import { GmcpMenu } from './gmcp-menu';

export class GmcpConfig {
  module_name: string = ''; // modulename and version
  version: string = '';
  mud_id: string = ''; // nud connection id.
  mud_family: string = ''; // mud family defines detail behavior.
  initial_menu: GmcpMenu = new GmcpMenu();
  callback: any; //  callback for actions.
}
