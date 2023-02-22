import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StatisticsMapType, StatisticType } from '../domain/isru-statistics-generator';
import { combineLatest, map, Observable, takeUntil } from 'rxjs';
import { WithDestroy } from '../../../common/with-destroy';
import { CraftPart } from '../domain/craft-part';
import { Group } from '../../../common/domain/group';
import { IsruWidgetService } from '../isru-widget.service';
import { CpColors } from '../../controls/input-field/input-field.component';

interface WarningMessage {
  message: string;
  severity: CpColors;
}

interface StorageInfo {
  storageType: StatisticType;
  label: string;
}

interface InfoPack {
  stats: StatisticsMapType;
  parts: Group<CraftPart>[];
  ore: number;
  converters: string[];
}

@Component({
  selector: 'cp-isru-warnings',
  standalone: true,
  imports: [
    CommonModule,
  ],
  templateUrl: './isru-warnings.component.html',
  styleUrls: ['./isru-warnings.component.scss'],
})
export class IsruWarningsComponent extends WithDestroy() {

  warnings$: Observable<WarningMessage[]>;

  constructor(isruService: IsruWidgetService) {
    super();

    this.warnings$ = combineLatest([
      isruService.statisticsMap$,
      isruService.craftPartGroups$,
      isruService.oreConcentration$,
      isruService.activeConverters$,
    ]).pipe(
      map(([stats, parts, ore, converters]) =>
        this.getWarnings({stats, parts, ore, converters})),
      takeUntil(this.destroy$));
  }

  private getWarnings(infoPack: InfoPack): WarningMessage[] {
    return this.getResourceWarnings(infoPack)
      .concat(this.getLocationWarnings(infoPack))
      .concat(this.getConverterWarnings(infoPack));
  }

  private getResourceWarnings(infoPack: InfoPack): WarningMessage[] {
    let resourceIssues = this.getResourceIssues(infoPack);
    let heatIssues = this.getHeatIssues(infoPack);

    return resourceIssues.concat(heatIssues);
  }

  private getResourceIssues(infoPack: InfoPack): WarningMessage[] {
    let {stats} = infoPack;

    let testCases: (StatisticType | string)[][] = [
      ['power+', 'power-', 'power'],
      ['lf+', 'lf-', 'liquid fuel'],
      ['ox+', 'ox-', 'oxidizer'],
      ['ore+', 'ore-', 'ore'],
    ];
    return testCases.filter(([keyProduce, keyConsume]: [StatisticType, StatisticType]) =>
      stats.get(keyProduce).lastValue < stats.get(keyConsume).lastValue)
      .map(([, , title]) => ({
        message: `Not enough ${title} production`,
        severity: 'accent',
      }));
  }

  private getHeatIssues(infoPack: InfoPack): WarningMessage[] {
    let {stats} = infoPack;
    let heatProduced = stats.get('heat+').lastValue;
    let heatConsumed = stats.get('heat-').lastValue;
    if (!heatProduced || heatProduced <= heatConsumed) {
      return [];
    }

    return [{
      message: `Not enough heat dissipation`,
      severity: 'accent',
    }];
  }

  private getLocationWarnings(infoPack: InfoPack): WarningMessage[] {
    let {parts, ore} = infoPack;
    if (ore >= 2.5) {
      return [];
    }

    let juniorDrill = parts.find(p => p.count > 0
      && p.item.label === `Drill-O-Matic Junior' Mining Excavator`);
    if (!juniorDrill) {
      return [];
    }

    return [{
      message: `'Drill-O-Matic Junior' Mining Excavator' requires `
        + `at least 2.5% ore concentration to function`,
      severity: 'accent',
    }];
  }

