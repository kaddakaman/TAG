import type { PanelDef } from '../ui';
import { characterPanel, inventoryPanel, skillsPanel } from './hero';
import {
  bountiesPanel, brewPanel, cookPanel, donatePanel, forgePanel, npcPanel, shopPanel, stashPanel, storagePanel, travelPanel,
} from './town';
import { deathPanel, helpPanel, journalPanel, mapPanel, menuPanel, settingsPanel } from './system';

export const PANELS: Record<string, PanelDef> = {
  inventory: inventoryPanel,
  character: characterPanel,
  skills: skillsPanel,
  npc: npcPanel,
  shop: shopPanel,
  forge: forgePanel,
  cook: cookPanel,
  brew: brewPanel,
  donate: donatePanel,
  storage: storagePanel,
  stash: stashPanel,
  bounties: bountiesPanel,
  travel: travelPanel,
  journal: journalPanel,
  map: mapPanel,
  menu: menuPanel,
  settings: settingsPanel,
  help: helpPanel,
  death: deathPanel,
};
