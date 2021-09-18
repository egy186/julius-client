import { EventEmitter, once } from 'events';
import { Socket } from 'net';
import type TypedEmitter from 'typed-emitter';
import { createInterface } from 'readline';
import { parse as parseXml } from 'fast-xml-parser';

/* eslint-disable @typescript-eslint/naming-convention */
interface JuliusWhypoXml {
  readonly WORD: string;
  readonly CLASSID: string;
  readonly PHONE: string;
  readonly CM: string;
}

interface JuliusShypoXml {
  readonly GRAM: string;
  readonly RANK: string;
  readonly SCORE: string;
  readonly WHYPO: JuliusWhypoXml | JuliusWhypoXml[];
}

interface JuliusXml {
  readonly ENDPROC: '';
  readonly ENDRECOG: '';
  readonly ENGINEINFO: Readonly<{
    CONF: string;
    TYPE: string;
    VERSION: string;
  }>;
  readonly GMM: Readonly<{
    CMSCORE: string;
    RESULT: string;
  }>;
  readonly GRAMINFO: unknown;
  readonly GRAMMAR: Readonly<{
    REASON: string;
    STATUS: string;
  }>;
  readonly GRAPHOUT: unknown;
  readonly INPUT: Readonly<{
    STATUS: 'ENDREC' | 'LISTEN' | 'STARTREC';
    TIME: string;
  }>;
  readonly INPUTPARAM: Readonly<{
    FRAMES: string;
    MSEC: string;
  }>;
  readonly RECOGFAIL: '';
  readonly RECOGOUT: { SHYPO: JuliusShypoXml | JuliusShypoXml[] };
  readonly RECOGPROCESS: unknown;
  readonly REJECTED: Readonly<{ REASON: string }>;
  readonly STARTPROC: '';
  readonly STARTRECOG: '';
  readonly SYSINFO: Readonly<{ PROCESS: 'ACTIVE' | 'SLEEP' }>;
}

interface JuliusClientEvents {
  ENDPROC: () => Promise<void> | void;
  ENDRECOG: () => Promise<void> | void;
  ENGINEINFO: (engineInfo: Readonly<{ conf: string; type: string; version: string }>) => Promise<void> | void;
  GMM: (gmm: Readonly<{ cmScore: number; result: string }>) => Promise<void> | void;
  GRAMINFO: (granInfo: unknown) => Promise<void> | void;
  GRAMMAR: (grammar: Readonly<{ reason: string;status: string }>) => Promise<void> | void;
  GRAPHOUT: (graphOut: unknown) => Promise<void> | void;
  INPUT: (input: Readonly<{ status: JuliusXml['INPUT']['STATUS']; time: number }>) => Promise<void> | void;
  INPUTPARAM: (inputParam: Readonly<{ frames: number; msec: number }>) => Promise<void> | void;
  RECOGFAIL: () => Promise<void> | void;
  RECOGOUT: (recogOut: readonly Readonly<{ gram: string; rank: number; score: number; whypo: readonly Readonly<{ classId: string; cm: number; phone: string; word: string }>[] }>[]) => Promise<void> | void;
  RECOGPROCESS: (recogProcess: unknown) => Promise<void> | void;
  REJECTED: (rejected: Readonly<{ reason: string }>) => Promise<void> | void;
  STARTPROC: () => Promise<void> | void;
  STARTRECOG: () => Promise<void> | void;
  SYSINFO: (sysInfo: Readonly<{ process: JuliusXml['SYSINFO']['PROCESS'] }>) => Promise<void> | void;
  data: (data: Partial<JuliusXml>) => Promise<void> | void;
  error: (error: unknown) => Promise<void> | void;
}
/* eslint-enable @typescript-eslint/naming-convention */

interface JuliusClientOptions {
  readonly autoConnect?: boolean;
  // eslint-disable-next-line no-undef
  readonly encoding?: BufferEncoding;
  readonly host?: string;
  readonly port?: number;
}

const deafultJuliusClientOptions: Required<Omit<JuliusClientOptions, 'host'>> = {
  autoConnect: true,
  encoding: 'utf-8',
  port: 10500
};

// eslint-disable-next-line @typescript-eslint/no-extra-parens
class JuliusClient extends (EventEmitter as new () => TypedEmitter<JuliusClientEvents>) {
  /* eslint-disable @typescript-eslint/naming-convention */
  public readonly COMMANDS = {
    DIE: 'DIE\n',
    PAUSE: 'PAUSE\n',
    RESUME: 'RESUME\n',
    STATUS: 'STATUS\n',
    TERMINATE: 'TERMINATE\n',
    VERSION: 'VERSION\n'
  } as const;
  /* eslint-enable @typescript-eslint/naming-convention */

  public readonly socket = new Socket();

  // eslint-disable-next-line @typescript-eslint/explicit-member-accessibility
  readonly #readline = createInterface({ input: this.socket });

