import { Component, forwardRef, Input, OnDestroy, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { FormControl, NG_VALUE_ACCESSOR } from '@angular/forms';
import { BasicValueAccessor } from '../../common/domain/input-fields/basic-value-accessor';
import { LabeledOption } from '../../common/domain/input-fields/labeled-option';
import { FormControlError } from '../../common/domain/input-fields/form-control-error';
import { Icons } from '../../common/domain/icons';
import { Subject } from 'rxjs';
import { Antenna } from '../../common/domain/antenna';
import { takeUntil } from 'rxjs/operators';
import { Group } from '../../common/domain/group';
import { AntennaInput } from './antenna-input';
import { AntennaStatsComponent } from '../antenna-stats/antenna-stats.component';

@Component({
  selector: 'cp-antenna-selector',
  templateUrl: './antenna-selector.component.html',
  styleUrls: ['./antenna-selector.component.scss'],
  encapsulation: ViewEncapsulation.None,
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: forwardRef(() => AntennaSelectorComponent),
    multi: true,
  }],
})
export class AntennaSelectorComponent extends BasicValueAccessor implements OnInit, OnDestroy {

  private selectionOptions: LabeledOption<Antenna>[];

  @Input() set options(value: LabeledOption<Antenna>[]) {
    this.selectionOptions = value ?? [];
    this.refreshAvailableOptions();
    this.mapIcons = new Map<Antenna, string>(value.map(a => [a.value, a.value.icon]));
  }

  @Input() label: string;
  @Input() errors: FormControlError;

  @ViewChild(AntennaStatsComponent, {static: true}) antennaStats: AntennaStatsComponent;

  isActive: boolean;
  icons = Icons;

  availableOptions: LabeledOption<Antenna>[];
  finalControl = new FormControl();
  antennaInputs: AntennaInput[] = [];
  mapIcons: Map<Antenna, string>;

  private unsubscribe$ = new Subject();

  constructor() {
    super();
    this.finalControl.valueChanges
      .pipe(
        takeUntil(this.unsubscribe$))
      .subscribe((val: Antenna) => {
        this.antennaInputs.push(new AntennaInput(val));
        this.userInputChange();
        this.finalControl.reset(null, {emitEvent: false});
        this.refreshAvailableOptions();
      });
  }

  writeValue(value: Group<Antenna>[]) {
    // this.inputRef.nativeElement.value = value;
    this.value = value;
    if (!this.antennaInputs.length && value) {
      this.antennaInputs = value.map(({item, count}) => new AntennaInput(item, count));
      this.refreshAvailableOptions();
    }
    this.updateCollectionStats(this.antennaInputs);
  }

  registerOnChange(fn: (value: any) => any) {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => any) {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean) {
    // this.inputRef.nativeElement.disabled = isDisabled;
  }

  userInputChange() {
    this.updateCollectionStats(this.antennaInputs);
    let value = this.antennaInputs
      .map(({selectedAntenna, countControl}) => new Group(selectedAntenna, countControl.value));
    this.writeValue(value);
    this.onChange && this.onChange(value);
  }

  ngOnDestroy() {
    this.unsubscribe$.next();
    this.unsubscribe$.complete();
  }

  ngOnInit() {
    this.refreshAvailableOptions();
  }

  private refreshAvailableOptions() {
    this.availableOptions = this.selectionOptions.except(
      this.antennaInputs.map(ai => ({value: ai.selectedAntenna})),
      lo => lo.value);
  }

  removeAntenna(antennaInput: AntennaInput) {
    this.antennaInputs.remove(antennaInput);
    this.refreshAvailableOptions();
    this.userInputChange();
  }

  private updateCollectionStats(antennaInputs: AntennaInput[]) {
    this.antennaStats.updateStats(antennaInputs);
  }
}
