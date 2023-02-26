import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { distinctUntilChanged, filter, switchMap, take, takeUntil, tap, timer } from 'rxjs';
import { WithDestroy } from '../../../common/with-destroy';
import { UsableRoutes } from '../../../usable-routes';
import { AuthService } from '../../../services/auth.service';
import { MatDialog } from '@angular/material/dialog';
import { GlobalStyleClass } from '../../../common/global-style-class';
import { SimpleDialogComponent, SimpleDialogData } from '../../../overlays/simple-dialog/simple-dialog.component';
import { TutorialService } from '../../../services/tutorial.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { HudService } from '../../../services/hud.service';
import { EventLogs } from '../../../services/event-logs';
import { BuyMeACoffeeDialogComponent } from '../../../overlays/buy-me-a-coffee-dialog/buy-me-a-coffee-dialog.component';
import { AnalyticsService } from '../../../services/analytics.service';
import { RouteData } from '../../calculators-routing.module';
import { CommonModule } from '@angular/common';
import { PageDvPlannerComponent } from '../page-dv-planner/page-dv-planner.component';
import { PageSignalCheckComponent } from '../page-signal-check/page-signal-check.component';
import { HudComponent } from '../../../components/hud/hud.component';
import { MatBottomSheetModule } from "@angular/material/bottom-sheet";

let localStorageKeyFirstVisitDeprecated = 'ksp-visual-calculator-first-visit';
let localStorageKeyTutorialViewed = 'ksp-visual-calculator-tutorial-viewed';
let localStorageKeyLastSignInSuggestionDate = 'ksp-visual-calculator-last-sign-in-suggestion-date';

let minute = 60 * 1e3;

@Component({
  selector: 'cp-page-calculators',
  standalone: true,
  imports: [
    CommonModule,
    PageDvPlannerComponent,
    PageSignalCheckComponent,
    HudComponent,

    MatBottomSheetModule,
  ],
  templateUrl: './page-calculators.component.html',
  styleUrls: ['./page-calculators.component.scss']
})
export class PageCalculatorsComponent extends WithDestroy() {

  calculatorType: UsableRoutes;
  calculators = UsableRoutes;

  constructor(activatedRoute: ActivatedRoute,
              private authService: AuthService,
              private dialog: MatDialog,
              private snackBar: MatSnackBar,
              private tutorialService: TutorialService,
              private hudService: HudService,
              private analyticsService: AnalyticsService) {
    super();

    let routesMap = {
      [`${UsableRoutes.DvPlanner}`]: UsableRoutes.DvPlanner,
      [`${UsableRoutes.SignalCheck}`]: UsableRoutes.SignalCheck,
    };

    activatedRoute.data
      .pipe(takeUntil(this.destroy$))
      .subscribe((data: RouteData) =>
        this.calculatorType = routesMap[data.calculatorType]);

    // TODO: create EventsService to detect user actions between various services
    let userIconHasClicked = false;
    setTimeout(() =>
      document.querySelector('cp-user-profile > div')?.addEventListener('click', () => userIconHasClicked = true));

    timer(1000)
      .pipe(
        take(1),
        tap(() => {
          if (!localStorage.getItem(localStorageKeyFirstVisitDeprecated)) {
            localStorage.setItem(localStorageKeyFirstVisitDeprecated, true.toString());
            this.triggerFirstVisitDialog();
          }
        }),
        takeUntil(this.destroy$))
      .subscribe();

    this.authService.user$
      .pipe(
        distinctUntilChanged(),
        filter(u => !(u?.isCustomer)),
        switchMap(() => timer(7 * minute, 15 * minute)),
        switchMap(() => this.snackBar.open(
          'Would you like to support the developer?',
          'Yes',
          {duration: 10e3, panelClass: GlobalStyleClass.SnackbarPromoteFlash})
          .onAction()),
        tap(() => {
          this.analyticsService.logEvent('Call coffee dialog from Snackbar', {category: EventLogs.Category.Coffee});
          this.dialog.open(BuyMeACoffeeDialogComponent);
        }))
      .subscribe();
  }

  private triggerFirstVisitDialog() {
    this.dialog.open(SimpleDialogComponent, {
      disableClose: true,
      data: {
        title: 'First Visit?',
        descriptions: [
          'There is an orange quick-help button in the top-left corner that can explain the control scheme.',
          'You can start a detailed tutorial now, or if you prefer later, you can find it in the blue "Information" menu.',
          'This is a tool to help players visualize and solve their ideas in Kerbal Space Program. ',
        ],
        okButtonText: 'Start Tutorial',
        cancelButtonText: 'Skip',
        focusOk: true,
      } as SimpleDialogData,
    })
      .afterClosed()
      .pipe(
        tap(ok => !ok && this.snackBar.open('Check out the control scheme by clicking the orange help button',
          null, {duration: 15e3})),
        filter(ok => ok),
        takeUntil(this.destroy$))
      .subscribe(() => {
        localStorage.setItem(localStorageKeyTutorialViewed, true.toString());
        this.tutorialService.startFullTutorial(this.hudService.pageContext);
      });
  }

}
