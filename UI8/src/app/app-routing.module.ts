import { NgModule }              from '@angular/core';
import { RouterModule, Routes }  from '@angular/router';
import { NonPortalGuard } from './non-portal-guard';
import { OrbitComponent } from './nonportal/orbit/orbit.component';
import { Uni1993Component } from './nonportal/uni1993/uni1993.component'; 
import { UnitopiaComponent } from './nonportal/unitopia/unitopia.component';
 
 
const appRoutes: Routes = [
  /*{ path: 'login',  canActivate: [NonPortalGuard],component: LoginComponent },*/
  { path: 'orbit',   canActivate: [NonPortalGuard],component: OrbitComponent },
  { path: 'uni1993',   canActivate: [NonPortalGuard],component: Uni1993Component },
  /*{ path: 'portal',  canActivate: [PortalGuard],component: UnitopiaComponent },*/
  { path: '',       canActivate: [NonPortalGuard],component: UnitopiaComponent,  pathMatch: 'full' },
  { path: '**', redirectTo: '/'}
];
 
@NgModule({
  imports: [
    RouterModule.forRoot(
      appRoutes,
      { enableTracing: false } // <-- debugging purposes only
    )
  ],
  exports: [
    RouterModule
  ]
})
export class AppRoutingModule {}