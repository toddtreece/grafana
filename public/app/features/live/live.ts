import Centrifuge from 'centrifuge/dist/centrifuge';
import { GrafanaLiveSrv, setGrafanaLiveSrv, getGrafanaLiveSrv, config } from '@grafana/runtime';
import { BehaviorSubject } from 'rxjs';
import { LiveChannel, LiveChannelScope, LiveChannelAddress, LiveChannelConnectionState } from '@grafana/data';
import { CentrifugeLiveChannel, getErrorChannel } from './channel';
import {
  GrafanaLiveScope,
  grafanaLiveCoreFeatures,
  GrafanaLiveDataSourceScope,
  GrafanaLivePluginScope,
  GrafanaLiveStreamScope,
} from './scopes';
import { registerLiveFeatures } from './features';
import {
  WorkerConnect,
  WorkerEvent,
  WorkerEventEnum,
  WorkerRequestType,
  WorkerSubscribe,
  WorkerSubscriptionEvent,
} from './types';

const liveUrl = `${config.appUrl}live/ws`.replace(/^(http)(s)?:\/\//, 'ws$2://');
export const sessionId =
  (window as any)?.grafanaBootData?.user?.id +
  '/' +
  Date.now().toString(16) +
  '/' +
  Math.random().toString(36).substring(2, 15);

const worker = new Worker('./live-worker', { name: 'live-worker', type: 'module' });
//const worker = new Worker('./test-worker', { name: 'test-worker', type: 'module' });

export class CentrifugeSrv implements GrafanaLiveSrv {
  readonly open = new Map<string, CentrifugeLiveChannel>();
  readonly subscriptions = new Map<string, Centrifuge.SubscriptionEvents>();

  readonly worker: Worker;
  readonly connectionState: BehaviorSubject<boolean>;
  readonly scopes: Record<LiveChannelScope, GrafanaLiveScope>;

  constructor() {
    this.connectionState = new BehaviorSubject<boolean>(false);
    this.scopes = {
      [LiveChannelScope.Grafana]: grafanaLiveCoreFeatures,
      [LiveChannelScope.DataSource]: new GrafanaLiveDataSourceScope(),
      [LiveChannelScope.Plugin]: new GrafanaLivePluginScope(),
      [LiveChannelScope.Stream]: new GrafanaLiveStreamScope(),
    };

    worker.onmessage = (e: MessageEvent<any>) => {
      const event: WorkerEvent = e.data;
      switch (event.type) {
        case WorkerEventEnum.Connected:
          return this.onConnect();
        case WorkerEventEnum.Disconnected:
          return this.onDisconnect();
        case WorkerEventEnum.Received:
        case WorkerEventEnum.Subscribed:
        case WorkerEventEnum.SubscriptionFailed:
        case WorkerEventEnum.Unsubscribed:
          return this.handleSubscriptionEvent(event);
        default:
          console.log(event);
      }
    };
    this.connect();
  }

  //----------------------------------------------------------
  // Internal functions
  //----------------------------------------------------------

  connect = () => {
    const connect: WorkerConnect = { type: WorkerRequestType.Connect, sessionId, liveUrl };
    worker.postMessage(connect);
  };

  onConnect = () => {
    console.log('CONNECT');
    this.connectionState.next(true);
  };

  onDisconnect = () => {
    console.log('DISCONNECT');
    this.connectionState.next(false);
  };

  subscribe = (id: string, events: Centrifuge.SubscriptionEvents) => {
    const sub: WorkerSubscribe = { type: WorkerRequestType.Subscribe, id };
    worker.postMessage(sub);
    this.subscriptions.set(id, events);
  };

  handleSubscriptionEvent = (event: WorkerSubscriptionEvent) => {
    const typeToFnMap = {
      [WorkerEventEnum.Received]: 'publish',
      [WorkerEventEnum.Subscribed]: 'subscribe',
      [WorkerEventEnum.SubscriptionFailed]: 'error',
      [WorkerEventEnum.Unsubscribed]: 'unsubscribe',
    };
    const subscription = this.subscriptions.get(event.id);
    if (!subscription) {
      return;
    }
    // @ts-ignore
    const fn = subscription[typeToFnMap[event.type]];
    fn(event.context);
  };

  /**
   * Get a channel.  If the scope, namespace, or path is invalid, a shutdown
   * channel will be returned with an error state indicated in its status
   */
  getChannel<TMessage, TPublish = any>(addr: LiveChannelAddress): LiveChannel<TMessage, TPublish> {
    const id = `${addr.scope}/${addr.namespace}/${addr.path}`;
    let channel = this.open.get(id);
    if (channel != null) {
      return channel;
    }

    const scope = this.scopes[addr.scope];
    if (!scope) {
      return getErrorChannel('invalid scope', id, addr);
    }

    channel = new CentrifugeLiveChannel(id, addr);
    channel.shutdownCallback = () => {
      this.open.delete(id); // remove it from the list of open channels
    };
    this.open.set(id, channel);

    // Initialize the channel in the background
    this.initChannel(scope, channel).catch((err) => {
      if (channel) {
        channel.currentStatus.state = LiveChannelConnectionState.Invalid;
        channel.shutdownWithError(err);
      }
      this.open.delete(id);
    });

    // return the not-yet initalized channel
    return channel;
  }

  private async initChannel(scope: GrafanaLiveScope, channel: CentrifugeLiveChannel): Promise<void> {
    const { addr } = channel;
    const support = await scope.getChannelSupport(addr.namespace);
    if (!support) {
      throw new Error(channel.addr.namespace + ' does not support streaming');
    }
    const config = support.getChannelConfig(addr.path);
    if (!config) {
      throw new Error('unknown path: ' + addr.path);
    }
    const events = channel.initalize(config);
    if (!this.isConnected()) {
      return;
    }
    this.subscribe(channel.id, events);
    return;
  }

  //----------------------------------------------------------
  // Exported functions
  //----------------------------------------------------------

  /**
   * Is the server currently connected
   */
  isConnected() {
    return this.connectionState.getValue();
  }

  /**
   * Listen for changes to the connection state
   */
  getConnectionState() {
    return this.connectionState.asObservable();
  }
}

export function getGrafanaLiveCentrifugeSrv() {
  return getGrafanaLiveSrv() as CentrifugeSrv;
}

export function initGrafanaLive() {
  setGrafanaLiveSrv(new CentrifugeSrv());
  registerLiveFeatures();
}
