import {
  DefinitionVersionMap,
  getTheme,
  KeyboardDefinitionIndex,
  KeyboardDictionary,
  ThemeDefinition,
} from 'via-reader';
import {Store} from '../shims/via-app-store';
import type {
  DefinitionIndex,
  VendorProductIdMap,
  Settings,
  Device,
  CommonMenusMap,
} from '../types/types';
import {getVendorProductId} from './hid-keyboards';

let deviceStore: Store;
const defaultStoreData = {
  definitionIndex: {
    generatedAt: -1,
    hash: '',
    version: '2.0.0',
    theme: getTheme(),
    supportedVendorProductIdMap: {},
  },
  definitions: {},
  settings: {
    allowKeyboardKeyRemapping: false,
    showDesignTab: false,
    disableFastRemap: false,
    disableHardwareAcceleration: false,
  },
  commonMenus: {},
};

function initDeviceStore() {
  deviceStore = new Store(defaultStoreData);
}

initDeviceStore();

// TODO: invalidate cache if we change cache structure

/** Retreives the latest definition index and invalidates the definition cache if a new one is found */
export async function syncStore(): Promise<DefinitionIndex> {
  const currentDefinitionIndex = deviceStore.get('definitionIndex');

  // TODO: fall back to cache if can't hit endpoint, notify user
  try {
    // Get hash file
    const hash = await (await fetch('/definitions/hash.json')).json();

    if (hash === currentDefinitionIndex.hash) {
      return currentDefinitionIndex;
    }
    // Get definition index file
    const response = await fetch('/definitions/supported_kbs.json', {
      cache: 'reload',
    });
    const json: KeyboardDefinitionIndex = await response.json();

    await setCommonMenus();
    // TODO: maybe we should just export this shape from keyboards repo
    // v3 is a superset of v2 - if the def is avail in v2, it is also avail in v3
    const v2vpidMap = json.vendorProductIds.v2.reduce(
      (acc: VendorProductIdMap, id) => {
        acc[id] = acc[id] || {};
        acc[id].v2 = acc[id].v3 = true;
        return acc;
      },
      {},
    );

    const vpidMap = json.vendorProductIds.v3.reduce(
      (acc: VendorProductIdMap, def) => {
        acc[def] = acc[def] || {};
        acc[def].v3 = true;
        return acc;
      },
      v2vpidMap,
    );

    const newIndex = {
      ...json,
      hash,
      supportedVendorProductIdMap: vpidMap,
    };
    deviceStore.set('definitionIndex', newIndex);
    deviceStore.set('definitions', {});

    return newIndex;
  } catch (e) {
    console.warn(e);
  }

  return currentDefinitionIndex;
}

export const setCommonMenus = async (): Promise<CommonMenusMap> => {
  const url = `/definitions/common-menus.json`;
  const response = await fetch(url);
  const json: CommonMenusMap = await response.json();
  try {
    deviceStore.set('commonMenus', json);
  } catch (err) {
    // This is likely due to running out of space, so we clear it
    localStorage.clear();
  }
  return json;
};

export const getMissingDefinition = async <
  K extends keyof DefinitionVersionMap,
>(
  device: Device,
  version: K,
): Promise<[DefinitionVersionMap[K], K]> => {
  const vpid = getVendorProductId(device.vendorId, device.productId);
  const url = `/definitions/${version}/${vpid}.json`;
  const response = await fetch(url);
  const json: DefinitionVersionMap[K] = await response.json();
  let definitions = deviceStore.get('definitions');
  const newDefinitions = {
    ...definitions,
    [vpid]: {
      ...definitions[vpid],
      [version]: json,
    },
  };

  try {
    deviceStore.set('definitions', newDefinitions);
  } catch (err) {
    // This is likely due to running out of space, so we clear it
    localStorage.clear();
    initDeviceStore();
    definitions = deviceStore.get('definitions');
    deviceStore.set('definitions', {
      ...definitions,
      [vpid]: {
        ...definitions[vpid],
        [version]: json,
      },
    });
  }
  return [json, version];
};

export const getCommonMenus = (): CommonMenusMap =>
  deviceStore.get('commonMenus');

export const getSupportedIdsFromStore = (): VendorProductIdMap =>
  deviceStore.get('definitionIndex')?.supportedVendorProductIdMap;

export const getDefinitionsFromStore = (): KeyboardDictionary =>
  deviceStore.get('definitions');

export const getThemeFromStore = (): ThemeDefinition =>
  deviceStore.get('definitionIndex')?.theme;

export const getSettings = (): Settings => deviceStore.get('settings');

export const setSettings = (settings: Settings) =>
  deviceStore.set('settings', settings);
