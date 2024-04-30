import { FileInfo, InventoryEntry, OneKeypadData } from "@mudlet3/frontend/shared";

export class FileEntries {
  name = '';
  size = -2;
  filedate = '';
  filetime = '';
  isdir = 0;
}

export class MudSignals {
  signal: string;
  id: string;
  wizard?: number;
  playSoundFile?: string;
  filepath?: string;
  fileinfo?: FileInfo;
  entries?: FileEntries[];
  numpadLevel?: OneKeypadData;
  invEntry?: InventoryEntry;
  invEntries?: InventoryEntry[];
}
