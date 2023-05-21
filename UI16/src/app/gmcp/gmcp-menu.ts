import { GmcpConfig } from "./gmcp-config";

export class GmcpMenu {
    name : string = '';
    active : boolean = false;
    action : string = '';
    index : number = -1;
    mud_id : string = '';
    cfg : GmcpConfig;
}
