import { Injectable } from '@angular/core';
import { PageEvent } from '@angular/material/paginator';
import { SearchLogData } from './searchlog-data';
import { HttpClient } from '@angular/common/http';
import { ServerConfigService } from '../shared/server-config.service';
import { ViewLogData } from './viewlog-data';

@Injectable({
  providedIn: 'root'
})
export class LogapiService {
  public debuglevel : string[] = ['TRACE','DEBUG','INFO','LOG','WARN','ERROR','FATAL','OFF'];
  public sortBy = [
    {txt:'ID absteigend',key:'seqdesc'},
    {txt:'ID aufsteigend',key:'seqasc'},
    {txt:'Zeitstempel absteigend',key:'tsdesc'},
    {txt:'Zeitstempel aufsteigend',key:'tsasc'},
  ];
  public selectedDebugLevel : boolean[] = [true,true,true,true,true,true,true,true,];
  public len : number = 0;
  public pageSize : number = 10;
  public pageIndex : number = 0;
  public viewlog : ViewLogData[] = [];
  public sdata : SearchLogData = new SearchLogData();

  doRefresh() {
    var ix;
    var other = this;
    this.sdata.iLevelList = [];
    if (this.sdata.idFrom == 0) this.sdata.idFrom = undefined;
    if (this.sdata.idTo == 0) this.sdata.idTo = undefined;
    if (this.sdata.tsFrom == "") this.sdata.tsFrom= undefined;
    if (this.sdata.tsTo == "") this.sdata.tsTo= undefined;
    if (this.sdata.filename == "") this.sdata.filename = undefined;
    if (this.sdata.filenameLike == "") this.sdata.filenameLike= undefined;
    if (this.sdata.real_ip == "") this.sdata.real_ip= undefined;
    if (this.sdata.messageLike == "") this.sdata.messageLike= undefined;
    if (this.sdata.orderby == "") this.sdata.orderby = 'seqdesc';
    for (ix=0;ix<this.selectedDebugLevel.length;ix++) {
      if (this.selectedDebugLevel[ix]) {
        this.sdata.iLevelList.push(ix);
      }
    }
    return this.http.post(this.srvcfg.getApiUrl() + 'debuglog/search', {
      searchParam: other.sdata,
      limit: other.pageSize,
      offset: other.pageIndex * other.pageSize,
    }, {
      withCredentials: true
    }).subscribe((resp: any) => {
      other.viewlog = resp.data;
      other.len = resp.count.cnt;
      console.log('search: ',resp);
    },(error:any) => {
      console.error('search: ',error);
    },() => {
    });
  }
  fetchLogEntry(id:number) {
    var i=0,ix=-1;
    var other = this;
    for(i=0;i<this.viewlog.length;i++) {
      if (this.viewlog[i].id == id) {
        ix = i; break;
      }
    }
    if (ix < 0 || typeof this.viewlog[ix].additional !== 'undefined') {
      return;
    }
    return this.http.get(this.srvcfg.getApiUrl() + 'debuglog/search?logentryid='+id, {
      withCredentials: true
    }).subscribe( (data) => {
      other.viewlog[ix].additional = data['additional'];
    }, (errorResp)=> {
      console.error(errorResp);
    })
  }
  
  doPageEvent(event:PageEvent) {
    // this.len = event.length;
    this.pageSize = event.pageSize;
    this.pageIndex = event.pageIndex;
    this.doRefresh();
  }

  constructor(private http: HttpClient,private srvcfg:ServerConfigService) { }
}
