import { DataFrameFieldIndex, DisplayValue } from '@grafana/data';
import { LegendDisplayMode, LegendPlacement } from './models.gen';

export interface VizLegendBaseProps {
  placement: LegendPlacement;
  className?: string;
  items: VizLegendItem[];
  itemRenderer?: (item: VizLegendItem, index: number) => JSX.Element;
  onSeriesColorChange?: SeriesColorChangeHandler;
  onLabelClick?: (item: VizLegendItem, event: React.MouseEvent<HTMLElement>) => void;
}

export interface VizLegendTableProps extends VizLegendBaseProps {
  sortBy?: string;
  sortDesc?: boolean;
  onToggleSort?: (sortBy: string) => void;
}

export interface LegendProps extends VizLegendBaseProps, VizLegendTableProps {
  displayMode: LegendDisplayMode;
}

export interface VizLegendItem {
  getItemKey?: () => string;
  label: string;
  color: string;
  yAxis: number;
  disabled?: boolean;
  // displayValues?: DisplayValue[];
  getDisplayValues?: () => DisplayValue[];
  fieldIndex?: DataFrameFieldIndex;
}

export type SeriesOptionChangeHandler<TOption> = (label: string, option: TOption) => void;
export type SeriesColorChangeHandler = SeriesOptionChangeHandler<string>;
