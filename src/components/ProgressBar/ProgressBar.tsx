import React, { useState, useEffect, useRef } from 'react';
import {
  Card,
  CardBody,
  IconButton,
  DropdownMenu,
  ActionListItem,
  Switch,
  Spinner,
  DatePicker,
  SelectInput,
} from '@faclon-labs/design-sdk';
import '@faclon-labs/design-sdk/styles.css';
import { getWidgetData, extractValue } from '../../iosense-sdk/api';
import type {
  WidgetProps,
  ProgressBarConfig,
  ProgressBarChartEntry,
  ProgressBarStyle,
  WidgetDataConfigEntry,
} from '../../iosense-sdk/types';
import './ProgressBar.css';

// ─── Inline SVG icons ────────────────────────────────────────────────────────

const SettingsIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" />
  </svg>
);

const ExportIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

// ─── Periodicity options ─────────────────────────────────────────────────────

const PERIODICITY_OPTIONS = [
  { label: 'Monthly', value: 'month' },
  { label: 'Weekly', value: 'week' },
  { label: 'Daily', value: 'day' },
  { label: 'Hourly', value: 'hour' },
];

// ─── Component ───────────────────────────────────────────────────────────────

export function ProgressBar({
  config,
  data,
  authentication,
  timeChange,
}: WidgetProps) {
  // ── Sync config + data props into state (required for Lens update() to work)
  const [localConfig, setLocalConfig] = useState<ProgressBarConfig | undefined>(config);
  const [localData, setLocalData] = useState<unknown>(data);

  useEffect(() => { setLocalConfig(config); }, [config]);
  useEffect(() => { setLocalData(data); }, [data]);

  // ── Data state
  const [resolvedValues, setResolvedValues] = useState<Record<string, number | null>>({});
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // ── UI state
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [periodicityOpen, setPeriodicityOpen] = useState(false);
  const [periodicity, setPeriodicity] = useState('day');
  const [timeRange, setTimeRange] = useState({
    start: new Date(Date.now() - 24 * 60 * 60 * 1000),
    end: new Date(),
  });

  // ── Click-outside refs for dropdowns
  const settingsRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ── Fetch on config/time/periodicity change (self-fetch mode when data prop is undefined)
  useEffect(() => {
    if (localData !== undefined) return;
    if (!localConfig?.charts?.length) return;
    performFetch();
  }, [localConfig, localData, timeRange, periodicity]);

  // ── Passive render from data prop
  useEffect(() => {
    if (localData === undefined) return;
    processPassiveData(localData);
  }, [localData]);

  // ─────────────────────────────────────────────────────────────────────────
  // Data fetching
  // ─────────────────────────────────────────────────────────────────────────

  async function performFetch() {
    const charts = localConfig?.charts ?? [];
    const apiConfigs: WidgetDataConfigEntry[] = [];

    charts.forEach((chart, index) => {
      const dc = chart.dataConfig;
      if (!dc?.type) return;

      const entry: WidgetDataConfigEntry = {
        type: dc.type,
        operator: dc.operator ?? 'LastDP',
        key: `current_${index}`,
      };

      if (dc.type === 'device') {
        if (!dc.devID || !dc.sensor) return;
        entry.devID = dc.devID;
        entry.sensor = dc.sensor;
      } else if (dc.type === 'cluster') {
        if (!dc.clusterID) return;
        entry.clusterID = dc.clusterID;
      } else if (dc.type === 'compute') {
        if (!dc.flowID) return;
        entry.flowId = dc.flowID;
        if (dc.flowParams) entry.flowParams = dc.flowParams;
      }

      apiConfigs.push(entry);

      // Dynamic target source
      const tdc = chart.targetDataConfig;
      if (tdc?.type) {
        const targetEntry: WidgetDataConfigEntry = {
          type: tdc.type,
          operator: tdc.operator ?? 'LastDP',
          key: `target_${index}`,
        };

        if (tdc.type === 'device' && tdc.devID && tdc.sensor) {
          targetEntry.devID = tdc.devID;
          targetEntry.sensor = tdc.sensor;
        } else if (tdc.type === 'cluster' && tdc.clusterID) {
          targetEntry.clusterID = tdc.clusterID;
        } else if (tdc.type === 'compute' && tdc.flowID) {
          targetEntry.flowId = tdc.flowID;
        }

        apiConfigs.push(targetEntry);
      }
    });

    if (apiConfigs.length === 0) return;

    setLoading(true);
    setFetchError(null);

    try {
      const response = await getWidgetData(
        authentication,
        apiConfigs,
        timeRange.start.getTime(),
        timeRange.end.getTime(),
        localConfig?.time?.timezone ?? 'Asia/Calcutta',
        periodicity
      );

      const values: Record<string, number | null> = {};
      const isLastDp = (op?: string) =>
        op === 'LastDP' || op === 'FirstDP';

      apiConfigs.forEach((cfg) => {
        values[cfg.key] = extractValue(
          response,
          cfg.key,
          periodicity,
          !isLastDp(cfg.operator)
        );
      });

      setResolvedValues(values);
    } catch {
      setFetchError('Failed to fetch data. Check your connection.');
    } finally {
      setLoading(false);
    }
  }

  function processPassiveData(rawData: unknown) {
    // Passive render: parent dashboard has resolved data and passed it as prop.
    // Expected shape mirrors getWidgetData response — extract by key.
    try {
      const response = rawData as Parameters<typeof extractValue>[0];
      const values: Record<string, number | null> = {};
      const charts = localConfig?.charts ?? [];
      charts.forEach((chart, index) => {
        values[`current_${index}`] = extractValue(response, `current_${index}`, periodicity);
        if (chart.targetDataConfig?.type) {
          values[`target_${index}`] = extractValue(response, `target_${index}`, periodicity);
        }
      });
      setResolvedValues(values);
    } catch {
      // Silently ignore — passively-pushed data may have a different shape
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Date range change — emit timeChange (unidirectional) + refetch in self-fetch mode
  // ─────────────────────────────────────────────────────────────────────────

  function handleRangeChange(range: { start: Date; end: Date }) {
    setTimeRange(range);
    if (timeChange) {
      timeChange({
        startTime: range.start.getTime(),
        endTime: range.end.getTime(),
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Export handlers (stub — implement CSV/image as needed)
  // ─────────────────────────────────────────────────────────────────────────

  function handleExport(format: string) {
    setExportOpen(false);
    console.info(`[ProgressBar] Export as ${format} — implement as needed`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render helpers
  // ─────────────────────────────────────────────────────────────────────────

  const charts = localConfig?.charts ?? [];
  const style: ProgressBarStyle = localConfig?.style ?? {};
  const showTimePicker = localConfig?.time?.timeType !== 'fixed';
  const iconColor = style.iconColor ?? 'var(--text-default-secondary)';
  const iconStyle = { color: iconColor };

  const selectedPeriodicity = PERIODICITY_OPTIONS.find((p) => p.value === periodicity);

  function renderBar(chart: ProgressBarChartEntry, index: number) {
    const currentVal = resolvedValues[`current_${index}`] ?? null;
    const targetVal =
      chart.targetStaticValue !== undefined
        ? chart.targetStaticValue
        : (resolvedValues[`target_${index}`] ?? null);

    const percentage =
      currentVal !== null && targetVal !== null && targetVal > 0
        ? Math.min(100, Math.max(0, (currentVal / targetVal) * 100))
        : null;

    const precision = chart.dataPrecision ?? chart.dataConfig?.dataPrecision ?? 1;
    const unit = chart.unit ?? chart.dataConfig?.unit ?? '';
    const barColor = chart.color ?? 'var(--background-brand-default)';
    const barH = style.barHeight ?? '10px';

    const pctColor =
      percentage === null
        ? 'var(--text-default-tertiary)'
        : percentage >= 90
        ? 'var(--text-negative-default)'
        : percentage >= 70
        ? 'var(--text-notice-default)'
        : 'var(--text-positive-default)';

    return (
      <div className="progress-bar-widget__item" id={`bar-item-${index}`}>
        <div className="progress-bar-widget__item-row">
          <span
            className="progress-bar-widget__item-label BodyMediumMedium"
            style={{ color: style.fontColor ?? 'var(--text-default-primary)', fontSize: style.fontSize }}
          >
            {chart.label || `Bar ${index + 1}`}
          </span>

          <span className="progress-bar-widget__item-meta d-flex" style={{ gap: 'var(--spacing-02)' }}>
            {(style.showValue ?? true) && (
              <span
                className="BodySmallRegular"
                style={{ color: 'var(--text-default-secondary)' }}
              >
                {currentVal !== null
                  ? `${currentVal.toFixed(precision)}${targetVal !== null ? ` / ${targetVal.toFixed(precision)}` : ''} ${unit}`
                  : '—'}
              </span>
            )}
            {(style.showPercentage ?? true) && percentage !== null && (
              <span
                className="LabelSmallMedium"
                style={{ color: pctColor, minWidth: '38px', textAlign: 'right' }}
              >
                {percentage.toFixed(1)}%
              </span>
            )}
          </span>
        </div>

        <div
          className="progress-bar-widget__track"
          style={{ height: barH, borderRadius: `calc(${barH} / 2)` }}
        >
          <div
            className="progress-bar-widget__fill"
            style={{
              width: percentage !== null ? `${percentage}%` : '0%',
              background: barColor,
              height: barH,
              borderRadius: `calc(${barH} / 2)`,
            }}
          />
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Main render
  // ─────────────────────────────────────────────────────────────────────────

  const inner = (
    <div className="progress-bar-widget">
      {/* ── Row 1: Header ─────────────────────────────────────────────────── */}
      <div className="progress-bar-widget__header d-flex">
        <span
          className="progress-bar-widget__title HeadingXSmallSemibold"
          style={{ color: style.fontColor ?? 'var(--text-default-primary)', fontSize: style.fontSize }}
        >
          {style.title || 'Progress Bar'}
        </span>

        <div className="d-flex" style={{ gap: 'var(--spacing-01)', alignItems: 'center' }}>
          {/* Settings dropdown */}
          <div ref={settingsRef} style={{ position: 'relative' }}>
            <IconButton
              icon={<span style={iconStyle}><SettingsIcon /></span>}
              variant="Tertiary"
              size="Small"
              onClick={() => { setSettingsOpen((o) => !o); setExportOpen(false); }}
            />
            {settingsOpen && (
              <div className="progress-bar-widget__dropdown-anchor">
                <DropdownMenu>
                  <ActionListItem
                    contentType="Item"
                    title="Show Percentage"
                    trailingItem={
                      <Switch
                        size="Small"
                        isChecked={style.showPercentage ?? true}
                        onChange={() => {}}
                      />
                    }
                  />
                  <ActionListItem
                    contentType="Item"
                    title="Show Value"
                    trailingItem={
                      <Switch
                        size="Small"
                        isChecked={style.showValue ?? true}
                        onChange={() => {}}
                      />
                    }
                  />
                </DropdownMenu>
              </div>
            )}
          </div>

          {/* Export dropdown */}
          <div ref={exportRef} style={{ position: 'relative' }}>
            <IconButton
              icon={<span style={iconStyle}><ExportIcon /></span>}
              variant="Tertiary"
              size="Small"
              onClick={() => { setExportOpen((o) => !o); setSettingsOpen(false); }}
            />
            {exportOpen && (
              <div className="progress-bar-widget__dropdown-anchor">
                <DropdownMenu>
                  <ActionListItem contentType="Item" title="Export CSV" onClick={() => handleExport('csv')} />
                  <ActionListItem contentType="Item" title="Export XLSX" onClick={() => handleExport('xlsx')} />
                  <ActionListItem contentType="Item" title="Export Image" onClick={() => handleExport('image')} />
                </DropdownMenu>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Row 2: Date & Periodicity (hidden when timeType = 'fixed') ──── */}
      {showTimePicker && (
        <div className="progress-bar-widget__controls d-flex">
          <div style={{ position: 'relative', flex: 1 }}>
            <button
              className="progress-bar-widget__date-trigger LabelSmallRegular"
              onClick={() => setDatePickerOpen((o) => !o)}
            >
              {timeRange.start.toLocaleDateString()} – {timeRange.end.toLocaleDateString()}
            </button>
            {datePickerOpen && (
              <div className="progress-bar-widget__datepicker-anchor">
                <DatePicker
                  mode="range"
                  isOpen={datePickerOpen}
                  rangeValue={timeRange}
                  onRangeChange={(range) => {
                    handleRangeChange(range as { start: Date; end: Date });
                    setDatePickerOpen(false);
                  }}
                />
              </div>
            )}
          </div>

          <div style={{ width: '130px' }}>
            <SelectInput
              label="Periodicity"
              value={selectedPeriodicity?.label ?? 'Daily'}
              isOpen={periodicityOpen}
              onClick={() => setPeriodicityOpen((o) => !o)}
            >
              <DropdownMenu>
                {PERIODICITY_OPTIONS.map((p) => (
                  <ActionListItem
                    id={p.value}
                    contentType="Item"
                    title={p.label}
                    isSelected={p.value === periodicity}
                    onClick={() => { setPeriodicity(p.value); setPeriodicityOpen(false); }}
                  />
                ))}
              </DropdownMenu>
            </SelectInput>
          </div>
        </div>
      )}

      {/* ── Row 3: Progress Bars ──────────────────────────────────────────── */}
      <div className="progress-bar-widget__body">
        {loading && (
          <div className="progress-bar-widget__state-center">
            <Spinner size="Medium" label="Loading..." labelPosition="Right" />
          </div>
        )}

        {!loading && fetchError && (
          <div className="progress-bar-widget__state-center progress-bar-widget__error BodySmallRegular">
            {fetchError}
          </div>
        )}

        {!loading && !fetchError && charts.length === 0 && (
          <div className="progress-bar-widget__state-center BodySmallRegular" style={{ color: 'var(--text-default-tertiary)' }}>
            No data sources configured. Open settings to add bars.
          </div>
        )}

        {!loading && !fetchError && charts.map((chart, index) => renderBar(chart, index))}
      </div>
    </div>
  );

  // Optionally wrap in Card
  if (style.wrapInCard !== false) {
    return (
      <div className="progress-bar-widget__outer">
        <Card
          elevation="LowRaised"
          style={{
            background: style.backgroundColor,
            border: style.borderColor ? `${style.borderWidth ?? '1px'} solid ${style.borderColor}` : undefined,
            borderRadius: style.borderRadius,
            padding: style.padding,
          }}
          body={<CardBody>{inner}</CardBody>}
        />
      </div>
    );
  }

  return <div className="progress-bar-widget__outer">{inner}</div>;
}
