/* Prometheus internal models */

import { DataSourceInstanceSettings } from '@grafana/data';
import { PromAlertingRuleState, PromRuleType, RulerRuleDTO, Labels, Annotations } from './unified-alerting-dto';

export type Alert = {
  activeAt: string;
  annotations: { [key: string]: string };
  labels: { [key: string]: string };
  state: PromAlertingRuleState;
  value: string;
};

interface RuleBase {
  health: string;
  name: string;
  query: string;
  lastEvaluation?: string;
  evaluationTime?: number;
  lastError?: string;
}

export interface AlertingRule extends RuleBase {
  alerts: Alert[];
  labels: {
    [key: string]: string;
  };
  annotations?: {
    [key: string]: string;
  };
  state: PromAlertingRuleState;
  type: PromRuleType.Alerting;
}

export interface RecordingRule extends RuleBase {
  type: PromRuleType.Recording;

  labels?: {
    [key: string]: string;
  };
}

export type Rule = AlertingRule | RecordingRule;

export type BaseRuleGroup = { name: string };

export interface RuleGroup {
  name: string;
  interval: number;
  rules: Rule[];
}

export interface RuleNamespace {
  dataSourceName: string;
  name: string;
  groups: RuleGroup[];
}

export interface RulesSourceResult {
  dataSourceName: string;
  error?: unknown;
  namespaces?: RuleNamespace[];
}

export type RulesSource = DataSourceInstanceSettings | 'grafana';

// combined prom and ruler result
export interface CombinedRule {
  name: string;
  query: string;
  labels: Labels;
  annotations: Annotations;
  promRule?: Rule;
  rulerRule?: RulerRuleDTO;
}

export interface CombinedRuleGroup {
  name: string;
  rules: CombinedRule[];
}

export interface CombinedRuleNamespace {
  rulesSource: RulesSource;
  name: string;
  groups: CombinedRuleGroup[];
}

export interface RuleLocation {
  ruleSourceName: string;
  namespace: string;
  groupName: string;
}

export interface CloudRuleIdentifier extends RuleLocation {
  ruleHash: number;
}

export interface GrafanaRuleIdentifier {
  uid: string;
}

export type RuleIdentifier = CloudRuleIdentifier | GrafanaRuleIdentifier;
