import React, { useState, useEffect, useRef } from 'react';
import {
  Tabs,
  TabItem,
  Accordion,
  AccordionItem,
  TextInput,
  SelectInput,
  RadioGroup,
  Radio,
  AutocompleteInput,
  Switch,
  Button,
  IconButton,
  DropdownMenu,
  ActionListItem,
  Spinner,
  ColorPicker,
  Divider,
} from '@faclon-labs/design-sdk';
import '@faclon-labs/design-sdk/styles.css';
import { findUserDevices, fetchClusters } from '../../iosense-sdk/api';
import type {
  ConfigurationProps,
  ProgressBarConfig,
  ProgressBarChartEntry,
  DataConfig,
  ProgressBarStyle,
  ProgressBarTimeConfig,
  Device,
  Cluster,
  TargetType,
} from '../../iosense-sdk/types';
import './ProgressBarConfiguration.css';

// ─── Icons ───────────────────────────────────────────────────────────────────

const DeleteIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6M14 11v6" />
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </svg>
);

const AddIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

// ─── Constants ────────────────────────────────────────────────────────────────

const OPERATORS = ['Sum', 'Min', 'Max', 'LastDP', 'FirstDP', 'Consumption', 'RunHours'];
const CLUSTER_OPERATORS = ['Sum', 'Mean', 'Max', 'Min', 'Median', 'Mode'];
const TIMEZONES = ['Asia/Calcutta', 'UTC', 'America/New_York', 'Europe/London', 'Asia/Tokyo', 'Asia/Dubai'];
const FONT_WEIGHTS = ['Regular', 'Medium', 'Semibold', 'Bold'];

function emptyDataConfig(): DataConfig {
  return { type: 'device', operator: 'LastDP' };
}

