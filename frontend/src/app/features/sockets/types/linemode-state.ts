export interface LinemodeState {
  mode: number;
  edit: boolean;
  trapsig: boolean;
  softTab: boolean;
  literalEcho: boolean;
  forwardMask: number[];
  forwardMaskDescription: string;
}
