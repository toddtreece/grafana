import { AppEvents } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { createAsyncThunk } from '@reduxjs/toolkit';
import { appEvents } from 'app/core/core';
import { AlertManagerCortexConfig, Silence } from 'app/plugins/datasource/alertmanager/types';
import { ThunkResult } from 'app/types';
import { RuleIdentifier, RuleNamespace, RuleWithLocation } from 'app/types/unified-alerting';
import { RulerGrafanaRuleDTO, RulerRuleGroupDTO, RulerRulesConfigDTO } from 'app/types/unified-alerting-dto';
import { fetchAlertManagerConfig, fetchSilences } from '../api/alertmanager';
import { fetchRules } from '../api/prometheus';
import {
  deleteRulerRulesGroup,
  fetchRulerRules,
  fetchRulerRulesGroup,
  fetchRulerRulesNamespace,
  setRulerRuleGroup,
} from '../api/ruler';
import { RuleFormType, RuleFormValues } from '../types/rule-form';
import { getAllRulesSourceNames, GRAFANA_RULES_SOURCE_NAME, isGrafanaRulesSource } from '../utils/datasource';
import { withSerializedError } from '../utils/redux';
import { formValuesToRulerAlertingRuleDTO, formValuesToRulerGrafanaRuleDTO } from '../utils/rule-form';
import {
  getRuleIdentifier,
  hashRulerRule,
  isGrafanaRuleIdentifier,
  isRulerNotSupportedResponse,
  ruleWithLocationToRuleIdentifier,
  stringifyRuleIdentifier,
} from '../utils/rules';

export const fetchPromRulesAction = createAsyncThunk(
  'unifiedalerting/fetchPromRules',
  (rulesSourceName: string): Promise<RuleNamespace[]> => withSerializedError(fetchRules(rulesSourceName))
);

export const fetchAlertManagerConfigAction = createAsyncThunk(
  'unifiedalerting/fetchAmConfig',
  (alertManagerSourceName: string): Promise<AlertManagerCortexConfig> =>
    withSerializedError(fetchAlertManagerConfig(alertManagerSourceName))
);

export const fetchRulerRulesAction = createAsyncThunk(
  'unifiedalerting/fetchRulerRules',
  (rulesSourceName: string): Promise<RulerRulesConfigDTO | null> => {
    return withSerializedError(fetchRulerRules(rulesSourceName));
  }
);

export const fetchSilencesAction = createAsyncThunk(
  'unifiedalerting/fetchSilences',
  (alertManagerSourceName: string): Promise<Silence[]> => {
    return withSerializedError(fetchSilences(alertManagerSourceName));
  }
);

// this will only trigger ruler rules fetch if rules are not loaded yet and request is not in flight
export function fetchRulerRulesIfNotFetchedYet(dataSourceName: string): ThunkResult<void> {
  return (dispatch, getStore) => {
    const { rulerRules } = getStore().unifiedAlerting;
    const resp = rulerRules[dataSourceName];
    if (!resp?.result && !(resp && isRulerNotSupportedResponse(resp)) && !resp?.loading) {
      dispatch(fetchRulerRulesAction(dataSourceName));
    }
  };
}

export function fetchAllPromAndRulerRulesAction(force = false): ThunkResult<void> {
  return (dispatch, getStore) => {
    const { promRules, rulerRules } = getStore().unifiedAlerting;
    getAllRulesSourceNames().map((name) => {
      if (force || !promRules[name]?.loading) {
        dispatch(fetchPromRulesAction(name));
      }
      if (force || !rulerRules[name]?.loading) {
        dispatch(fetchRulerRulesAction(name));
      }
    });
  };
}

async function findExistingRule(ruleIdentifier: RuleIdentifier): Promise<RuleWithLocation | null> {
  if (isGrafanaRuleIdentifier(ruleIdentifier)) {
    const namespaces = await fetchRulerRules(GRAFANA_RULES_SOURCE_NAME);
    // find namespace and group that contains the uid for the rule
    for (const [namespace, groups] of Object.entries(namespaces)) {
      for (const group of groups) {
        const rule = group.rules.find((rule: RulerGrafanaRuleDTO) => rule.grafana_alert?.uid === ruleIdentifier.uid);
        if (rule) {
          return {
            group,
            ruleSourceName: GRAFANA_RULES_SOURCE_NAME,
            namespace: namespace,
            rule,
          };
        }
      }
    }
  } else {
    const { ruleSourceName, namespace, groupName, ruleHash } = ruleIdentifier;
    const group = await fetchRulerRulesGroup(ruleSourceName, namespace, groupName);
    if (group) {
      const rule = group.rules.find((rule) => hashRulerRule(rule) === ruleHash);
      if (rule) {
        return {
          group,
          ruleSourceName,
          namespace,
          rule,
        };
      }
    }
  }
  return null;
}

export const fetchExistingRuleAction = createAsyncThunk(
  'unifiedalerting/fetchExistingRule',
  (ruleIdentifier: RuleIdentifier): Promise<RuleWithLocation | null> =>
    withSerializedError(findExistingRule(ruleIdentifier))
);

async function deleteRule(ruleWithLocation: RuleWithLocation): Promise<void> {
  const { ruleSourceName, namespace, group, rule } = ruleWithLocation;
  // in case of GRAFANA, each group implicitly only has one rule. delete the group.
  if (isGrafanaRulesSource(ruleSourceName)) {
    await deleteRulerRulesGroup(GRAFANA_RULES_SOURCE_NAME, namespace, group.name);
    // in case of CLOUD
  } else {
    // it was the last rule, delete the entire group
    if (group.rules.length === 1) {
      await deleteRulerRulesGroup(ruleSourceName, namespace, group.name);
    } else {
      // post the group with rule removed
      await setRulerRuleGroup(ruleSourceName, namespace, {
        ...group,
        rules: group.rules.filter((r) => r !== rule),
      });
    }
  }
}

