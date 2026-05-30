import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  HostListener,
  inject,
  OnDestroy,
  OnInit,
  signal,
  ViewChild,
} from '@angular/core';
import { combineLatest, Subscription } from 'rxjs';
import { map } from 'rxjs/operators';

import { MudSignalService } from '@webmud3/frontend/features/gmcp/signals/mud-signal.service';
import {
  MxpEntityService,
  MxpStatService,
  SelectionModeService,
} from '@webmud3/frontend/features/terminal';
import { OutputJumpService } from '@webmud3/frontend/features/terminal/output-jump.service';
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
  private readonly mxpStats = inject(MxpStatService);
  private readonly mxpEntities = inject(MxpEntityService);
  private readonly selectionMode = inject(SelectionModeService);
  private readonly outputJump = inject(OutputJumpService);

  /**
   * Click handler for the "Zum aktuellen Output springen" footer button.
   * Delegates to OutputJumpService; the actual scroll + screen-reader drain
   * happens in MudClientComponent.jumpToCurrentOutput.
   */
  public onJumpToCurrentOutput(): void {
    this.outputJump.requestJump();
  }

  /** True when the user has armed the two-tap range selection mode. */
  public readonly selectionActive = computed(
    () => this.selectionMode.state() !== 'inactive',
  );

  /** Tooltip that mirrors the current selection-mode phase. */
  public readonly selectionTooltip = computed(() => {
    switch (this.selectionMode.state()) {
      case 'awaiting-anchor':
        return 'Markieren: Startposition im Editor oder Ausgabefenster tippen';
      case 'awaiting-extend':
        return 'Markieren: Endposition tippen';
      case 'adjusting':
        return 'Markieren: Marker ziehen zum Feinjustieren, Button drücken zum Bestätigen';
      default:
        return 'Bereich markieren (zwei Taps)';
    }
  });

  /** Reactive view-model for the MXP status pills next to the vitals. */
  public readonly mxpDisplay$ = combineLatest([
    this.mxpStats.stats$,
    this.mxpEntities.entities$,
  ]).pipe(
    map(([stats, entities]) =>
      stats.map((s) => ({
        caption: s.caption ?? `${s.name}:`,
        value: entities.get(s.name) ?? '?',
        max: s.maxName !== undefined ? entities.get(s.maxName) : undefined,
      })),
    ),
  );

  @ViewChild('menuRoot') menuRoot?: ElementRef<HTMLElement>;

  public readonly menuItems$ = this.menu.items$;

  public readonly charName = signal<string>('');
  public readonly vitalsText = signal<string>('');
  public readonly status = signal<unknown>(null);
  public readonly menuOpen = signal<boolean>(false);
  /** Id of the currently open submenu, or null if none is expanded. */
  public readonly openSubmenuId = signal<string | null>(null);
  /** True for a short window after a vitals change so the value flashes red. */
  public readonly vitalsFlash = signal<boolean>(false);

  private readonly subscriptions: Subscription[] = [];
  private vitalsFlashTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    this.subscriptions.push(
      this.signals
        .on('Char.Name')
        .subscribe((s) => this.charName.set(s.fullName)),
      this.signals
        .on('Char.Vitals')
        .subscribe((s) => this.handleVitals(s.text ?? '')),
      this.signals.on('Char.Status').subscribe((s) => this.status.set(s.data)),
    );
  }

  ngOnDestroy(): void {
    for (const sub of this.subscriptions) {
      sub.unsubscribe();
    }
    if (this.vitalsFlashTimer !== null) {
      clearTimeout(this.vitalsFlashTimer);
      this.vitalsFlashTimer = null;
    }
  }

  /**
   * Stores the new vitals text and — if it differs from the previous value —
   * triggers a one-second red flash. The first server push (previous == '')
   * deliberately does not flash; otherwise every login would trigger the
   * effect for no reason.
   */
  private handleVitals(next: string): void {
    const previous = this.vitalsText();
    this.vitalsText.set(next);

    if (!next || previous === '' || previous === next) {
      return;
    }

    if (this.vitalsFlashTimer !== null) {
      clearTimeout(this.vitalsFlashTimer);
    }
    this.vitalsFlash.set(true);
    // 700ms class + 300ms CSS transition back to default = ~1s total.
    this.vitalsFlashTimer = setTimeout(() => {
      this.vitalsFlash.set(false);
      this.vitalsFlashTimer = null;
    }, 700);
  }

  public toggleMenu(event: Event): void {
    event.stopPropagation();
    const willOpen = !this.menuOpen();
    this.menuOpen.set(willOpen);
    if (!willOpen) {
      this.openSubmenuId.set(null);
    }
  }

  public toggleSelection(event: Event): void {
    event.stopPropagation();
    this.selectionMode.toggle();
  }

  /** Opens / closes a submenu without closing the parent dropdown. */
  public toggleSubmenu(event: Event, id: string): void {
    event.stopPropagation();
    this.openSubmenuId.update((current) => (current === id ? null : id));
  }

  public onMenuItemClick(action: (() => void) | undefined): void {
    action?.();
    this.menuOpen.set(false);
    this.openSubmenuId.set(null);
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
      this.openSubmenuId.set(null);
    }
  }
}