function emptyBar(): ProgressBarChartEntry {
  return {
    label: '',
    dataConfig: emptyDataConfig(),
    targetStaticValue: 100,
    color: '',
    unit: '',
    dataPrecision: 1,
  };
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ProgressBarConfiguration({ config, authentication, onChange }: ConfigurationProps) {
  // ── Sync config prop into local state (round-trip required) ──────────────
  const [localConfig, setLocalConfig] = useState<ProgressBarConfig>(
    config ?? { charts: [], style: {}, time: {} }
  );

  useEffect(() => {
    if (config) setLocalConfig(config);
  }, [config]);

  // ── Tab state
  const [activeTab, setActiveTab] = useState<'data' | 'time' | 'style'>('data');

  // ── Active bar being configured
  const [activeBarIndex, setActiveBarIndex] = useState(0);

  // ── Device search (current source)
  const [devInput, setDevInput] = useState('');
  const [devOptions, setDevOptions] = useState<Device[]>([]);
  const [devLoading, setDevLoading] = useState(false);
  const devTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Cluster search (current source)
  const [clusterInput, setClusterInput] = useState('');
  const [clusterOptions, setClusterOptions] = useState<Cluster[]>([]);
  const [clusterLoading, setClusterLoading] = useState(false);
  const clusterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Device search (target source)
  const [targetDevInput, setTargetDevInput] = useState('');
  const [targetDevOptions, setTargetDevOptions] = useState<Device[]>([]);
  const [targetDevLoading, setTargetDevLoading] = useState(false);
  const targetDevTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Cluster search (target source)
  const [targetClusterInput, setTargetClusterInput] = useState('');
  const [targetClusterOptions, setTargetClusterOptions] = useState<Cluster[]>([]);
  const [targetClusterLoading, setTargetClusterLoading] = useState(false);
  const targetClusterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Color picker visibility
  const [barColorPickerOpen, setBarColorPickerOpen] = useState(false);

  // ── Reset search inputs when active bar changes
  useEffect(() => {
    const bar = localConfig.charts?.[activeBarIndex];
    if (!bar) return;

    const dc = bar.dataConfig;
    setDevInput(dc?.type === 'device' ? (bar.devName ?? dc.devID ?? '') : '');
    setClusterInput(dc?.type === 'cluster' ? (bar.clusterName ?? dc.clusterID ?? '') : '');

    const tdc = bar.targetDataConfig;
    setTargetDevInput(tdc?.type === 'device' ? (bar.targetDevName ?? tdc.devID ?? '') : '');
    setTargetClusterInput(tdc?.type === 'cluster' ? (bar.targetClusterName ?? tdc.clusterID ?? '') : '');
  }, [activeBarIndex]);

  // ─────────────────────────────────────────────────────────────────────────
  // Config mutation helpers
  // ─────────────────────────────────────────────────────────────────────────

  function emit(updated: ProgressBarConfig) {
    setLocalConfig(updated);
    onChange(updated);
  }

  function updateCharts(updater: (charts: ProgressBarChartEntry[]) => ProgressBarChartEntry[]) {
    const updated: ProgressBarConfig = {
      ...localConfig,
      charts: updater([...(localConfig.charts ?? [])]),
    };
    emit(updated);
  }

  function updateActiveBar(patch: Partial<ProgressBarChartEntry>) {
    updateCharts((charts) => {
      if (!charts[activeBarIndex]) return charts;
      charts[activeBarIndex] = { ...charts[activeBarIndex], ...patch };
      return charts;
    });
  }

  function updateActiveBarDataConfig(patch: Partial<DataConfig>) {
    updateActiveBar({
      dataConfig: { ...(localConfig.charts?.[activeBarIndex]?.dataConfig ?? emptyDataConfig()), ...patch },
    });
  }

  function updateActiveBarTargetDataConfig(patch: Partial<DataConfig>) {
    const existing = localConfig.charts?.[activeBarIndex]?.targetDataConfig ?? emptyDataConfig();
    updateActiveBar({ targetDataConfig: { ...existing, ...patch } });
  }

  function updateStyle(patch: Partial<ProgressBarStyle>) {
    emit({ ...localConfig, style: { ...(localConfig.style ?? {}), ...patch } });
  }

  function updateTime(patch: Partial<ProgressBarTimeConfig>) {
    emit({ ...localConfig, time: { ...(localConfig.time ?? {}), ...patch } });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Bar management
  // ─────────────────────────────────────────────────────────────────────────

  function handleAddBar() {
    updateCharts((charts) => {
      const next = [...charts, emptyBar()];
      setActiveBarIndex(next.length - 1);
      return next;
    });
  }

  function handleDeleteBar(index: number) {
    updateCharts((charts) => {
      const next = charts.filter((_, i) => i !== index);
      if (activeBarIndex >= next.length) {
        setActiveBarIndex(Math.max(0, next.length - 1));
      }
      return next;
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Device search (debounced 300ms)
  // ─────────────────────────────────────────────────────────────────────────

  function debouncedDeviceSearch(value: string) {
    if (devTimerRef.current) clearTimeout(devTimerRef.current);
    devTimerRef.current = setTimeout(async () => {
      setDevLoading(true);
      try {
        const results = await findUserDevices(authentication, value);
        setDevOptions(results);
      } finally {
        setDevLoading(false);
      }
    }, 300);
  }

  function debouncedClusterSearch(value: string) {
    if (clusterTimerRef.current) clearTimeout(clusterTimerRef.current);
    clusterTimerRef.current = setTimeout(async () => {
      setClusterLoading(true);
      try {
        const results = await fetchClusters(authentication, value);
        setClusterOptions(results);
      } finally {
        setClusterLoading(false);
      }
    }, 300);
  }

  function debouncedTargetDeviceSearch(value: string) {
    if (targetDevTimerRef.current) clearTimeout(targetDevTimerRef.current);
    targetDevTimerRef.current = setTimeout(async () => {
      setTargetDevLoading(true);
      try {
        const results = await findUserDevices(authentication, value);
        setTargetDevOptions(results);
      } finally {
        setTargetDevLoading(false);
      }
    }, 300);
  }

  function debouncedTargetClusterSearch(value: string) {
    if (targetClusterTimerRef.current) clearTimeout(targetClusterTimerRef.current);
    targetClusterTimerRef.current = setTimeout(async () => {
      setTargetClusterLoading(true);
      try {
        const results = await fetchClusters(authentication, value);
        setTargetClusterOptions(results);
      } finally {
        setTargetClusterLoading(false);
      }
    }, 300);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Device / cluster selection handlers
  // ─────────────────────────────────────────────────────────────────────────

  function handleDeviceSelect(device: Device) {
    setDevInput(device.devName);
    updateActiveBar({
      devName: device.devName,
      dataConfig: {
        ...(localConfig.charts?.[activeBarIndex]?.dataConfig ?? emptyDataConfig()),
        type: 'device',
        devID: device.devID,
        devTypeID: device.devTypeID,
        sensor: undefined,
      },
    });
  }

  function handleClusterSelect(cluster: Cluster) {
    setClusterInput(cluster.name);
    updateActiveBar({
      clusterName: cluster.name,
      dataConfig: {
        ...(localConfig.charts?.[activeBarIndex]?.dataConfig ?? emptyDataConfig()),
        type: 'cluster',
        clusterID: cluster._id,
      },
    });
  }

  function handleTargetDeviceSelect(device: Device) {
    setTargetDevInput(device.devName);
    updateActiveBar({
      targetDevName: device.devName,
      targetDataConfig: {
        ...(localConfig.charts?.[activeBarIndex]?.targetDataConfig ?? emptyDataConfig()),
        type: 'device',
        devID: device.devID,
        devTypeID: device.devTypeID,
        sensor: undefined,
      },
    });
  }

  function handleTargetClusterSelect(cluster: Cluster) {
    setTargetClusterInput(cluster.name);
    updateActiveBar({
      targetClusterName: cluster.name,
      targetDataConfig: {
        ...(localConfig.charts?.[activeBarIndex]?.targetDataConfig ?? emptyDataConfig()),
        type: 'cluster',
        clusterID: cluster._id,
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Derived state for active bar
  // ─────────────────────────────────────────────────────────────────────────

  const charts = localConfig.charts ?? [];
  const activeBar: ProgressBarChartEntry | undefined = charts[activeBarIndex];
  const dc = activeBar?.dataConfig ?? emptyDataConfig();
  const tdc = activeBar?.targetDataConfig;
  const style = localConfig.style ?? {};
  const time = localConfig.time ?? {};

  // Derive target type from config state
  const targetType: TargetType = tdc?.type ?? 'static';

  // Sensors for active device
  const [activeSensors, setActiveSensors] = useState<{ sensorId: string; sensorName: string }[]>([]);
  const [targetSensors, setTargetSensors] = useState<{ sensorId: string; sensorName: string }[]>([]);

  // When device is selected, sensors come from devOptions match
  useEffect(() => {
    if (dc.type !== 'device' || !dc.devID) {
      setActiveSensors([]);
      return;
    }
    const found = devOptions.find((d) => d.devID === dc.devID);
    if (found) setActiveSensors(found.sensors ?? []);
  }, [dc.devID, devOptions]);

  useEffect(() => {
    if (tdc?.type !== 'device' || !tdc?.devID) {
      setTargetSensors([]);
      return;
    }
    const found = targetDevOptions.find((d) => d.devID === tdc.devID);
    if (found) setTargetSensors(found.sensors ?? []);
  }, [tdc?.devID, targetDevOptions]);

  // ─────────────────────────────────────────────────────────────────────────
  // Render helpers
  // ─────────────────────────────────────────────────────────────────────────

  function renderSourcePicker(
    sourceType: 'current' | 'target',
    dataConfig: DataConfig,
    inputValue: string,
    options: Device[] | Cluster[],
    loading: boolean,
    onInputChange: (v: string) => void,
    onSearch: (v: string) => void,
    onDeviceSelect: (d: Device) => void,
    onClusterSelect: (c: Cluster) => void,
    sensors: { sensorId: string; sensorName: string }[],
    onSensorChange: (sensorId: string) => void,
    onOperatorChange: (op: string) => void,
    operatorList: string[]
  ) {
    const prefix = sourceType === 'current' ? 'src' : 'tgt';

    return (
      <div className="progress-bar-config__section">
        {/* Source type radio */}
        <RadioGroup
          name={`${prefix}-source-type`}
          value={dataConfig.type}
          onChange={({ value }) => {
            if (sourceType === 'current') {
              updateActiveBarDataConfig({ type: value as DataConfig['type'] });
            } else {
              if (value === 'static') {
                updateActiveBar({ targetDataConfig: undefined });
              } else {
                updateActiveBarTargetDataConfig({ type: value as DataConfig['type'] });
              }
            }
          }}
          orientation="Horizontal"
        >
          {sourceType === 'target' && <Radio label="Static" value="static" />}
          <Radio label="Device" value="device" />
          <Radio label="Cluster" value="cluster" />
          <Radio label="Compute" value="compute" />
        </RadioGroup>

        {/* Static target value */}
        {sourceType === 'target' && targetType === 'static' && (
          <TextInput
            label="Target Value"
            type="number"
            value={String(activeBar?.targetStaticValue ?? 100)}
            onChange={({ value }) => updateActiveBar({ targetStaticValue: parseFloat(value) || 100 })}
          />
        )}

        {/* Device pickers */}
        {dataConfig.type === 'device' && (
          <>
            <AutocompleteInput
              label="Device"
              type="single"
              inputValue={inputValue}
              onInputChange={({ value }) => {
                onInputChange(value);
                onSearch(value);
              }}
            >
              <DropdownMenu
                footer={loading ? (
                  <div style={{ padding: 'var(--spacing-03)', display: 'flex', justifyContent: 'center' }}>
                    <Spinner size="Small" />
                  </div>
                ) : undefined}
              >
                {(options as Device[]).map((device) => (
                  <ActionListItem
                    id={device.devID}
                    contentType="Item"
                    title={device.devName}
                    description={device.devTypeID}
                    isSelected={device.devID === dataConfig.devID}
                    onClick={() => onDeviceSelect(device)}
                  />
                ))}
                {!loading && options.length === 0 && (
                  <ActionListItem contentType="Item" title="No devices found" isDisabled />
                )}
              </DropdownMenu>
            </AutocompleteInput>

            {sensors.length > 0 && (
              <SelectInput
                label="Sensor"
                value={sensors.find((s) => s.sensorId === dataConfig.sensor)?.sensorName ?? ''}
              >
                <DropdownMenu>
                  {sensors.map((s) => (
                    <ActionListItem
                      id={s.sensorId}
                      contentType="Item"
                      title={s.sensorName}
                      description={s.sensorId}
                      isSelected={s.sensorId === dataConfig.sensor}
                      onClick={() => onSensorChange(s.sensorId)}
                    />
                  ))}
                </DropdownMenu>
              </SelectInput>
            )}

            <SelectInput
              label="Operator"
              value={dataConfig.operator ?? 'LastDP'}
            >
              <DropdownMenu>
                {operatorList.map((op) => (
                  <ActionListItem
                    id={op}
                    contentType="Item"
                    title={op}
                    isSelected={op === (dataConfig.operator ?? 'LastDP')}
                    onClick={() => onOperatorChange(op)}
                  />
                ))}
              </DropdownMenu>
            </SelectInput>
          </>
        )}

        {/* Cluster pickers */}
        {dataConfig.type === 'cluster' && (
          <>
            <AutocompleteInput
              label="Cluster (Load Entity)"
              type="single"
              inputValue={inputValue}
              onInputChange={({ value }) => {
                onInputChange(value);
                onSearch(value);
              }}
            >
              <DropdownMenu
                footer={loading ? (
                  <div style={{ padding: 'var(--spacing-03)', display: 'flex', justifyContent: 'center' }}>
                    <Spinner size="Small" />
                  </div>
                ) : undefined}
              >
                {(options as Cluster[]).map((cluster) => (
                  <ActionListItem
                    id={cluster._id}
                    contentType="Item"
                    title={cluster.name}
                    description={`Unit: ${cluster.unit}`}
                    isSelected={cluster._id === dataConfig.clusterID}
                    onClick={() => onClusterSelect(cluster)}
                  />
                ))}
                {!loading && options.length === 0 && (
                  <ActionListItem contentType="Item" title="No clusters found" isDisabled />
                )}
              </DropdownMenu>
            </AutocompleteInput>

            <SelectInput
              label="Cluster Operator"
              value={dataConfig.clusterOperator ?? 'Sum'}
            >
              <DropdownMenu>
                {CLUSTER_OPERATORS.map((op) => (
                  <ActionListItem
                    id={op}
                    contentType="Item"
                    title={op}
                    isSelected={op === (dataConfig.clusterOperator ?? 'Sum')}
                    onClick={() =>
                      sourceType === 'current'
                        ? updateActiveBarDataConfig({ clusterOperator: op })
                        : updateActiveBarTargetDataConfig({ clusterOperator: op })
                    }
                  />
                ))}
              </DropdownMenu>
            </SelectInput>
          </>
        )}

        {/* Compute pickers */}
        {dataConfig.type === 'compute' && (
          <>
            <TextInput
              label="Flow ID"
              value={dataConfig.flowID ?? ''}
              onChange={({ value }) =>
                sourceType === 'current'
                  ? updateActiveBarDataConfig({ flowID: value })
                  : updateActiveBarTargetDataConfig({ flowID: value })
              }
            />
            <TextInput
              label="Flow Parameters"
              value={dataConfig.flowParams ?? ''}
              onChange={({ value }) =>
                sourceType === 'current'
                  ? updateActiveBarDataConfig({ flowParams: value })
                  : updateActiveBarTargetDataConfig({ flowParams: value })
              }
            />
          </>
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Tabs
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="progress-bar-config">
      {/* Config panel starts directly from Tabs — no Card, no title */}
      <Tabs variant="Bordered" isFullWidth>
        <TabItem
          label="Data"
          isSelected={activeTab === 'data'}
          onClick={() => setActiveTab('data')}
        />
        <TabItem
          label="Time"
          isSelected={activeTab === 'time'}
          onClick={() => setActiveTab('time')}
        />
        <TabItem
          label="Style"
          isSelected={activeTab === 'style'}
          onClick={() => setActiveTab('style')}
        />
      </Tabs>

      {/* ── DATA TAB ──────────────────────────────────────────────────────── */}
      {activeTab === 'data' && (
        <div className="progress-bar-config__tab-body">
          <Accordion mode="single" defaultExpandedKeys={['bar-settings']}>

            {/* Bar Settings */}
            <AccordionItem title="Bar Settings" value="bar-settings">
              <div className="progress-bar-config__section">
                {/* Bar list */}
                {charts.length > 0 && (
                  <div className="progress-bar-config__bar-list">
                    {charts.map((bar, index) => (
                      <div
                        key={index}
                        className={[
                          'progress-bar-config__bar-row',
                          index === activeBarIndex ? 'progress-bar-config__bar-row--active' : '',
                        ].filter(Boolean).join(' ')}
                        onClick={() => setActiveBarIndex(index)}
                      >
                        <span className="BodySmallMedium progress-bar-config__bar-row-label">
                          {bar.label || `Bar ${index + 1}`}
                        </span>
                        <IconButton
                          icon={<DeleteIcon />}
                          variant="Tertiary"
                          color="Negative"
                          size="XSmall"
                          onClick={(e) => { e.stopPropagation(); handleDeleteBar(index); }}
                        />
                      </div>
                    ))}
                  </div>
                )}

                {charts.length === 0 && (
                  <p className="BodySmallRegular" style={{ color: 'var(--text-default-tertiary)' }}>
                    No bars yet. Add one below.
                  </p>
                )}

                <Button
                  label="Add Bar"
                  variant="Secondary"
                  color="Primary"
                  size="Small"
                  leadingIcon={<AddIcon />}
                  onClick={handleAddBar}
                />
              </div>
            </AccordionItem>

            {/* Data Source — shown only when a bar is selected */}
            {activeBar && (
              <>
                <AccordionItem title="Data Source" value="data-source">
                  {renderSourcePicker(
                    'current',
                    dc,
                    devInput,
                    dc.type === 'cluster' ? clusterOptions : devOptions,
                    dc.type === 'cluster' ? clusterLoading : devLoading,
                    dc.type === 'cluster'
                      ? (v) => setClusterInput(v)
                      : (v) => setDevInput(v),
                    dc.type === 'cluster'
                      ? debouncedClusterSearch
                      : debouncedDeviceSearch,
                    handleDeviceSelect,
                    handleClusterSelect,
                    activeSensors,
                    (sensorId) => updateActiveBarDataConfig({ sensor: sensorId }),
                    (op) => updateActiveBarDataConfig({ operator: op }),
                    OPERATORS
                  )}
                </AccordionItem>

                {/* Target Configuration */}
                <AccordionItem title="Target / Max Value" value="target-config">
                  {renderSourcePicker(
                    'target',
                    tdc ?? { type: 'static' as any },
                    tdc?.type === 'cluster' ? targetClusterInput : targetDevInput,
                    tdc?.type === 'cluster' ? targetClusterOptions : targetDevOptions,
                    tdc?.type === 'cluster' ? targetClusterLoading : targetDevLoading,
                    tdc?.type === 'cluster'
                      ? (v) => setTargetClusterInput(v)
                      : (v) => setTargetDevInput(v),
                    tdc?.type === 'cluster'
                      ? debouncedTargetClusterSearch
                      : debouncedTargetDeviceSearch,
                    handleTargetDeviceSelect,
                    handleTargetClusterSelect,
                    targetSensors,
                    (sensorId) => updateActiveBarTargetDataConfig({ sensor: sensorId }),
                    (op) => updateActiveBarTargetDataConfig({ operator: op }),
                    OPERATORS
                  )}
                </AccordionItem>

                {/* Display Settings */}
                <AccordionItem title="Display" value="display">
                  <div className="progress-bar-config__section">
                    <TextInput
                      label="Label"
                      value={activeBar.label ?? ''}
                      onChange={({ value }) => updateActiveBar({ label: value })}
                    />

                    <TextInput
                      label="Unit"
                      value={activeBar.unit ?? ''}
                      onChange={({ value }) => updateActiveBar({ unit: value })}
                    />

                    <TextInput
                      label="Data Precision"
                      type="number"
                      value={String(activeBar.dataPrecision ?? 1)}
                      onChange={({ value }) => updateActiveBar({ dataPrecision: parseInt(value) || 1 })}
                    />

                    {/* Color */}
                    <div style={{ position: 'relative' }}>
                      <TextInput
                        label="Bar Color"
                        value={activeBar.color ?? ''}
                        placeholder="var(--background-brand-default)"
                        onChange={({ value }) => updateActiveBar({ color: value })}
                        suffix={
                          <div
                            className="progress-bar-config__color-swatch"
                            style={{ background: activeBar.color || 'var(--background-brand-default)' }}
                            onClick={() => setBarColorPickerOpen((o) => !o)}
                          />
                        }
                      />
                      {barColorPickerOpen && (
                        <div className="progress-bar-config__color-picker-anchor">
                          <ColorPicker
                            activeTab="picker"
                            onTabChange={() => {}}
                            pickerPanel={
                              <input
                                type="color"
                                value={activeBar.color || '#4f8ef7'}
                                onChange={(e) => {
                                  updateActiveBar({ color: e.target.value });
                                }}
                                style={{ width: '100%', height: '100px', border: 'none', cursor: 'pointer' }}
                              />
                            }
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </AccordionItem>
              </>
            )}
          </Accordion>
        </div>
      )}

      {/* ── TIME TAB ──────────────────────────────────────────────────────── */}
      {activeTab === 'time' && (
        <div className="progress-bar-config__tab-body">
          {/* Timezone & Time Type — no accordion wrapper, just padding */}
          <div className="progress-bar-config__time-top">
            <AutocompleteInput
              label="Timezone"
              type="single"
              inputValue={time.timezone ?? ''}
              onInputChange={({ value }) => updateTime({ timezone: value })}
            >
              <DropdownMenu>
                {TIMEZONES.filter((tz) => tz.toLowerCase().includes((time.timezone ?? '').toLowerCase())).map((tz) => (
                  <ActionListItem
                    id={tz}
                    contentType="Item"
                    title={tz}
                    isSelected={tz === time.timezone}
                    onClick={() => updateTime({ timezone: tz })}
                  />
                ))}
              </DropdownMenu>
            </AutocompleteInput>

            <SelectInput
              label="Time Type"
              value={time.timeType === 'fixed' ? 'Fixed Time' : 'Local Time Picker'}
            >
              <DropdownMenu>
                <ActionListItem
                  id="localTimePicker"
                  contentType="Item"
                  title="Local Time Picker"
                  isSelected={time.timeType !== 'fixed'}
                  onClick={() => updateTime({ timeType: 'localTimePicker' })}
                />
                <ActionListItem
                  id="fixed"
                  contentType="Item"
                  title="Fixed Time"
                  isSelected={time.timeType === 'fixed'}
                  onClick={() => updateTime({ timeType: 'fixed' })}
                />
              </DropdownMenu>
            </SelectInput>
          </div>

          <Accordion mode="single">
            <AccordionItem title="Cycle Time" value="cycle-time">
              <div className="progress-bar-config__section">
                <RadioGroup
                  name="cycleTimeIdentifier"
                  value={time.cycleTimeIdentifier ?? 'start'}
                  onChange={({ value }) => updateTime({ cycleTimeIdentifier: value as 'start' | 'end' })}
                  orientation="Horizontal"
                >
                  <Radio label="Start" value="start" />
                  <Radio label="End" value="end" />
                </RadioGroup>

                <div className="progress-bar-config__row">
                  <SelectInput label="Hour" value={time.cycleHour ?? '00'}>
                    <DropdownMenu>
                      {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')).map((h) => (
                        <ActionListItem
                          id={h}
                          contentType="Item"
                          title={h}
                          isSelected={h === (time.cycleHour ?? '00')}
                          onClick={() => updateTime({ cycleHour: h })}
                        />
                      ))}
                    </DropdownMenu>
                  </SelectInput>

                  <SelectInput label="Minute" value={time.cycleMinute ?? '00'}>
                    <DropdownMenu>
                      {['00', '15', '30', '45'].map((m) => (
                        <ActionListItem
                          id={m}
                          contentType="Item"
                          title={m}
                          isSelected={m === (time.cycleMinute ?? '00')}
                          onClick={() => updateTime({ cycleMinute: m })}
                        />
                      ))}
                    </DropdownMenu>
                  </SelectInput>
                </div>
              </div>
            </AccordionItem>
          </Accordion>
        </div>
      )}

      {/* ── STYLE TAB ─────────────────────────────────────────────────────── */}
      {activeTab === 'style' && (
        <div className="progress-bar-config__tab-body">
          <Accordion mode="single" defaultExpandedKeys={['card-styling']}>

            {/* Card Styling */}
            <AccordionItem title="Card Styling" value="card-styling">
              <div className="progress-bar-config__section">
                <Switch
                  label="Wrap into Card"
                  isChecked={style.wrapInCard !== false}
                  onChange={({ checked }) => updateStyle({ wrapInCard: checked })}
                />
                <TextInput
                  label="Widget Title"
                  value={style.title ?? ''}
                  placeholder="Progress Bar"
                  onChange={({ value }) => updateStyle({ title: value })}
                />
                <TextInput
                  label="Background Color"
                  value={style.backgroundColor ?? ''}
                  onChange={({ value }) => updateStyle({ backgroundColor: value })}
                />
                <TextInput
                  label="Border Color"
                  value={style.borderColor ?? ''}
                  onChange={({ value }) => updateStyle({ borderColor: value })}
                />
                <TextInput
                  label="Border Width"
                  value={style.borderWidth ?? ''}
                  placeholder="1px"
                  onChange={({ value }) => updateStyle({ borderWidth: value })}
                />
                <TextInput
                  label="Border Radius"
                  value={style.borderRadius ?? ''}
                  placeholder="8px"
                  onChange={({ value }) => updateStyle({ borderRadius: value })}
                />
                <TextInput
                  label="Padding"
                  value={style.padding ?? ''}
                  placeholder="16px"
                  onChange={({ value }) => updateStyle({ padding: value })}
                />
              </div>
            </AccordionItem>

            {/* Bar Styling */}
            <AccordionItem title="Bar Styling" value="bar-styling">
              <div className="progress-bar-config__section">
                <TextInput
                  label="Bar Height"
                  value={style.barHeight ?? ''}
                  placeholder="10px"
                  onChange={({ value }) => updateStyle({ barHeight: value })}
                />
                <Switch
                  label="Show Percentage"
                  isChecked={style.showPercentage !== false}
                  onChange={({ checked }) => updateStyle({ showPercentage: checked })}
                />
                <Switch
                  label="Show Value"
                  isChecked={style.showValue !== false}
                  onChange={({ checked }) => updateStyle({ showValue: checked })}
                />
              </div>
            </AccordionItem>

            {/* Font Styling */}
            <AccordionItem title="Font Styling" value="font-styling">
              <div className="progress-bar-config__section">
                <TextInput
                  label="Font Size"
                  value={style.fontSize ?? ''}
                  placeholder="14px"
                  onChange={({ value }) => updateStyle({ fontSize: value })}
                />
                <TextInput
                  label="Font Color"
                  value={style.fontColor ?? ''}
                  onChange={({ value }) => updateStyle({ fontColor: value })}
                />
                <SelectInput
                  label="Font Weight"
                  value={style.fontWeight ?? 'Regular'}
                >
                  <DropdownMenu>
                    {FONT_WEIGHTS.map((fw) => (
                      <ActionListItem
                        id={fw}
                        contentType="Item"
                        title={fw}
                        isSelected={fw === (style.fontWeight ?? 'Regular')}
                        onClick={() => updateStyle({ fontWeight: fw })}
                      />
                    ))}
                  </DropdownMenu>
                </SelectInput>
                <TextInput
                  label="Icon Color"
                  value={style.iconColor ?? ''}
                  placeholder="var(--text-default-secondary)"
                  onChange={({ value }) => updateStyle({ iconColor: value })}
                />
              </div>
            </AccordionItem>

          </Accordion>
        </div>
      )}
    </div>
  );
}