export function deleteRuleAction(ruleIdentifier: RuleIdentifier): ThunkResult<void> {
  /*
   * fetch the rules group from backend, delete group if it is found and+
   * reload ruler rules
   */
  return async (dispatch) => {
    const ruleWithLocation = await findExistingRule(ruleIdentifier);
    if (!ruleWithLocation) {
      throw new Error('Rule not found.');
    }
    await deleteRule(ruleWithLocation);
    // refetch rules for this rules source
    return dispatch(fetchRulerRulesAction(ruleWithLocation.ruleSourceName));
  };
}

async function saveLotexRule(values: RuleFormValues, existing?: RuleWithLocation): Promise<RuleIdentifier> {
  const { dataSourceName, location } = values;
  const formRule = formValuesToRulerAlertingRuleDTO(values);
  if (dataSourceName && location) {
    // if we're updating a rule...
    if (existing) {
      // refetch it so we always have the latest greatest
      const freshExisting = await findExistingRule(ruleWithLocationToRuleIdentifier(existing));
      if (!freshExisting) {
        throw new Error('Rule not found.');
      }
      // if namespace or group was changed, delete the old rule
      if (freshExisting.namespace !== location.namespace || freshExisting.group.name !== location.group) {
        await deleteRule(freshExisting);
      } else {
        // if same namespace or group, update the group replacing the old rule with new
        const payload = {
          ...freshExisting.group,
          rules: freshExisting.group.rules.map((existingRule) =>
            existingRule === freshExisting.rule ? formRule : existingRule
          ),
        };
        await setRulerRuleGroup(dataSourceName, location.namespace, payload);
        return getRuleIdentifier(dataSourceName, location.namespace, location.group, formRule);
      }
    }

    // if creating new rule or existing rule was in a different namespace/group, create new rule in target group

    const targetGroup = await fetchRulerRulesGroup(dataSourceName, location.namespace, location.group);

    const payload: RulerRuleGroupDTO = targetGroup
      ? {
          ...targetGroup,
          rules: [...targetGroup.rules, formRule],
        }
      : {
          name: location.group,
          rules: [formRule],
        };

    await setRulerRuleGroup(dataSourceName, location.namespace, payload);
    return getRuleIdentifier(dataSourceName, location.namespace, location.group, formRule);
  } else {
    throw new Error('Data source and location must be specified');
  }
}

async function saveGrafanaRule(values: RuleFormValues, existing?: RuleWithLocation): Promise<RuleIdentifier> {
  const { folder, evaluateEvery } = values;
  const formRule = formValuesToRulerGrafanaRuleDTO(values);
  if (folder) {
    // updating an existing rule...
    if (existing) {
      // refetch it to be sure we have the latest
      const freshExisting = await findExistingRule(ruleWithLocationToRuleIdentifier(existing));
      if (!freshExisting) {
        throw new Error('Rule not found.');
      }

      // if folder has changed, delete the old one
      if (freshExisting.namespace !== folder.title) {
        await deleteRule(freshExisting);
        // if same folder, repost the group with updated rule
      } else {
        const uid = (freshExisting.rule as RulerGrafanaRuleDTO).grafana_alert.uid!;
        formRule.grafana_alert.uid = uid;
        await setRulerRuleGroup(GRAFANA_RULES_SOURCE_NAME, freshExisting.namespace, {
          name: freshExisting.group.name,
          interval: evaluateEvery,
          rules: [formRule],
        });
        return { uid };
      }
    }

    // if creating new rule or folder was changed, create rule in a new group

    const existingNamespace = await fetchRulerRulesNamespace(GRAFANA_RULES_SOURCE_NAME, folder.title);

    // set group name to rule name, but be super paranoid and check that this group does not already exist
    let group = values.name;
    let idx = 1;
    while (!!existingNamespace.find((g) => g.name === group)) {
      group = `${values.name}-${++idx}`;
    }

    const payload: RulerRuleGroupDTO = {
      name: group,
      interval: evaluateEvery,
      rules: [formRule],
    };
    await setRulerRuleGroup(GRAFANA_RULES_SOURCE_NAME, folder.title, payload);

    // now refetch this group to get the uid, hah
    const result = await fetchRulerRulesGroup(GRAFANA_RULES_SOURCE_NAME, folder.title, group);
    const newUid = (result?.rules[0] as RulerGrafanaRuleDTO)?.grafana_alert?.uid;
    if (newUid) {
      return { uid: newUid };
    } else {
      throw new Error('Failed to fetch created rule.');
    }
  } else {
    throw new Error('Folder must be specified');
  }
}

export const saveRuleFormAction = createAsyncThunk(
  'unifiedalerting/saveRuleForm',
  ({ values, existing }: { values: RuleFormValues; existing?: RuleWithLocation }): Promise<void> =>
    withSerializedError(
      (async () => {
        const { type } = values;
        // in case of system (cortex/loki)
        let identifier: RuleIdentifier;
        if (type === RuleFormType.system) {
          identifier = await saveLotexRule(values, existing);
          // in case of grafana managed
        } else if (type === RuleFormType.threshold) {
          identifier = await saveGrafanaRule(values, existing);
        } else {
          throw new Error('Unexpected rule form type');
        }
        // redirect to edit page
        const newLocation = `/alerting/${encodeURIComponent(stringifyRuleIdentifier(identifier))}/edit`;
        if (locationService.getLocation().pathname !== newLocation) {
          locationService.replace(newLocation);
        }
        appEvents.emit(AppEvents.alertSuccess, ['Rule saved.']);
      })()
    )
);
