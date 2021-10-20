import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  Output,
  ViewChild,
  EventEmitter, Input
} from '@angular/core';
import { CustomAnimation } from '../../common/domain/custom-animation';
import { WithDestroy } from '../../common/with-destroy';
import { Observable } from 'rxjs';
import { Orbit } from '../../common/domain/space-objects/orbit';
import { SpaceObject } from '../../common/domain/space-objects/space-object';
import { SpaceObjectType } from '../../common/domain/space-objects/space-object-type';
import { CameraService } from '../../services/camera.service';
import { Icons } from '../../common/domain/icons';
import { SpaceObjectService } from '../../services/space-object.service';
import { MatDialog } from '@angular/material/dialog';
import { AnalyticsService } from '../../services/analytics.service';
import { HudService } from '../../services/hud.service';
import { StateService } from '../../services/state.service';
import { filter, takeUntil } from 'rxjs/operators';
import { CameraComponent } from '../camera/camera.component';
import { EventLogs } from '../../services/event-logs';
import {
  CelestialBodyDetailsDialogComponent,
  CelestialBodyDetailsDialogData
} from '../../overlays/celestial-body-details-dialog/celestial-body-details-dialog.component';
import { GlobalStyleClass } from '../../common/GlobalStyleClass';

@Component({
  selector: 'cp-universe-map',
  templateUrl: './universe-map.component.html',
  styleUrls: ['./universe-map.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [CustomAnimation.fade],
})
export class UniverseMapComponent extends WithDestroy() {

  @Input() allowEdit = true;

  @Output() update = new EventEmitter<SpaceObject>();
  @Output() startDrag = new EventEmitter<SpaceObject>();
  @Output() hoverBody = new EventEmitter<{body: SpaceObject, hover: boolean}>();

  orbits$: Observable<Orbit[]>;
  celestialBodies$: Observable<SpaceObject[]>;

  spaceObjectTypes = SpaceObjectType;
  scaleToShowMoons = CameraService.scaleToShowMoons;

  icons = Icons;

  @ViewChild(CameraComponent, {static: true}) camera: CameraComponent;
  @ViewChild('screen', {static: true}) screen: ElementRef<HTMLDivElement>;

  constructor(private cdr: ChangeDetectorRef,
              private spaceObjectService: SpaceObjectService,
              private dialog: MatDialog,
              private analyticsService: AnalyticsService,
              hudService: HudService,
              stateService: StateService,
              private cameraService: CameraService) {
    super();

    this.orbits$ = this.spaceObjectService.orbits$;
    this.celestialBodies$ = this.spaceObjectService.celestialBodies$;
  }

  startBodyDrag(body: SpaceObject, event: PointerEvent, screen: HTMLDivElement, camera: CameraComponent) {
    body.draggableHandle.startDrag(event, screen, () => this.updateUniverse(body), camera);

    this.analyticsService.logEvent('Drag body', {
      category: EventLogs.Category.CelestialBody,
      touch: event.pointerType === 'touch',
      details: {
        label: EventLogs.Sanitize.anonymize(body.label),
      },
    });

    this.startDrag.emit(body);
  }

  private updateUniverse(dragged: SpaceObject) {
    this.update.emit(dragged);

    window.requestAnimationFrame(() => this.cdr.markForCheck());
  }

  editCelestialBody(body: SpaceObject) {
    this.analyticsService.logEvent('Start edit body', {
      category: EventLogs.Category.CelestialBody,
      details: {
        label: EventLogs.Sanitize.anonymize(body.label),
      },
    });

    this.dialog.open(CelestialBodyDetailsDialogComponent, {
      data: {
        forbiddenNames: this.spaceObjectService.celestialBodies$.value.map(c => c.label),
        edit: body,
      } as CelestialBodyDetailsDialogData,
      backdropClass: GlobalStyleClass.MobileFriendly,
    })
      .afterClosed()
      .pipe(
        filter(details => details),
        takeUntil(this.destroy$))
      .subscribe(details => {
        this.spaceObjectService.editCelestialBody(body, details);
        this.cdr.markForCheck();
      });
  }

  focusBody(body: SpaceObject, event: PointerEvent) {
    this.cameraService.focusSpaceObject(body, event.pointerType === 'touch');

    this.analyticsService.logEvent(
      `Focus body with double tap or click`, {
        category: EventLogs.Category.Camera,
        touch: event.pointerType === 'touch',
        body: EventLogs.Sanitize.anonymize(body.label),
      });
  }

}
