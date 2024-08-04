import { Injectable } from '@angular/core';
import { MudConfigService } from '@mudlet3/frontend/features/config';
import { SocketsService } from '@mudlet3/frontend/features/sockets';
import { wordWrap } from '@mudlet3/frontend/shared';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { IMudMessage } from 'src/app/core/mud/types/mud-message';

import { mudProcessData } from './utils/mud-process-data';
import {
  isSecureString,
  SecureString,
} from 'src/app/shared/types/secure-string';

@Injectable({
  providedIn: 'root',
})
export class MudService {
  private readonly outputLines = new BehaviorSubject<IMudMessage[]>([]);

  private readonly newMessageToSend: Subject<string> = new Subject();

  public readonly outputLines$: Observable<IMudMessage[]> =
    this.outputLines.asObservable();

  public readonly connectedToMud$: Observable<boolean>;

  public readonly showEcho$: Observable<boolean>;

  constructor(
    private readonly socketsService: SocketsService,
    private readonly mudConfigService: MudConfigService,
  ) {
    socketsService.onMudOutput.subscribe(({ data }) => {
      const ansiData = mudProcessData(data);

      const mudLines: IMudMessage[] = ansiData.map((ansi) => ({
        ...ansi,
        type: 'mud',
      }));

      this.addOutputLine(...mudLines);
    });

    this.connectedToMud$ = this.socketsService.connectedToMud$;

    this.showEcho$ = socketsService.onSetEchoMode.asObservable();
  }

  public addOutputLine(...line: IMudMessage[]): void {
    this.outputLines.next([...this.outputLines.value, ...line]);
  }

  public sendMessage(message: string | SecureString): void {
    this.socketsService.sendMessage(message);

    const isSecure = isSecureString(message);

    const useEcho = this.mudConfigService.webConfig.localEcho;

    if (useEcho && !isSecure) {
      const echoLine: IMudMessage = {
        type: 'echo',
        // Todo[myst]: die Anzahl der Zeichen sollte mit dem Ausgehandelten WordWrap von Uni übereinstimmen
        text: wordWrap(message, 75) + '\r\n',
      };

      this.addOutputLine(echoLine);
    }
  }

  public connect(): void {
    this.socketsService.connectToMud();
  }

  public disconnect(): void {
    this.socketsService.disconnectFromMud();
  }
}
