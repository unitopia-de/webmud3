import { NgModule }              from '@angular/core';
import { RouterModule, Routes }  from '@angular/router';
import { NonPortalGuard } from './non-portal-guard';
import { PortalGuard } from './portal-guard';
import { LoginComponent } from './nonportal/login/login.component';
import { OrbitComponent } from './nonportal/orbit/orbit.component';
import { UnitopiaComponent } from './nonportal/unitopia/unitopia.component';
 
 
const appRoutes: Routes = [
  /*{ path: 'login',  canActivate: [NonPortalGuard],component: LoginComponent },*/
  { path: 'orbit',   canActivate: [NonPortalGuard],component: OrbitComponent },
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