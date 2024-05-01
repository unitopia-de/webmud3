import { GmcpMenu } from './gmcp-menu';

export class GmcpConfig {
  module_name = ''; // modulename and version
  version = '';
  mud_id = ''; // nud connection id.
  mud_family = ''; // mud family defines detail behavior.
  initial_menu: GmcpMenu = {
    action: '',
    active: false,
    name: '',
    mud_id: '',
    cfg: this,
    index: 0,
  };
  callback: any; //  callback for actions.
}
