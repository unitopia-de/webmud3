import { Inject, NgModule,Component } from '@angular/core';
import { Routes, RouterModule, ROUTES } from '@angular/router';
import { OrbitComponent } from './nonportal/orbit/orbit.component';
import { Uni1993Component } from './nonportal/uni1993/uni1993.component';
import { UnitopiaComponent } from './nonportal/unitopia/unitopia.component';
import { DualComponent } from './nonportal/dual/dual.component';
import { SeifenblaseComponent } from './nonportal/seifenblase/seifenblase.component';
import { environment } from '../environments/environment'
import { MudConfigService } from './mud-config.service';

// const routes: Routes = (environment.webmud3home == 'seifenblase') ? [
//   { path: '',       /* canActivate: [NonPortalGuard], */component: SeifenblaseComponent,  pathMatch: 'full' },
//   { path: '**', redirectTo: '/'}
// ] : [
//   { path: 'orbit',   /* canActivate: [NonPortalGuard], */component: OrbitComponent },
//   { path: 'uni1993',   /* canActivate: [NonPortalGuard], */component: Uni1993Component },
//   // { path: 'seifenblase',   /* canActivate: [NonPortalGuard], */component: SeifenblaseComponent },
//   // { path: 'dual',   /* canActivate: [NonPortalGuard], */component: DualComponent },
//   /*{ path: 'portal',  canActivate: [PortalGuard],component: UnitopiaComponent },*/
//   { path: '',       /* canActivate: [NonPortalGuard], */component: UnitopiaComponent,  pathMatch: 'full' },
//   { path: '**', redirectTo: '/'}
// ];

const standardRoutes: Routes = [
  { path: '**', redirectTo: '/'}
];

@NgModule({
  imports: [
    RouterModule.forRoot(
      [],
      { onSameUrlNavigation: 'reload',
        enableTracing: false } // <-- debugging purposes only
    )
  ],
  providers: [
    {
      provide: ROUTES,
      useFactory: (mudcfg:MudConfigService) => {
        let routes: Routes = [];
        let mroutes = mudcfg.data.routes;
        let count = 0;
        let rootFlag = false;
        Object.keys(mroutes).forEach( (key:string) => {
          if (mroutes.hasOwnProperty(key) && key.startsWith("/")) {
            const path = key.substring(1);
            let component : any = undefined;
            switch (mroutes[key]) {
              case 'unitopia':
                component = UnitopiaComponent;
                break;
              case 'orbit':
                component = OrbitComponent;
                break;
              case 'uni1993':
                component = Uni1993Component;
                break;
              case 'seifenblase':
                component = SeifenblaseComponent;
                break;
              default:
                console.error("unknown mud route:",key,mroutes[key]);
                break;
            }
            if (typeof component !== 'undefined') {
              if (key === '/') {
                routes.push({
                  path,
                  component,
                  pathMatch: 'full'
                });
                rootFlag = true;
                } else {
                routes.push({
                  path,
                  component
                })
              }
            }
          }
        });
        if (!rootFlag) {
          console.error("No root node!");
        }
        return [
          ...routes,
          ...standardRoutes
        ];
      },
      deps:[MudConfigService],
      multi: true
    }
  ],
  exports: [RouterModule]
})
export class AppRoutingModule { }
