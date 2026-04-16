# IOsense Widget — ProgressBar

## Status: In Development

## Widget Info
- **Name:** ProgressBar
- **Paired config:** ProgressBarConfiguration
- **Webpack entries:** `ProgressBar`, `ProgressBarConfiguration`
- **window.ReactWidgets keys:** `ProgressBar`, `ProgressBarConfiguration`

## What It Does
Displays one or more horizontal progress bars. Each bar shows a **current value** vs a **target/max value** as a filled track with optional percentage and value labels.

## Supported Data Sources (per bar)
| Source | Current Value | Target Value |
|--------|--------------|--------------|
| Device | ✅ (devID + sensor + operator) | ✅ same |
| Cluster | ✅ (clusterID + clusterOperator) | ✅ same |
| Compute | ✅ (flowID + flowParams) | ✅ same |
| Static | — | ✅ hardcoded number |

## Config Schema
```typescript
ProgressBarConfig {
  charts: ProgressBarChartEntry[]   // one entry per bar
  style?: ProgressBarStyle
  time?: ProgressBarTimeConfig
}

ProgressBarChartEntry {
  dataConfig: DataConfig            // current value source (standardised schema)
  targetDataConfig?: DataConfig     // dynamic target source
  targetStaticValue?: number        // static target fallback
  label?: string
  color?: string
  unit?: string
  dataPrecision?: number
  // config-panel helpers (not rendered):
  devName?: string
  clusterName?: string
  targetDevName?: string
  targetClusterName?: string
}
```

## API Calls
| Function | Used for |
|----------|---------|
| `getWidgetData` | Fetch current + target values (all source types) |
| `findUserDevices` | Device search in config panel AutocompleteInput |
| `fetchClusters` | Cluster search in config panel AutocompleteInput |
| `validateSSOToken` | Dev-only auth (App.tsx) |

## File Map
```
src/
  iosense-sdk/
    types.ts                      shared TypeScript interfaces
    api.ts                        fetch wrappers (getWidgetData, findUserDevices, fetchClusters)
  components/
    ProgressBar/
      ProgressBar.tsx             widget renderer
      ProgressBar.css             BEM scoped styles
      index.ts                    self-registration on window.ReactWidgets['ProgressBar']
    ProgressBarConfiguration/
      ProgressBarConfiguration.tsx  3-tab config panel
      ProgressBarConfiguration.css  BEM scoped styles
      index.ts                    self-registration on window.ReactWidgets['ProgressBarConfiguration']
  App.tsx                         dev harness (not a prod entry)
  index.tsx                       dev entry point
```

## Build
```bash
npm install
npm start          # dev server on :3000
npm run build:bundle   # production → dist-bundle/
```

## Dev Auth
1. Open IOsense portal → copy SSO token
2. Open `http://localhost:3000?token=<sso_token>`
3. JWT is validated and stored in `localStorage.bearer_token`

## Next Steps / TODO
- [ ] Test with real device/cluster data
- [ ] Wire export handlers (CSV / XLSX / Image)
- [ ] Validate production bundle size (target < 100KB gzipped)
- [ ] Register in Application Registry after S3 deploy
