import { Component, ElementRef, EventEmitter, forwardRef, Input, OnInit, Output, TemplateRef, ViewChild } from '@angular/core';
import { FormControlError } from '../../common/domain/input-fields/form-control-error';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { MatCheckbox } from '@angular/material/checkbox';
import { BasicValueAccessor } from '../../common/domain/input-fields/basic-value-accessor';
import { MatSlideToggle } from '@angular/material/slide-toggle';

@Component({
  selector: 'cp-input-toggle',
  templateUrl: './input-toggle.component.html',
  styleUrls: ['./input-toggle.component.scss'],
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: forwardRef(() => InputToggleComponent),
    multi: true,
  }],
})
export class InputToggleComponent extends BasicValueAccessor {

  @Input() label: string;
  @Input() color: 'primary' | 'accent' | 'warn' = 'primary';
  @Input() type: 'checkbox' | 'switch' = 'checkbox';
  @Input() indeterminate?: boolean;
  @Input() errors: FormControlError;

  @ViewChild('checkbox', {static: true}) checkbox: MatCheckbox;
  @ViewChild('switch', {static: true}) switch: MatSlideToggle;

  constructor() {
    super();
  }

  writeValue(value: any) {
    let booledValue = !!value;
    this.checkbox?.writeValue(booledValue);
    this.switch?.writeValue(booledValue);
    this.value = booledValue;
  }

  registerOnChange(fn: (value: any) => any) {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => any) {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean) {
    this.checkbox?.setDisabledState(isDisabled);
    this.switch?.setDisabledState(isDisabled);
  }

  userInputChange(value: boolean) {
    this.writeValue(value);
    this.onChange && this.onChange(value);
  }

  focus() {
    this.checkbox?.focus();
    this.switch?.focus();
  }

}