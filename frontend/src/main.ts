import { enableProdMode } from '@angular/core';

import { environment } from './environments/environment';
import {
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from 'src/app/app.component';

if (environment.production) {
  enableProdMode();
}

bootstrapApplication(AppComponent, {
  providers: [
    provideHttpClient(withInterceptorsFromDi()), // war früher in providers[]
  ],
}).catch((err) => console.error(err));
