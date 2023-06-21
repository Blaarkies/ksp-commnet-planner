import { MatSnackBar } from '@angular/material/snack-bar';
import { Bytes } from '@firebase/firestore';
import {
  gzip,
  ungzip,
} from 'pako';
import {
  combineLatestWith,
  delayWhen,
  filter,
  firstValueFrom,
  from,
  map,
  Observable,
  Subject,
  takeUntil,
  tap,
  timer,
} from 'rxjs';
import { environment } from '../../../environments/environment';
import { GameStateType } from '../../common/domain/game-state-type';
import { Namer } from '../../common/namer';
import { Uid } from '../../common/uid';
import { StateEntry } from '../../overlays/manage-state-dialog/state-entry';
import { StateRow } from '../../overlays/manage-state-dialog/state-row';
import {
  CpError,
  DataService,
  UserData,
} from '../data.service';
import { StateBase } from '../json-interfaces/state-base';
import { StateContextual } from '../json-interfaces/state-contextual';

export abstract class AbstractBaseStateService {

  protected abstract context: GameStateType;
  protected abstract dataService: DataService;
  protected abstract snackBar: MatSnackBar;
  protected abstract autoSaveInterval: number;

  private id: string;
  private name: string;
  private lastStateRecord: string;
  private autoSaveStop$ = new Subject<void>();
  private destroy$ = new Subject<void>();

  setStateRecord() {
    this.lastStateRecord = JSON.stringify(this.stateContextual);
  }

  get hasPendingChanges(): boolean {
    return this.lastStateRecord
      && this.lastStateRecord !== JSON.stringify(this.stateContextual);
  }

  protected abstract get stateContextual(): StateContextual;

  get stateBase(): StateBase {
    return {
      id: this.id,
      name: this.name,
      timestamp: new Date(),
      context: this.context,
      version: environment.APP_VERSION.split('.').map(t => t.toNumber()),
    };
  }

  get stateRow(): StateRow {
    let {id, name, timestamp, version} = this.stateBase;
    return new StateRow({
      id, name, version,
      timestamp: {seconds: timestamp.getTime() * .001},
      state: JSON.stringify(this.stateContextual),
    });
  }

  // TODO: force a call on each page component
  destroy() {
    this.autoSaveStop$.next();
    this.autoSaveStop$.complete();
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadState(state?: StateBase): Observable<void> {
    let buildStateResult: Observable<void>;
    if (state && typeof state.state === 'string') {
      // @fix v1.2.6:webp format planet images introduced, but old savegames have .png in details
      let imageFormatFix = state.state.replace(/.png/g, '.webp');

      let parsedState: StateContextual = JSON.parse(imageFormatFix);
      this.id = state.id ?? state.name; // @fix v1.3.0:null check for ids did not previously exist
      this.name = state.name;
      this.setStatefulDetails(parsedState);
      buildStateResult = this.buildExistingState(imageFormatFix);
    } else {
      this.id = Uid.new;
      this.name = Namer.savegame;

      this.setStatelessDetails();
      buildStateResult = this.buildFreshState();
    }

    this.autoSaveStop$.next();
    buildStateResult.pipe(
      combineLatestWith(timer(this.autoSaveInterval, this.autoSaveInterval)),
      // TODO: block while handleUserSingIn() snackbar is open
      filter(() => {
        return this.hasPendingChanges;
      }),
      delayWhen(() => this.save()),
      takeUntil(this.autoSaveStop$),
      takeUntil(this.destroy$))
      .subscribe();

    return buildStateResult.pipe(tap(() => this.setStateRecord()));
  }

  protected abstract setStatefulDetails(parsedState: StateContextual)

  protected abstract setStatelessDetails()

  protected abstract buildExistingState(state: string): Observable<any>

  protected abstract buildFreshState(): Observable<any>

  async addStateToStore(state: StateBase, contextual: StateContextual) {
    let compressed = gzip(JSON.stringify(contextual));
    let bytes = Bytes.fromUint8Array(compressed);

    return this.dataService.write('states',
      {
        [state.id]: {
          ...state,
          state: bytes,
        } as StateBase,
      },
      {merge: true})
      .catch((e: CpError) => {
        if (e.reason === 'no-user') {
          console.error('No user is logged in for capturing this savegame');
          return;
        }
        throw e;
      });
  }

  async removeStateFromStore(name: string) {
    // TODO: soft delete first
    return this.dataService.delete('states', name)
      .catch(error => {
        this.snackBar.open(`Could not remove "${name}" from cloud storage`);
        throw new Error(error);
      });
  }

  getStates(): Observable<StateEntry[]> {
    return from(this.dataService.readAll<StateEntry>('states'))
      .pipe(map(states => states
        .filter(s => s.name) // @fix v1.2.6: ignore other fields, like "isCompressed"
        .map(s => {
          // @fix v1.2.6: previous version savegames are not compressed
          if (typeof s.state === 'string') {
            return s;
          }

          // uncompress states
          let arrayBuffer = s.state.toUint8Array().buffer;
          let unzipped = ungzip(arrayBuffer, {to: 'string'});
          return ({...s, state: unzipped});
        })));
  }

  getStatesInContext({sorted} = {sorted: true}): Observable<StateEntry[]> {
    return this.getStates().pipe(map(states => {
        let list = states.filter(s => s.context === this.context);
        list = sorted
          ? list.sort((a, b) => b.timestamp.seconds - a.timestamp.seconds)
          : list;
        return list;
      },
    ));
  }

  async save() {
    let stateBase = this.stateBase;
    let contextual = this.stateContextual;
    return this.addStateToStore(stateBase, contextual)
      .then(() => this.setStateRecord());
  }

  renameCurrentState(name: string) {
    this.name = name;
  }

  async renameState(oldName: string, state: StateRow) {
    let updatedStateGame = state.toUpdatedStateGame();
    return this.addStateToStore(updatedStateGame as StateBase, updatedStateGame)
      .then(() => this.removeStateFromStore(oldName))
      .catch(error => {
        this.snackBar.open(`Could not rename "${oldName}"`);
        throw error;
      })
      .then(() => this.snackBar.open(`Renamed "${oldName}" to "${state.name}"`));
  }

  async handleUserSingIn(user?: UserData) {
    if (!user) {
      // No user logged in
      await firstValueFrom(this.loadState());
      return;
    }

    let states = await firstValueFrom(this.getStatesInContext({sorted: true}));
    let newestState = states[0];
    if (!newestState) {
      // New user without state
      await firstValueFrom(this.loadState());
      return;
    }

    if (this.hasPendingChanges) {
      let snackbarResult$ = this.snackBar
        .open(`Latest save games found, discard current changes and load "${newestState?.name}"?`,
          'Discard Changes', {duration: 15e3})
        .afterDismissed();
      let {dismissedByAction} = await firstValueFrom(snackbarResult$);
      if (!dismissedByAction) {
        return;
      }
    }

    let {id, name, timestamp, context, version} = newestState;
    let jsDate = new Date(timestamp.seconds * 1e3);
    await firstValueFrom(this.loadState({
      id, name, timestamp: jsDate, context, version, state: newestState.state,
    }));
    // todo: add snackbar queue service to stop message overriding each other
    this.snackBar.open(`Loading latest save game "${newestState?.name}"`);
  }

}
