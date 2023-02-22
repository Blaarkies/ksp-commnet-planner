import { Component, OnDestroy } from '@angular/core';
import { BasicAnimations } from '../../common/animations/basic-animations';
import { Icons } from '../../common/domain/icons';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { PocketGridComponent, PocketLayout, WidgetType } from '../pocket-grid/pocket-grid.component';
import { PocketGridManagerService } from './pocket-grid-manager.service';

interface CanEditGrid {
  addColumn: boolean;
  addRow: boolean;
  removeColumn: boolean;
  removeRow: boolean;
}

class GetterSetterProxy<T> {
  constructor(public get: () => T,
              public set: (value) => T) {
  }
}

@Component({
  standalone: true,
  selector: 'cp-pocket-manager',
  templateUrl: './pocket-manager.component.html',
  styleUrls: ['./pocket-manager.component.scss'],
  animations: [
    BasicAnimations.expandY,
    BasicAnimations.expandX,
    BasicAnimations.fade,
  ],
  imports: [
    PocketGridComponent,
    MatButtonModule,
    MatIconModule,
    CommonModule,
  ],
  providers: [
    PocketGridManagerService,
  ],
})
export class PocketManagerComponent implements OnDestroy {

  Icons = Icons;

  pocketLayout: PocketLayout = {
    columns: [60],
    rows: [75],
    pockets: [
      {
        index: 0,
        type: WidgetType.isruHeatPower,
        savedDetails: {
          some: 'details',
        },
      } as any,
      null,
    ],
  };

  isOpen = false;
  isGridEditActive = false;

  canEdit: CanEditGrid = {
    addColumn: false,
    addRow: false,
    removeColumn: false,
    removeRow: false,
  };

  constructor(private gridService: PocketGridManagerService) {
    this.applyGridEdit();
    this.gridService.setWidgets(this.pocketLayout.pockets);
  }

  ngOnDestroy() {
    this.gridService.destroy();
  }

  activateGridEdit() {
    this.isGridEditActive = true;
  }

  private applyGridEdit() {
    let columnCount = this.pocketLayout.columns.length;
    let rowCount = this.pocketLayout.rows.length;
    this.canEdit = {
      addColumn: columnCount < 3,
      addRow: rowCount < 3,
      removeColumn: columnCount > 0,
      removeRow: rowCount > 0,
    };
    this.gridService.updateLayout(this.pocketLayout);
  }

  private columnsProxy = new GetterSetterProxy(
    () => this.pocketLayout.columns,
    value => this.pocketLayout.columns = value);

  private rowsProxy = new GetterSetterProxy(
    () => this.pocketLayout.rows,
    value => this.pocketLayout.rows = value);

  addColumn() {
    this.addLine(this.columnsProxy);
    this.applyGridEdit();
  }

  deleteColumn() {
    this.deleteLine(this.columnsProxy);
    this.applyGridEdit();
  }

  addRow() {
    this.addLine(this.rowsProxy);
    this.applyGridEdit();
  }

  deleteRow() {
    this.deleteLine(this.rowsProxy);
    this.applyGridEdit();
  }

  private addLine(proxy: GetterSetterProxy<number[]>) {
    let list = proxy.get();
    let count = list.length;

    if (count > 0) {
      list = list.map((n, i) => n.lerp(100 * (i + 1) / (count + 3)));
    }

    let newValue = list.last()?.lerp(100) ?? 50;
    list.push(newValue);

    proxy.set(list);
  }

  private deleteLine(proxy: GetterSetterProxy<number[]>) {
    let list = proxy.get();
    let count = list.length;

    list.pop();

    if (count > 1) {
      list = list.map((n, i) => n.lerp(100 * (i + 1) / count + 1));
    }

    proxy.set(list);
  }

}