import Centrifuge from 'centrifuge/dist/centrifuge';
import { config } from '@grafana/runtime';
import { WorkerEventEnum, WorkerRequest, WorkerRequestType, WorkerEventType } from './types';

const liveUrl = `${config.appUrl}live/ws`.replace(/^(http)(s)?:\/\//, 'ws$2://');
const subscriptions = new Map<string, Centrifuge.Subscription>();
const centrifuge = new Centrifuge(liveUrl, {
  debug: true,
});

// @ts-ignore
const eventFn = (id: string, type: WorkerEventType) => (context) => postMessage({ type, id, context });

const onConnect = (sessionId: string) => {
  centrifuge.setConnectData({
    sessionId: sessionId,
  });
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

addEventListener('message', (event) => {
  const req: WorkerRequest = event.data;
  switch (req.type) {
    case WorkerRequestType.Connect:
      return onConnect(req.sessionId);
    case WorkerRequestType.Subscribe:
      return onSubscribe(req.id);
    case WorkerRequestType.Unsubscribe:
      return onUnsubscribe(req.id);
    case WorkerRequestType.Publish:
      return onPublish(req.id, req.data);
  }
});

// @ts-ignore
centrifuge.on('connect', () => postMessage({ type: WorkerEventEnum.Connected }));
// @ts-ignore
centrifuge.on('disconnect', () => postMessage({ type: WorkerEventEnum.Disconnected }));
