import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  inject,
  OnDestroy,
  OnInit,
  signal,
  ViewChild,
} from '@angular/core';
import { Subscription } from 'rxjs';

import { MudSignalService } from '@webmud3/frontend/features/gmcp/signals/mud-signal.service';
import { FooterMenuService } from './footer-menu.service';

/**
 * Permanent footer at the bottom of the application.
 *
 * Left:   Character info (name, vitals, status) sourced from GMCP signals.
 * Right:  A menu button (gear) opening a dropdown with dynamically
 *         registered actions (see FooterMenuService).
 *
 * Components that want to expose toggles or actions in the footer menu
 * register themselves via FooterMenuService.register().
 */
@Component({
  selector: 'app-char-footer',
  templateUrl: './char-footer.component.html',
  styleUrls: ['./char-footer.component.scss'],
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CharFooterComponent implements OnInit, OnDestroy {
  private readonly signals = inject(MudSignalService);
  private readonly menu = inject(FooterMenuService);

  @ViewChild('menuRoot') menuRoot?: ElementRef<HTMLElement>;

  public readonly menuItems$ = this.menu.items$;

  public readonly charName = signal<string>('');
  public readonly vitalsText = signal<string>('');
  public readonly status = signal<unknown>(null);
  public readonly menuOpen = signal<boolean>(false);

  private readonly subscriptions: Subscription[] = [];

  ngOnInit(): void {
    this.subscriptions.push(
      this.signals
        .on('Char.Name')
        .subscribe((s) => this.charName.set(s.fullName)),
      this.signals
        .on('Char.Vitals')
        .subscribe((s) => this.vitalsText.set(s.text ?? '')),
      this.signals.on('Char.Status').subscribe((s) => this.status.set(s.data)),
    );
  }

  ngOnDestroy(): void {
    for (const sub of this.subscriptions) {
      sub.unsubscribe();
    }
  }

  public toggleMenu(event: Event): void {
    event.stopPropagation();
    this.menuOpen.update((v) => !v);
  }

  public onMenuItemClick(action: () => void): void {
    action();
    this.menuOpen.set(false);
  }

  /** Closes the menu when clicking outside */
  @HostListener('document:pointerdown', ['$event'])
  public onDocumentPointerDown(event: PointerEvent): void {
    if (!this.menuOpen()) {
      return;
    }

    const target = event.target as Node;
    const root = this.menuRoot?.nativeElement;

    if (root && !root.contains(target)) {
      this.menuOpen.set(false);
    }
  }
}
