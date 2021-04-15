import Centrifuge from 'centrifuge/dist/centrifuge';
import { WorkerEventEnum, WorkerRequest, WorkerRequestType, WorkerEventType } from './types';

const subscriptions = new Map<string, Centrifuge.Subscription>();
let centrifuge: Centrifuge;

// @ts-ignore
const eventFn = (id: string, type: WorkerEventType) => (context) => postMessage({ type, id, context });

const onConnect = (sessionId: string, liveUrl: string) => {
  centrifuge = new Centrifuge(liveUrl, {
    debug: true,
  });
  centrifuge.setConnectData({
    sessionId: sessionId,
  });
  // @ts-ignore
  centrifuge.on('connect', () => self.postMessage({ type: WorkerEventEnum.Connected }));
  // @ts-ignore
  centrifuge.on('disconnect', () => self.postMessage({ type: WorkerEventEnum.Disconnected }));
  centrifuge.connect();
};

const onSubscribe = (id: string) => {
  const subscription = centrifuge.subscribe(id, {
    publish: eventFn(id, WorkerEventEnum.Received),
    subscribe: eventFn(id, WorkerEventEnum.Subscribed),
    unsubscribe: eventFn(id, WorkerEventEnum.Unsubscribed),
    error: eventFn(id, WorkerEventEnum.SubscriptionFailed),
  });
  subscriptions.set(id, subscription);
};

const onUnsubscribe = (id: string) => {
  const subscription = subscriptions.get(id);
  subscription?.unsubscribe();
  subscription?.removeAllListeners();
  subscriptions.delete(id);
};

const onPublish = (id: string, data: any) => {
  centrifuge.publish(id, data);
};

// @ts-ignore
self.onmessage = (event) => {
  const req: WorkerRequest = event.data;
  switch (req.type) {
    case WorkerRequestType.Connect:
      return onConnect(req.sessionId, req.liveUrl);
    case WorkerRequestType.Subscribe:
      return onSubscribe(req.id);
    case WorkerRequestType.Unsubscribe:
      return onUnsubscribe(req.id);
    case WorkerRequestType.Publish:
      return onPublish(req.id, req.data);
  }
};
