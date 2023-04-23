import { state } from '@angular/animations';
import {
  Inject,
  Injectable,
} from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Observable } from 'rxjs';
import { CheckpointPreferences } from '../../../common/domain/checkpoint-preferences';
import { GameStateType } from '../../../common/domain/game-state-type';
import { AbstractUniverseStateService } from '../../../services/domain/universe-state.abstract.service';
import { DataService } from '../../../services/data.service';
import { StateCheckpoint } from '../../../services/json-interfaces/state-checkpoint';
import { StateDvPlanner } from '../../../services/json-interfaces/state-dv-planner';
import { StateUniverse } from '../../../services/json-interfaces/state-universe';
import { AUTO_SAVE_INTERVAL } from '../../mining-station/domain/config';
import { DvUniverseBuilderService } from './dv-universe-builder.service';
import { TravelService } from './travel.service';

@Injectable()
export class DvStateService extends AbstractUniverseStateService {

  protected context = GameStateType.DvPlanner;

  constructor(
    protected universeBuilderService: DvUniverseBuilderService,
    protected dataService: DataService,
    protected snackBar: MatSnackBar,
    @Inject(AUTO_SAVE_INTERVAL) protected autoSaveInterval,

    private travelService: TravelService,
  ) {
    super();
  }

  get stateContextual(): StateDvPlanner {
    let universe = super.stateContextual;
    return {
      ...universe,
      settings: {
        // TODO: get settings
        // ...state.settings,
        preferences: this.universeBuilderService.checkpointPreferences$.value,
      },
      checkpoints: this.travelService.checkpoints$.value
        .map(c => c.toJson()) as StateCheckpoint[],
    };
  }

  protected setStatefulDetails(parsedState: StateUniverse) {
    this.universeBuilderService.updateCheckpointPreferences(CheckpointPreferences.fromObject(parsedState.settings.preferences));
  }

  protected setStatelessDetails() {
    this.universeBuilderService.updateCheckpointPreferences(CheckpointPreferences.default);
  }

  protected buildExistingState(state: string): Observable<any> {
    return this.universeBuilderService.buildState(state);
  }

  protected buildFreshState(): Observable<any> {
    return this.universeBuilderService.buildStockState();
  }

}
