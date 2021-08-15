import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import {InputTextModule} from 'primeng/inputtext';
import {CaptchaModule} from 'primeng/captcha';
import {ButtonModule} from 'primeng/button';
import {MessagesModule} from 'primeng/messages';
import {MessageModule} from 'primeng/message';
import {StepsModule} from 'primeng/steps';
import {RadioButtonModule} from 'primeng/radiobutton';
import {CheckboxModule} from 'primeng/checkbox';
import {DropdownModule} from 'primeng/dropdown';

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    InputTextModule,
    CaptchaModule,
    ButtonModule,
    MessagesModule,
    StepsModule,
    RadioButtonModule,
    CheckboxModule,
    DropdownModule,
    MessageModule
  ],
  exports: [
    InputTextModule,
    CaptchaModule,
    ButtonModule,
    MessagesModule,
    StepsModule,
    RadioButtonModule,
    CheckboxModule,
    DropdownModule,
    MessageModule
  ]
})
export class PrimeModule { }
