import { extract } from './extract-part-properties';
import { BuiltStructure, TransformationFunction } from './domain';
import { getPartPropertiesFromModule, getPartPropertiesFromResource } from './module-interogator';
import { withoutTranslationPart } from './common';

export class PartProperties {
  converters?: PartProperties[];
  converterName?: string;

  storageEc?: string;
  drawEc?: string;
  produceEc?: string;
  produceSolarEc?: string;

  drawHeat?: string;
  produceHeat?: string;

  storageLf?: string;
  storageOx?: string;
  storageOre?: string;
  storageMono?: string;
  drawLf?: string;
  drawOx?: string;
  drawOre?: string;
  produceLf?: string;
  produceOx?: string;
  produceOre?: string;
  produceMono?: string;
}

export type Category =
  'isru'
  | 'radiator'
  | 'drill'
  | 'solar-panel'
  | 'rtg'
  | 'fuel-cell'
  | 'battery'
  | 'resource-tank'
  | 'unknown';

let convertersLabelMap = new Map<string, string>([
  ['Lf+Ox', 'Liquid Fuel + Oxidizer'],
  ['LiquidFuel', 'Liquid Fuel'],
  ['Oxidizer', 'Oxidizer'],
  ['Monoprop', 'Monopropellant'],
  ['MonoPropellant', 'Monopropellant'],
  ['Fuel Cell', 'Fuel Cell'],
]);

function getCategory(part: BuiltStructure, processedProperties: PartProperties): Category {
  let tags = withoutTranslationPart(part.properties.tags);

  if (processedProperties.storageOre) {
    return 'resource-tank';
  }

  if (tags.includes('harvest')) {
    return 'drill';
  }

  if (tags.includes('isru')) {
    return 'isru';
  }

  if (tags.includes('capacitor')) {
    return 'battery';
  }

  if (tags.includes('sun')) {
    return 'solar-panel';
  }

  if (tags.includes('rtg')) {
    return 'rtg';
  }

  if (tags.includes('bank')) {
    return 'fuel-cell';
  }

  if (tags.includes('fueltank')) {
    return 'resource-tank';
  }

  if (tags.includes('cool')) {
    return 'radiator';
  }

  return 'unknown';
}

function getProperties(part: BuiltStructure): PartProperties {
  let modulesProperties = part.MODULE?.map(m => getPartPropertiesFromModule(m))
    .filter(p => p) || [];
  let resourceProperties = part.RESOURCE?.map(m => getPartPropertiesFromResource(m))
    .filter(p => p) || [];

  let properties = Object.assign({},
    ...resourceProperties,
    ...modulesProperties.filter((p: any) => !p.converterName),
  );
  let converterOptions = modulesProperties.filter((p: any) => p.converterName);
  if (converterOptions.length) {
    properties.converters = converterOptions.map(co => ({
      ...co,
      converterName: convertersLabelMap.get(co.converterName),
    }));
  }

  return properties;
}

function transformFunction(): TransformationFunction {
  return cfgStructure => {
    let part = cfgStructure.PART[0];
    let props = part.properties;
    let properties = getProperties(part);
    return {
      label: withoutTranslationPart(props.title),
      category: getCategory(part, properties),
      cost: props.cost,
      mass: props.mass,
      ...properties,
    };
  };
}

extract(
  {
    gamePath: 'C:\\Steam\\steamapps\\common\\Kerbal Space Program',
    filterForTags: [
      'solar',
      'capacitor',
      'bank',
      'charge',
      'isru',
      'cool',
      'radiat',
      'ore',
      'drill',
      'fuel',
      'fueltank',
      'mono',
    ],
    filterNotTags: [
      'remove',
      'split',
      'aero',
      '(ion',
    ],
    filterForFolders: [
      '/fuelcell/',
      '/isru/',
      '/miniisru/',
      '/minidrill/',
      '/radialdrill/',
      '/LargeTank/',
      '/radialtank/',
      '/smalltank/',
      '/electrical/',
      '/fueltank/',
      '/thermal/',
    ],
    filterNotFolders: [
      '/adapterTanks/',
      '/Aero/',
      '/Structural/',
    ],
    outputMode: 'one-file',
  },
  transformFunction(),
);
