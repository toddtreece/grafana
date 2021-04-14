import React, { FC } from 'react';
import { css } from 'emotion';
import { Alert, useStyles } from '@grafana/ui';
import { GrafanaTheme } from '@grafana/data';
import { DashboardInitError, AppNotificationSeverity } from 'app/types';
import { getMessageFromError } from 'app/core/utils/errors';

export interface Props {
  initError?: DashboardInitError;
}

export const DashboardFailed: FC<Props> = ({ initError }) => {
  const styles = useStyles(getStyles);
  if (!initError) {
    return null;
  }

  return (
    <div className={styles.dashboardLoading}>
      <Alert severity={AppNotificationSeverity.Error} title={initError.message}>
        {getMessageFromError(initError.error)}
      </Alert>
    </div>
  );
};

export const getStyles = (theme: GrafanaTheme) => {
  return {
    dashboardLoading: css`
      height: 60vh;
      display: flex;
      align-items: center;
      justify-content: center;
    `,
  };
};