  private getConverterWarnings(infoPack: InfoPack) {
    let {
      hasActiveConverter: hasActiveJuniorConverter,
      warnings: juniorLimitIssues
    } = this.getConverter125Issues(infoPack);
    let {
      activeConverters: activeSeniorConverters,
      warnings: seniorLimitIssues
    } = this.getConverter250Issues(infoPack);

    let oreStorageIssues = this.getOreStorageIssues(
      infoPack, hasActiveJuniorConverter, activeSeniorConverters);
    let fuelCellIssues = this.getFuelCellIssues(infoPack);

    return juniorLimitIssues
      .concat(seniorLimitIssues)
      .concat(oreStorageIssues)
      .concat(fuelCellIssues);
  }

  private getConverter125Issues(infoPack: InfoPack): {
    hasActiveConverter: boolean,
    warnings: WarningMessage[],
  } {
    let {parts, converters} = infoPack;

    let juniorIsru = parts.find(g => g.count > 0 && g.item.label === `Convert-O-Tron 125`);
    if (!juniorIsru) {
      return {hasActiveConverter: false, warnings: []};
    }

    let hasActiveConverter = juniorIsru.item.converters
      .some(c => converters.includes(c.converterName));
    if (!hasActiveConverter) {
      return {hasActiveConverter, warnings: []};
    }
    let limitIssues: WarningMessage[] = [{
      message: `'Convert-O-Tron 125' has a max cooling limit, ` +
        'it will shut down after a short duration',
      severity: 'accent',
    }];
    return {hasActiveConverter, warnings: limitIssues};
  }

  private getConverter250Issues(infoPack: InfoPack): {
    activeConverters: number,
    warnings: WarningMessage[],
  } {
    let {parts, converters} = infoPack;

    let seniorIsru = parts.find(g => g.count > 0 && g.item.label === `Convert-O-Tron 250`);
    if (!seniorIsru) {
      return {activeConverters: 0, warnings: []};
    }

    let activeConverters = seniorIsru.item.converters
      .filter(c => converters.includes(c.converterName))
      .length;
    if (activeConverters < 3) {
      return {activeConverters, warnings: []};
    }
    let seniorLimitIssues: WarningMessage[] = [{
      message: `'Convert-O-Tron 250' limits max cooling to 500W, `
        + `it cannot be cooled properly while running ${activeConverters} resource processors`,
      severity: 'accent',
    }];
    return {activeConverters, warnings: seniorLimitIssues};
  }

  private getOreStorageIssues(infoPack: InfoPack,
                              hasActiveJuniorConverter: boolean,
                              activeSeniorConverters: number): WarningMessage[] {
    let {stats} = infoPack;

    let requiresOreStorage = hasActiveJuniorConverter || activeSeniorConverters;
    let hasOreStorage = stats.get('ore=').lastValue > 0;
    if (!requiresOreStorage || hasOreStorage) {
      return [];
    }

    return [{
      message: 'Ore storage is required to process ore',
      severity: 'accent',
    }];
  }

  private getFuelCellIssues(infoPack: InfoPack): WarningMessage[] {
    let {parts, converters, stats} = infoPack;

    let fuelCell = parts.find(g => g.count > 0 && g.item.label === `Fuel Cell`);
    if (!fuelCell) {
      return [];
    }

    let activeFuelCellConverter = fuelCell.item.converters
      .find(c => converters.includes(c.converterName));
    if (!activeFuelCellConverter) {
      return [];
    }

    let keyToStorageMap = new Map<string, StorageInfo>([
      ['drawLf', {storageType: 'lf=', label: 'liquid fuel'}],
      ['drawOx', {storageType: 'ox=', label: 'oxidizer'}],
    ]);

    let consumers = Object.keys(activeFuelCellConverter)
      .filter(k => k.startsWith('draw'));

    let noStorageConsumers = consumers
      .map(key => ({key, info: keyToStorageMap.get(key)}))
      .filter(({key, info}) => {
        let hasStorage = stats.get(info.storageType).lastValue > 0;
        return !hasStorage;
      });
    if (!noStorageConsumers.length) {
      return [];
    }

    let requiredContainers = noStorageConsumers.map(({info}) => info.label).join(' and ');
    return [{
      message: `'${fuelCell.item.label}' requires storage for ${requiredContainers} to function`,
      severity: 'accent',
    }];
  }
}