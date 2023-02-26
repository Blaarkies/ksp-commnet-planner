import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, ViewChild } from '@angular/core';
import { ActionOption } from '../../common/domain/action-option';
import { Icons } from '../../common/domain/icons';
import { HudService } from '../../services/hud.service';
import { AnalyticsService } from '../../services/analytics.service';
import { FaqDialogComponent, FaqDialogData } from '../../overlays/faq-dialog/faq-dialog.component';
import { MatDialog } from '@angular/material/dialog';
import { WithDestroy } from '../../common/with-destroy';
import { firstValueFrom, map, Observable, takeUntil } from 'rxjs';
import { ActionPanelColors, ActionPanelComponent } from '../action-panel/action-panel.component';
import { BreakpointObserver } from '@angular/cdk/layout';
import { MatBottomSheet, MatBottomSheetRef } from '@angular/material/bottom-sheet';
import {
  ActionBottomSheetComponent,
  ActionBottomSheetData
} from '../../overlays/list-bottom-sheet/action-bottom-sheet.component';
import { GlobalStyleClass } from '../../common/global-style-class';
import { EventLogs } from '../../services/event-logs';
import { UsableRoutes } from '../../usable-routes';
import { BuyMeACoffeeDialogComponent } from '../../overlays/buy-me-a-coffee-dialog/buy-me-a-coffee-dialog.component';
import { AuthService } from '../../services/auth.service';
import { BasicAnimations } from '../../common/animations/basic-animations';
import { DomPortal } from '@angular/cdk/portal';
import { ThemeService, ThemeTypeEnum } from '../../services/theme.service';
import { CommonModule } from '@angular/common';
import { ActionFabComponent } from './action-fab/action-fab.component';
import { UserProfileComponent } from '../user-profile/user-profile.component';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatBadgeModule } from '@angular/material/badge';
import { ZoomIndicatorComponent } from '../zoom-indicator/zoom-indicator.component';
import { FocusJumpToPanelComponent } from '../focus-jump-to-panel/focus-jump-to-panel.component';
import { ManeuverSequencePanelComponent } from '../maneuver-sequence-panel/maneuver-sequence-panel.component';
import { NegatePipe } from '../../common/negate.pipe';
import { ManageStateDialogComponent } from "../../overlays/manage-state-dialog/manage-state-dialog.component";

export class ActionPanelDetails {
  startTitle?: string;
  color: ActionPanelColors;
  startIcon: Icons;
  options: ActionOption[];
}

export class ActionGroupType {
  static General = 'general';
  static Information = 'information';
  static Context = 'context';
}

@Component({
  selector: 'cp-hud',
  standalone: true,
  imports: [
    CommonModule,
    ActionFabComponent,
    ActionPanelComponent,
    UserProfileComponent,
    FocusJumpToPanelComponent,
    ManeuverSequencePanelComponent,
    ZoomIndicatorComponent,
    NegatePipe,
    MatBadgeModule,
    MatButtonModule,
    MatIconModule,

    ManageStateDialogComponent,
  ],
  templateUrl: './hud.component.html',
  styleUrls: ['./hud.component.scss'],
  animations: [BasicAnimations.fade],
})
export class HudComponent extends WithDestroy() implements AfterViewInit {

  navigationOptions = this.hudService.navigationOptions;
  infoOptions = this.hudService.infoOptions;

  get contextPanel$(): Observable<ActionPanelDetails> {
    return this.hudService.contextPanel$.asObservable();
  }

  context$ = this.hudService.context$;
  contextTypes = UsableRoutes;

  isHandset$: Observable<boolean>;
  icons = Icons;
  actionGroupTypes = ActionGroupType;
  pageContextInfo: { icon, tooltip };
  hasBoughtCoffee$ = this.auth.user$.pipe(map(u => u?.isCustomer));

  lastTheme: string;
  themeIconMap = {
    [ThemeTypeEnum.Light]: Icons.ThemeLight,
    [ThemeTypeEnum.Dark]: Icons.ThemeDark,
  };

  constructor(private hudService: HudService,
              private analyticsService: AnalyticsService,
              private auth: AuthService,
              private dialog: MatDialog,
              breakpointObserver: BreakpointObserver,
              private bottomSheet: MatBottomSheet,
              private cdr: ChangeDetectorRef,
              private themeService: ThemeService) {
    super();

    this.lastTheme = themeService.currentTheme;

    this.isHandset$ = breakpointObserver.observe([
      '(max-width: 600px)',
      '(max-height: 800px)',
    ])
      .pipe(map(bp => bp.matches));

    let contextVisualMap = {
      [UsableRoutes.DvPlanner]: {
        icon: Icons.DeltaV,
        tooltip: 'This page handles Delta-v calculations, click the green menu for others',
      },
      [UsableRoutes.SignalCheck]: {
        icon: Icons.Relay,
        tooltip: 'This page handles CommNet calculations, click the green menu for others',
      }
    };

    hudService.pageContextChange$
      .pipe(takeUntil(this.destroy$))
      .subscribe(context => this.pageContextInfo = contextVisualMap[context]);
  }

  ngAfterViewInit() {
    this.cdr.detectChanges();
  }

  toggleTheme() {
    this.lastTheme = this.themeService.toggleTheme();
  }

  openFaq() {
    this.analyticsService.logEvent('Open faq dialog', {
      category: EventLogs.Category.Help,
    });

    this.dialog.open(FaqDialogComponent, {
      data: {} as FaqDialogData,
      backdropClass: GlobalStyleClass.MobileFriendly,
    });
  }

  async openBottomSheet(group: ActionGroupType, updateUnreadCountCallback: () => void) {
    let result: MatBottomSheetRef;
    switch (group) {
      case ActionGroupType.General:
        result = await this.bottomSheet.open(ActionBottomSheetComponent, {
          data: {
            startTitle: 'KSP Visual Calculator',
            actionOptions: this.navigationOptions,
          } as ActionBottomSheetData,
          panelClass: ['bottom-sheet-panel', 'green'],
        });
        break;
      case ActionGroupType.Information:
        result = await this.bottomSheet.open(ActionBottomSheetComponent, {
          data: {
            startTitle: 'Information',
            actionOptions: this.infoOptions,
          } as ActionBottomSheetData,
          panelClass: ['bottom-sheet-panel', 'cosmic-blue'],
        });
        break;
      case ActionGroupType.Context:
        let panel = await firstValueFrom(this.contextPanel$);
        result = await this.bottomSheet.open(ActionBottomSheetComponent, {
          data: {
            startTitle: panel.startTitle,
            actionOptions: panel.options,
          } as ActionBottomSheetData,
          panelClass: ['bottom-sheet-panel', 'orange'],
        });
        break;
      default:
        throw new Error(`No bottom-sheet defined for "${group}"`);
    }

    await firstValueFrom(result?.afterDismissed());

    updateUnreadCountCallback();
  }

  openBuyMeACoffee() {
    this.analyticsService.logEvent('Call coffee dialog from hud', {
      category: EventLogs.Category.Coffee,
    });

    this.dialog.open(BuyMeACoffeeDialogComponent);
  }

}
