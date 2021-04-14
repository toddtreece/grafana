import { Alert, Button, InfoBox, LoadingPlaceholder } from '@grafana/ui';
import Page from 'app/core/components/Page/Page';
import { useCleanup } from 'app/core/hooks/useCleanup';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { RuleIdentifier } from 'app/types/unified-alerting';
import React, { FC, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { AlertRuleForm } from './components/rule-editor/AlertRuleForm';
import { useUnifiedAlertingSelector } from './hooks/useUnifiedAlertingSelector';
import { fetchExistingRuleAction } from './state/actions';
import { parseRuleIdentifier } from './utils/rules';

const ExistingRuleEditor: FC<{ identifier: RuleIdentifier }> = ({ identifier }) => {
  useCleanup((state) => state.unifiedAlerting.ruleForm.existingRule);
  const { loading, result, error, dispatched } = useUnifiedAlertingSelector((state) => state.ruleForm.existingRule);
  const dispatch = useDispatch();
  useEffect(() => {
    if (!dispatched) {
      dispatch(fetchExistingRuleAction(identifier));
    }
  }, [dispatched, dispatch, identifier]);

  if (loading) {
    return (
      <Page.Contents>
        <LoadingPlaceholder text="Loading rule..." />
      </Page.Contents>
    );
  }
  if (error) {
    return (
      <Page.Contents>
        <Alert severity="error" title="Failed to load rule">
          {error.message}
        </Alert>
      </Page.Contents>
    );
  }
  if (!result) {
    return (
      <Page.Contents>
        <InfoBox severity="warning" title="Rule not found">
          <p>Sorry! This rule does not exist.</p>
          <a href="/alerting/list">
            <Button>To rule list</Button>
          </a>
        </InfoBox>
      </Page.Contents>
    );
  }
  return <AlertRuleForm existing={result} />;
};

const RuleEditor: FC<GrafanaRouteComponentProps<{ id?: string }>> = ({ match }) => {
  const id = match.params.id;
  if (id) {
    const identifier = parseRuleIdentifier(decodeURIComponent(id));
    return <ExistingRuleEditor key={id} identifier={identifier} />;
  }
  return <AlertRuleForm />;
};

export default RuleEditor;
