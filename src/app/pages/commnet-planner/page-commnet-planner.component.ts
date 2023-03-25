import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { MatBottomSheetModule } from '@angular/material/bottom-sheet';
import { MatDialog } from '@angular/material/dialog';
import {
  combineLatest,
  delayWhen,
  filter,
  map,
  Observable,
  startWith,
  takeUntil,
} from 'rxjs';
import { BasicAnimations } from '../../animations/basic-animations';
import { ActionOption } from '../../common/domain/action-option';
import { AntennaSignal } from '../../common/domain/antenna.signal';
import { GameStateType } from '../../common/domain/game-state-type';
import { Icons } from '../../common/domain/icons';
import { Craft } from '../../common/domain/space-objects/craft';
import { Orbit } from '../../common/domain/space-objects/orbit';
import { SpaceObject } from '../../common/domain/space-objects/space-object';
import { GlobalStyleClass } from '../../common/global-style-class';
import { WithDestroy } from '../../common/with-destroy';
import { DraggableSpaceObjectComponent } from '../../components/draggable-space-object/draggable-space-object.component';
import { FocusJumpToPanelComponent } from '../../components/focus-jump-to-panel/focus-jump-to-panel.component';
import {
  ActionPanelDetails,
  HudComponent,
} from '../../components/hud/hud.component';
import { UniverseMapComponent } from '../../components/universe-map/universe-map.component';
import { ZoomIndicatorComponent } from '../../components/zoom-indicator/zoom-indicator.component';
import { AnalyticsService } from '../../services/analytics.service';
import { AuthService } from '../../services/auth.service';
import { EventLogs } from '../../services/domain/event-logs';
import { HudService } from '../../services/hud.service';
import { AbstractStateService } from '../../services/state.abstract.service';
import { AbstractUniverseBuilderService } from '../../services/universe-builder.abstract.service';
import { UniverseContainerInstance } from '../../services/universe-container-instance.service';
import { AntennaSignalComponent } from './components/antenna-signal/antenna-signal.component';
import {
  CraftDetailsDialogComponent,
  CraftDetailsDialogData,
} from './components/craft-details-dialog/craft-details-dialog.component';
import { DifficultySettingsDialogComponent } from './components/difficulty-settings-dialog/difficulty-settings-dialog.component';
import { CommnetStateService } from './services/commnet-state.service';
import { CommnetUniverseBuilderService } from './services/commnet-universe-builder.service';

@Component({
  selector: 'cp-page-commnet-planner',
  standalone: true,
  imports: [
    CommonModule,
    UniverseMapComponent,
    AntennaSignalComponent,
    DraggableSpaceObjectComponent,
    HudComponent,

    MatBottomSheetModule,
    ZoomIndicatorComponent,
    FocusJumpToPanelComponent,
  ],
  providers: [
    CommnetUniverseBuilderService,
    CommnetStateService,
    AuthService,
    HudService,
    {provide: AbstractUniverseBuilderService, useExisting: CommnetUniverseBuilderService},
    {provide: AbstractStateService, useExisting: CommnetStateService},
  ],
  templateUrl: './page-commnet-planner.component.html',
  styleUrls: ['./page-commnet-planner.component.scss', '../temp.calculators.scss'],
  animations: [BasicAnimations.fade],
})
export default class PageCommnetPlannerComponent extends WithDestroy() {

  icons = Icons;
  contextPanelDetails: ActionPanelDetails;
  signals$: Observable<AntennaSignal[]>;
  crafts$: Observable<Craft[]>;
  orbits$: Observable<Orbit[]>;
  planets$: Observable<SpaceObject[]>;
  focusables$: Observable<SpaceObject[]>;

