// ─────────────────────────────────────────────────────────────────────────────
// IOsense Data Config — standardised schema (critical rule: all source
// bindings live under charts[n].dataConfig, never at top-level config)
// ─────────────────────────────────────────────────────────────────────────────

export type SourceType = 'device' | 'cluster' | 'compute';

export interface DataConfig {
  // ── Source type (always required) ──────────────────────────────────────────
  type: SourceType;

  // ── Device fields (type === 'device') ──────────────────────────────────────
  devID?: string;
  devTypeID?: string;
  sensor?: string;
  operator?: string; // Sum | Min | Max | LastDP | FirstDP | Consumption | RunHours

  // ── Cluster fields (type === 'cluster') ────────────────────────────────────
  clusterID?: string;
  clusterOperator?: string; // Sum | Mean | Max | Min | Median | Mode

  // ── Compute fields (type === 'compute') ────────────────────────────────────
  flowID?: string;
  flowParams?: string;

  // ── Shared fields ───────────────────────────────────────────────────────────
  unit?: string;
  dataPrecision?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Progress Bar — one entry per bar (charts array entry)
// ─────────────────────────────────────────────────────────────────────────────

export type TargetType = 'static' | SourceType;

export interface ProgressBarChartEntry {
  // ── Data binding (mandatory, follows standardised schema) ──────────────────
  dataConfig: DataConfig;

  // ── Target / max binding ───────────────────────────────────────────────────
  // Use targetDataConfig for a dynamic target (device/cluster/compute source).
  // Use targetStaticValue for a hardcoded number.
  targetDataConfig?: DataConfig;
  targetStaticValue?: number;

  // ── Display ────────────────────────────────────────────────────────────────
  label?: string;
  color?: string;
  unit?: string;
  dataPrecision?: number;

  // ── Config-panel helpers (not used by widget renderer) ─────────────────────
  devName?: string;
  clusterName?: string;
  targetDevName?: string;
  targetClusterName?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Style config
// ─────────────────────────────────────────────────────────────────────────────

export interface ProgressBarStyle {
  // Card wrapper
  wrapInCard?: boolean;
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: string;
  borderRadius?: string;
  padding?: string;

  // Bar appearance
  barHeight?: string;
  showPercentage?: boolean;
  showValue?: boolean;
  orientation?: 'horizontal' | 'vertical';

  // Typography
  fontSize?: string;
  fontColor?: string;
  fontWeight?: string;

  // Widget title
  title?: string;
  iconColor?: string;
  iconSize?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Time config
// ─────────────────────────────────────────────────────────────────────────────

export interface ProgressBarTimeConfig {
  timezone?: string;
  timeType?: 'localTimePicker' | 'fixed';
  cycleTimeIdentifier?: 'start' | 'end';
  cycleHour?: string;
  cycleMinute?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Top-level widget config
// ─────────────────────────────────────────────────────────────────────────────

export interface ProgressBarConfig {
  charts: ProgressBarChartEntry[]; // always array — even for single bar
  style?: ProgressBarStyle;
  time?: ProgressBarTimeConfig;
}

// ─────────────────────────────────────────────────────────────────────────────
// IOsense domain types
// ─────────────────────────────────────────────────────────────────────────────

export interface Sensor {
  sensorId: string;
  sensorName: string;
}

export interface Device {
  devID: string;
  devName: string;
  devTypeID: string;
  devTypeName: string;
  sensors: Sensor[];
  unitSelected: Record<string, string>;
  tags: string[];
}

export interface DevConfig {
  _id: string;
  device: { _id: string; devName: string };
  sensor: string;
  devType: string;
  percentage: number;
  isProductionDevice: boolean;
}

export interface Cluster {
  _id: string;
  name: string;
  unit: string;
  tags: string[];
  star: boolean;
  archive: boolean;
  isFixedValue: boolean;
  fixedValue?: number | string;
  devConfigs: DevConfig[];
  createdAt: string;
  updatedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// API response shapes
// ─────────────────────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data: T;
}

export interface WidgetDataEntry {
  type: string;
  devID?: string;
  sensor?: string;
  clusterID?: string;
  operator: string;
  key: string;
  data: string | number;
}

export interface WidgetDataResponse {
  success: boolean;
  data: {
    data: Record<string, Record<string, WidgetDataEntry[]>>;
    labelConfig?: Record<string, Record<string, string>>;
  };
  errors?: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Widget props contract
// ─────────────────────────────────────────────────────────────────────────────

export interface WidgetProps {
  config?: ProgressBarConfig;
  data?: unknown;
  authentication?: string;
  timeChange?: (payload: { startTime: number | string; endTime: number | string }) => void;
  chartChange?: (payload: { activeIndex: number }) => void;
}

export interface ConfigurationProps {
  config?: ProgressBarConfig;
  authentication?: string;
  onChange: (config: ProgressBarConfig) => void;
}
