import { FileEntries } from './file-entries';
import { FileInfo } from './file-info';

export class MudSignals {
    signal : string;
    id : string;
    wizard? : number;
    playSoundFile?: string;
    filepath?: string;
    fileinfo? : FileInfo;
    entries?: FileEntries[];
}