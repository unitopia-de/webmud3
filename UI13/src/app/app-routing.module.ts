import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { OrbitComponent } from './nonportal/orbit/orbit.component';
import { Uni1993Component } from './nonportal/uni1993/uni1993.component';
import { UnitopiaComponent } from './nonportal/unitopia/unitopia.component';
import { DualComponent } from './nonportal/dual/dual.component';

const routes: Routes = [
  { path: 'orbit',   /* canActivate: [NonPortalGuard], */component: OrbitComponent },
  { path: 'uni1993',   /* canActivate: [NonPortalGuard], */component: Uni1993Component },
  { path: 'dual',   /* canActivate: [NonPortalGuard], */component: DualComponent },
  /*{ path: 'portal',  canActivate: [PortalGuard],component: UnitopiaComponent },*/
  { path: '',       /* canActivate: [NonPortalGuard], */component: UnitopiaComponent,  pathMatch: 'full' },
  { path: '**', redirectTo: '/'}
];

@NgModule({
  imports: [
    RouterModule.forRoot(
      routes,
      { onSameUrlNavigation: 'reload',
        enableTracing: false } // <-- debugging purposes only
    )
  ],
  exports: [RouterModule]
})
export class AppRoutingModule { }