  constructor(private dialog: MatDialog,
              private analyticsService: AnalyticsService,
              private hudService: HudService,
              private commnetStateService: CommnetStateService,
              private commnetUniverseBuilderService: CommnetUniverseBuilderService) {
    super();

    this.contextPanelDetails = this.getContextPanelDetails();

    let universe = commnetUniverseBuilderService;
    this.signals$ = universe.signals$.stream$;
    this.crafts$ = universe.craft$.stream$;
    this.orbits$ = universe.orbits$;
    this.planets$ = universe.planets$;

    this.focusables$ = combineLatest([this.crafts$.pipe(startWith([])), this.planets$])
      .pipe(
        filter(([craft, planets]) => !!craft && !!planets),
        map(lists => lists.flatMap() as SpaceObject[]));
  }

  private getContextPanelDetails(): ActionPanelDetails {
    let options = [
      new ActionOption('New Craft', Icons.Craft, {
        action: () => {
          this.analyticsService.logEventThrottled(EventLogs.Name.CallNewCraftDialog, {
            category: EventLogs.Category.Craft,
          });

          let allCraft = this.commnetUniverseBuilderService.craft$.value;
          this.dialog.open(CraftDetailsDialogComponent, {
            data: {
              forbiddenNames: allCraft.map(c => c.label),
              universeBuilderHandler: this.commnetUniverseBuilderService,
            } as CraftDetailsDialogData,
            backdropClass: GlobalStyleClass.MobileFriendly,
          })
            .afterClosed()
            .pipe(
              filter(craftDetails => craftDetails),
              delayWhen(craftDetails => this.commnetUniverseBuilderService.addCraftToUniverse(craftDetails)),
              takeUntil(this.destroy$))
            .subscribe();
        },
      }),
      new ActionOption('Difficulty Settings', Icons.Difficulty, {
        action: () => {
          this.analyticsService.logEvent('Call difficulty settings dialog', {
            category: EventLogs.Category.Difficulty,
          });

          this.dialog.open(DifficultySettingsDialogComponent,
            {data: this.commnetUniverseBuilderService.difficultySetting})
            .afterClosed()
            .pipe(
              filter(details => details),
              takeUntil(this.destroy$))
            .subscribe(details =>
              this.commnetUniverseBuilderService.updateDifficultySetting(details));
        },
      }),
      this.hudService.createActionOptionTutorial(GameStateType.CommnetPlanner),
      this.hudService.createActionOptionManageSaveGames(ref => {
          let component = ref.componentInstance;
          component.context = GameStateType.CommnetPlanner;
          component.contextTitle = 'CommNet Planner';
          component.stateHandler = this.commnetStateService;
        },
      ),
      this.hudService.createActionOptionFaq(GameStateType.CommnetPlanner),
    ];

    return {
      startTitle: 'CommNet Planner',
      startIcon: Icons.OpenDetails,
      color: 'orange',
      options,
    };
  }

  updateUniverse(dragged: SpaceObject) {
    // todo: check if children in SOI feature have antennae
    if (dragged.antennae?.length) {
      this.commnetUniverseBuilderService.updateTransmissionLines();
    }
  }

  editCraft(craft: Craft) {
    this.analyticsService.logEvent('Start edit craft', {
      category: EventLogs.Category.Craft,
    });

    let allCraft = this.commnetUniverseBuilderService.craft$.value;
    this.dialog.open(CraftDetailsDialogComponent, {
      data: {
        forbiddenNames: allCraft.map(c => c.label),
        edit: craft,
        universeBuilderHandler: this.commnetUniverseBuilderService,
      } as CraftDetailsDialogData,
      backdropClass: GlobalStyleClass.MobileFriendly,
    })
      .afterClosed()
      .pipe(
        filter(details => details),
        delayWhen(details => this.commnetUniverseBuilderService.editCraft(craft, details)),
        takeUntil(this.destroy$))
      .subscribe();
  }

  editPlanet({body, details}) {
    this.commnetUniverseBuilderService.editCelestialBody(body, details);
  }

  trackSignal(index: number, item: AntennaSignal): string {
    return item.nodes[0].label + item.nodes[1].label;
  }

}
