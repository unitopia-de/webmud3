export class SearchLogData {
    idFrom? : number;
    idTo? : number;
    tsFrom? : string;
    tsTo? : string;
    iLevelList? : number[];
    filename? : string;
    filenameLike? : string;
    real_ip? : string;
    messageLike? : string;
    orderby : string = 'seqdesc';
}

  // case 'idFrom': cond = 'id >= '+getParam(searchParam[name],'number'); break;
  // case 'idTo':   cond = 'id <= '+getParam(searchParam[name],'number'); break;
  // case 'tsFrom': cond = 'ts >= \''+getParam(searchParam[name],'string')+'\''; break;
  // case 'tsTo':   cond = 'ts <= \''+getParam(searchParam[name],'string')+'\''; break;
  // case 'ilevelList': cond = 'ilevel in '+getListParam(searchParam['ilevel'],'number');break;
  // case 'filename': cond = 'filename = \''+getParam(searchParam[name],'string')+'\''; break;
  // case 'filenameLike': cond = 'filename LIKE \''+getParam(searchParam[name],'string')+'\''; break;
  // case 'real_ip': cond = 'real_ip = \''+getParam(searchParam[name],'string')+'\''; break;
  // case 'messageLike': cond = 'message LIKE \''+getParam(searchParam[name],'string')+'\''; break;
  // orderby seqdesc oder seqasc