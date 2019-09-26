import { FileEntries } from '../nonmodal/file-entries';

export class MudSignals {
    signal : string;
    id : string;
    wizard? : number;
    playSoundFile?: string;
    filepath?: string;
    entries?: FileEntries[];
}