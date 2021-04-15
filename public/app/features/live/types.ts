import {
  PublicationContext,
  SubscribeErrorContext,
  SubscribeSuccessContext,
  UnsubscribeContext,
} from 'centrifuge/dist/centrifuge';

export enum WorkerEventEnum {
  Connected,
  Disconnected,
  Subscribed,
  Unsubscribed,
  SubscriptionFailed,
  Received,
}
export interface WorkerConnected {
  type: WorkerEventEnum.Connected;
}

export interface WorkerDisconnected {
  type: WorkerEventEnum.Disconnected;
}

export interface WorkerSubscribed {
  type: WorkerEventEnum.Subscribed;
  id: string;
  context: SubscribeSuccessContext;
}

export interface WorkerSubscriptionFailed {
  type: WorkerEventEnum.SubscriptionFailed;
  id: string;
  context: SubscribeErrorContext;
}

export interface WorkerUnsubscribed {
  type: WorkerEventEnum.Unsubscribed;
  id: string;
  context: UnsubscribeContext;
}

export interface WorkerReceived {
  type: WorkerEventEnum.Received;
  id: string;
  context: PublicationContext;
}

export type WorkerSubscriptionEventType =
  | WorkerEventEnum.Received
  | WorkerEventEnum.Subscribed
  | WorkerEventEnum.SubscriptionFailed
  | WorkerEventEnum.Unsubscribed;

export type WorkerEventType = WorkerEventEnum.Connected | WorkerEventEnum.Disconnected | WorkerSubscriptionEventType;

export type WorkerSubscriptionEvent = WorkerSubscribed | WorkerUnsubscribed | WorkerSubscriptionFailed | WorkerReceived;

export type WorkerEvent = WorkerConnected | WorkerDisconnected | WorkerSubscriptionEvent;

export enum WorkerRequestType {
  Connect,
  Subscribe,
  Unsubscribe,
  Publish,
}

export interface WorkerConnect {
  type: WorkerRequestType.Connect;
  sessionId: string;
  liveUrl: string;
}

export interface WorkerSubscribe {
  type: WorkerRequestType.Subscribe;
  id: string;
}

export interface WorkerUnsubscribe {
  type: WorkerRequestType.Unsubscribe;
  id: string;
}

export interface WorkerPublish {
  type: WorkerRequestType.Publish;
  id: string;
  data: any;
}

export type WorkerRequest = WorkerSubscribe | WorkerUnsubscribe | WorkerPublish | WorkerConnect;