  // eslint-disable-next-line @typescript-eslint/explicit-member-accessibility
  #stack = '';

  public constructor (options: JuliusClientOptions = deafultJuliusClientOptions) {
    // eslint-disable-next-line constructor-super
    super();

    this.socket.setEncoding(options.encoding ?? deafultJuliusClientOptions.encoding);

    this.#readline.on('line', line => {
      if (line === '.') {
        this.#emit(this.#stack);
        this.#stack = '';
      } else {
        this.#stack += line;
      }
    });

    if (options.autoConnect === undefined || options.autoConnect) {
      this.socket.connect({
        host: options.host,
        port: options.port ?? deafultJuliusClientOptions.port
      });
    }
  }

  public send (command: string): void {
    this.socket.write(command);
  }

  public async engineInfo (): Promise<Parameters<JuliusClientEvents['ENGINEINFO']>[0]> {
    process.nextTick(() => {
      this.send(this.COMMANDS.VERSION);
    });
    const [version] = await once(this, 'ENGINEINFO') as Parameters<JuliusClientEvents['ENGINEINFO']>;
    return version;
  }

  public async sysInfo (): Promise<Parameters<JuliusClientEvents['SYSINFO']>[0]> {
    process.nextTick(() => {
      this.send(this.COMMANDS.STATUS);
    });
    const [status] = await once(this, 'SYSINFO') as Parameters<JuliusClientEvents['SYSINFO']>;
    return status;
  }

  // eslint-disable-next-line max-lines-per-function, @typescript-eslint/explicit-member-accessibility
  #emit (xml: string): void {
    const obj = parseXml(xml, {
      attributeNamePrefix: '',
      ignoreAttributes: false
    }) as Partial<JuliusXml>;
    // Emit raw data
    this.emit('data', obj);
    // Emit each event
    // eslint-disable-next-line complexity, max-lines-per-function, max-statements
    Object.entries(obj).forEach(([key, value]: readonly [string, JuliusXml[keyof JuliusXml]]) => {
      switch (key) {
        case 'ENDPROC':
        case 'ENDRECOG':
        case 'RECOGFAIL':
        case 'STARTPROC':
        case 'STARTRECOG':
          this.emit(key);
          break;
        case 'ENGINEINFO': {
          const { CONF: conf, TYPE: type, VERSION: version } = value as JuliusXml['ENGINEINFO'];
          this.emit(key, {
            conf,
            type,
            version
          });
          break;
        }
        case 'GMM': {
          const { CMSCORE: cmScore, RESULT: result } = value as JuliusXml['GMM'];
          this.emit(key, {
            cmScore: Number.parseFloat(cmScore),
            result
          });
          break;
        }
        case 'GRAMINFO':
          this.emit(key, value);
          break;
        case 'GRAMMAR': {
          const { REASON: reason, STATUS: status } = value as JuliusXml['GRAMMAR'];
          this.emit(key, {
            reason,
            status
          });
          break;
        }
        case 'GRAPHOUT':
          this.emit(key, value);
          break;
        case 'INPUT': {
          const { TIME: time, STATUS: status } = value as JuliusXml['INPUT'];
          this.emit(key, {
            status,
            time: Number.parseFloat(time)
          });
          break;
        }
        case 'INPUTPARAM': {
          const { FRAMES: frames, MSEC: msec } = value as JuliusXml['INPUTPARAM'];
          this.emit(key, {
            frames: Number.parseFloat(frames),
            msec: Number.parseFloat(msec)
          });
          break;
        }
        case 'RECOGOUT': {
          const { SHYPO: shypo } = value as JuliusXml['RECOGOUT'];
          const data = (Array.isArray(shypo) ? shypo : [shypo]).map(s => {
            const gram = s.GRAM;
            const rank = Number.parseFloat(s.RANK);
            const score = Number.parseFloat(s.SCORE);
            const whypo = (Array.isArray(s.WHYPO) ? s.WHYPO : [s.WHYPO]).map(w => {
              const classId = w.CLASSID;
              const cm = Number.parseFloat(w.CM);
              const phone = w.PHONE;
              const word = w.WORD;

              return {
                classId,
                cm,
                phone,
                word
              };
            });

            return {
              gram,
              rank,
              score,
              whypo
            };
          });
          this.emit(key, data);
          break;
        }
        case 'RECOGPROCESS':
          this.emit(key, value);
          break;
        case 'REJECTED': {
          const { REASON: reason } = value as JuliusXml['REJECTED'];
          this.emit(key, { reason });
          break;
        }
        case 'SYSINFO': {
          const { PROCESS: process } = value as JuliusXml['SYSINFO'];
          this.emit(key, { process });
          break;
        }
        default:
          this.emit('error', value);
      }
    });
  }
}

export { JuliusClient };

export type {
  JuliusClientOptions,
  JuliusClientEvents
};

export default JuliusClient;
