# GEOIRIS | Earth Science Change Detective & Significance Engine

> **2026 NASA Space Apps Challenge**  
> **Challenge Subject**: Earth Science / Software (Advanced)  
> **Challenge Name**: Change Detection, Trend Analysis & Statistical Significance

---

## 🌍 Executive Summary

**GEOIRIS** is an interactive, production-ready Earth science web platform that empowers students, researchers, and citizen scientists to become **"Data Detectives"**. It selects variables measured by NASA Earth science satellites and reanalysis models, visualizes multi-decadal changes over time, removes seasonal noise, and determines **what is changing**, **where it is changing**, **how much it is changing**, and whether those changes meet rigorous scientific standards of **statistical significance**.

### Key Highlights
- **1. Earth Science Variables & Missions**: Analyzes Surface Air Temperature ($`T_{2m}`$), Precipitation ($`P_{\text{tot}}`$), Vegetation Greenness ($`\text{NDVI}`$), Root-Zone Soil Moisture ($`\text{SM}`$), Evapotranspiration ($`\text{ET}`$), Aerosol Optical Depth ($`\text{AOD}_{550}`$), Land Surface Temperature ($`\text{LST}`$), and Ozone ($`\text{O}_3`$) observed by **MODIS** (Terra/Aqua), **AIRS** (Aqua), **OMI** (Aura), **GPM Core**, **SMAP**, **MERRA-2**, and **GLDAS-2**.
- **2. Interactive Global Map**: Interactive Leaflet map powered by keyless ArcGIS Online basemaps (Dark Gray Canvas, World Imagery Satellite, and World Topographic Terrain), clickable pins across 12 iconic global biomes, and a **click-to-pin tool** allowing users to query any latitude/longitude coordinate on Earth.
- **3. Live NASA POWER API Integration**: Direct live queries to NASA Langley Research Center's `https://power.larc.nasa.gov` API, retrieving multi-decade monthly satellite and reanalysis observations on the fly with graceful offline fallback.
- **4. Deseasonalization & Climatology Normalization**: Removes regular annual cycles by subtracting 30-year monthly baselines ($`A_{y,m} = X_{y,m} - \bar{X}_m`$) to reveal underlying climate trajectories that seasonal swings otherwise conceal.
- **5. Rigorous Statistical Engine**:
  - **Mann-Kendall Non-Parametric Trend Test** ($`S`$, $`\text{Var}(S)`$, standard normal $`Z`$, Kendall's Tau $`\tau`$, and two-tailed $`p`$-value).
  - **Theil-Sen Robust Median Slope Estimator** (resistant to extreme weather outliers).
  - **Ordinary Least Squares (OLS)** linear regression ($`m`$, intercept, $`R^2`$, standard error).
  - **Student's t-test** ($`t`$-statistic and $`p`$-value).
  - **95% Confidence Interval Band** around the trend line.
- **6. "Opposite Regional Trends" Engine**: Directly addresses the core challenge paradox: *"a measured Earth science data variable can trend one way in one region and the opposite way in another, even when the same process drives both"* (e.g. Clausius-Clapeyron warming causing the wet to get wetter in monsoon zones while the dry subtropics desiccate).
- **7. "Data Detective" Student Mystery Mode**: 4 interactive gamified mystery dossiers with step-by-step briefings, orbital clues, comprehension questions, and official NASA Data Detective Certification badges.
- **8. Custom Data Studio & Exporter**: Paste or upload custom CSV/JSON time series from local weather stations, export publication-ready datasets (CSV/JSON), and print/save scientific dossiers.
- **9. Statistical Analysis Lab (Phase 1 Completed)**:
  - **Inferential & Regression**: One-sample ($\mu_0$), two-sample, and paired t-tests; One-Way & **Two-Way Factorial ANOVA**; Multiple OLS, Huber/Bisquare IRLS, and **Nonlinear Regression** (exponential, logarithmic, power, quadratic, logistic via bounded Levenberg-Marquardt).
  - **Multivariate & Time-Series**: PCA with Scree plot, Factor Loadings matrix & PC1/PC2 Score Biplot; Hamed-Rao & **TFPW (Yue et al., 2002)** autocorrelated Mann-Kendall; Trend Acceleration & **Reversal Point $t^*$**; Pettitt & CUSUM change points; **GEV Extreme Value L-Moments fit**; selectable residual diagnostics (Ljung-Box Q & p, Shapiro-Wilk, IQR/Z-Score/Grubbs outlier detection).
  - **Provenance & Missing Data Fidelity**: Preserves `-999.0` polar-night/satellite gaps as explicit `null` slots (`spanGaps: false`) and labels provenance tier (`SAT OBS`, `REANALYSIS`, `USER CSV/JSON`, `DEMO`).
- **10. Phase 2 Scientific Compute Backend & Lab (FastAPI + Python)**:
  - **Auto-SARIMAX & STL Decomposition**: Kalman state-space forecasting handling native `NaN` gaps, 80%/95% prediction intervals, Ljung-Box diagnostics, and holdout backtest.
  - **Bayesian Adaptive MCMC**: Multi-chain Metropolis-within-Gibbs (`robust_ar1` Student-t + `changepoint` hinge) with split-$\hat{R}$, Bulk ESS, 95% HDI, and $P(\text{slope} > 0)$.
  - **Extreme Value Modeling**: SciPy MLE `GEV` (Block Maxima) & `GPD` (Peaks-Over-Threshold) with parametric bootstrap 95% CIs and KS goodness-of-fit.
  - **Gridded Spatial FDR (Wilks, 2016)**: Vectorized per-pixel Mann-Kendall across 3D grids/cubes with Benjamini-Yekutieli / BH / Holm / Bonferroni pruning and interactive pixel inspector.
  - **Geospatial Rasters & SAR (`rasterio`)**: DEM Differencing (DoD erosion/deposition volume & LoD mask), Adaptive Lee speckle filter + SAR log-ratio change detection + keyless NASA ASF catalog search, and LULC transition matrices ($\kappa$).
  - **NASA Live Fire, Atmosphere & NetCDF4 (`xarray`)**: FIRMS MAP_KEY proxy + keyless NASA EONET v3 wildfires, Domain 1 AIRS/MERRA-2 vertical sounding profiles, Domain 11 trace gases ($\text{NO}_2, \text{CH}_4, \text{CO}, \text{SO}_2$), NetCDF4/HDF5 inspection & extraction, and AppEEARS task proxy.

---

## 🚀 Quickstart & Local Setup

### Frontend (Browser + Keyless Client Connectors)
```bash
# 1. Install dependencies
npm install

# 2. Start the development server (proxies /api -> http://127.0.0.1:8000)
npm run dev
```

Open your browser at:
```text
http://localhost:3000/
```

### Phase 2 Backend (Python 3.11+ / FastAPI Compute Engine)
All Phase 1 features and keyless client connectors work standalone in the browser. To unlock Phase 2 server-side modeling (SARIMA, Bayesian MCMC, GEV/GPD, Spatial FDR, DEM/SAR/LULC GeoTIFFs, NetCDF4/HDF5 `xarray`, FIRMS/ASF/CMR proxies):

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Or run the backend in Docker:
```bash
cd backend
docker build -t geo-iris-backend .
docker run -p 8000:8000 --env-file .env geo-iris-backend
```

#### Optional Credentials (`backend/.env` or Session Auth UI)
Keyless NASA APIs (`NASA POWER`, `EONET v3 Wildfires`, `CMR Granules`, `ASF SAR Search`) work with zero keys. For authenticated feeds, copy `backend/.env.example` to `backend/.env` or enter session-only keys in the Phase 2 Lab UI:
- `NASA_FIRMS_MAP_KEY`: Enables sub-km VIIRS / MODIS active fire FRP queries.
- `EARTHDATA_TOKEN` (or `EARTHDATA_USERNAME` / `EARTHDATA_PASSWORD`): Enables authenticated AppEEARS task submission & Earthdata access.
- `VITE_BACKEND_URL` (frontend optional): Set when deploying static frontend separately from FastAPI (defaults to Vite `/api` proxy locally).

### Build & Preview Commands
```bash
# Run TypeScript compilation & production build
npm run build

# Preview production build locally
npm run preview
```

---

## 📐 Scientific & Mathematical Methodology

### 1. Deseasonalization (Monthly Anomaly Extraction)
Earth's 23.5° axial tilt causes massive natural annual oscillations. To isolate long-term climate trends, we compute the 30-year monthly climatological mean $`\bar{X}_m`$:

```math
\bar{X}_m = \frac{1}{K} \sum_{k=1}^{K} X_{k, m} \quad \text{for } m \in \{1, 2, \dots, 12\}
```

The deseasonalized anomaly $`A_{y, m}`$ is then:

```math
A_{y, m} = X_{y, m} - \bar{X}_m
```

### 2. Mann-Kendall Non-Parametric Trend Test
Recommended by the World Meteorological Organization (WMO) and NASA for environmental time-series because it does not assume normal distributions and resists extreme outliers:

```math
S = \sum_{k=1}^{n-1} \sum_{j=k+1}^{n} \text{sgn}(y_j - y_k)
```

```math
\text{Var}(S) = \frac{n(n-1)(2n+5) - \sum_{i=1}^{g} t_i(t_i-1)(2t_i+5)}{18}
```

```math
Z = \begin{cases}
\dfrac{S - 1}{\sqrt{\text{Var}(S)}} & \text{if } S > 0 \\
0 & \text{if } S = 0 \\
\dfrac{S + 1}{\sqrt{\text{Var}(S)}} & \text{if } S < 0
\end{cases}
```

```math
p = 2 \cdot \left(1 - \Phi(|Z|)\right)
```

### 3. Theil-Sen Robust Slope Estimator
Calculates the median of all pairwise slopes across $`N`$ observations:

```math
Q_{\text{med}} = \text{median} \left\{ \frac{y_j - y_i}{t_j - t_i} \right\} \quad \text{for } 1 \le i < j \le n
```

### 4. Significance Classification
- $`p < 0.001`$ (**`***`**): **Extremely Significant** — Less than 0.1% chance of coincidental weather noise.
- $`p < 0.01`$ (**`**`**): **Highly Significant** — Very strong empirical certainty.
- $`p < 0.05`$ (**`*`**): **Statistically Significant** — Standard scientific threshold for hypothesis rejection ($`H_0`$: no trend).
- $`p < 0.10`$ (**`†`**): **Marginally Significant** — Emerging trend, needs longer baseline.
- $`p \ge 0.10`$ (**`n.s.`**): **Not Significant** — Variations remain within natural climate variability.

---

## 🛰️ NASA Mission & Instrument Coverage
- **MODIS (Terra & Aqua)**: Normalized Difference Vegetation Index (NDVI), Aerosol Optical Depth (AOD), Land Surface Temperature (LST).
- **AIRS (Aqua)**: High-resolution atmospheric sounding of 2-meter air temperature and water vapor.
- **OMI (Aura)**: Atmospheric ozone column and aerosol absorbing indices.
- **GPM (Global Precipitation Measurement)**: Satellite constellation precipitation radar and microwave radiometers (IMERG).
- **MERRA-2**: NASA GMAO atmospheric reanalysis synthesizing 40+ years of satellite data.
- **GLDAS-2**: Global Land Data Assimilation System modeling root-zone soil moisture and evapotranspiration fluxes.
- **SMAP**: Active-passive microwave radiometry measuring topsoil moisture.

---

## 🏛️ Project Structure
```text
Geo-Iris/
├── backend/                         # Phase 2 Python FastAPI compute engine
│   ├── app/
│   │   ├── main.py                  # FastAPI entrypoint, CORS, /api/v1 routers
│   │   ├── config.py & schemas.py   # Settings & Pydantic v2 request schemas
│   │   ├── routers/                 # health/auth, stats, firms, earthdata, rasters
│   │   └── services/                # SARIMAX, MCMC, GEV/GPD, FDR, FIRMS, xarray, rasterio
│   ├── tests/                       # Pytest unit & FastAPI TestClient suite
│   ├── requirements.txt             # Python scientific dependencies
│   ├── .env.example                 # Optional Earthdata & FIRMS keys template
│   └── Dockerfile                   # Container image with GDAL/HDF5 support
├── public/
│   ├── favicon.svg
│   └── icons.svg
├── src/
│   ├── types/
│   │   └── earthScience.ts          # Type definitions for variables, regions, stats
│   ├── services/
│   │   ├── statistics/              # Modular MK, TFPW, Hamed-Rao, ANOVA, LM nonlinear, GEV, PCA
│   │   ├── connectors/              # NASA POWER, ORNL MODIS, NOAA Tides, USGS Water, GIBS
│   │   ├── phase2Api.ts             # Typed REST client for Phase 2 backend (/api/v1/*)
│   │   ├── nasaData.ts              # NASA POWER API client & CSV/JSON parsers
│   │   ├── detectiveCases.ts        # 4 interactive student mystery files
│   │   └── regionalContrasts.ts     # Opposite regional trend paired scenarios
│   ├── workers/                     # Off-thread statistical Web Worker + client
│   ├── components/
│   │   ├── Phase2Lab/               # SARIMA/MCMC/EVT, Spatial FDR, DEM/SAR/LULC, FIRMS, NetCDF4
│   │   ├── StatisticalLab/          # Univariate, Multivariate, Inferential, Regression, Diagnostics
│   │   ├── Navbar.tsx               # Navigation, GEOIRIS branding, API status
│   │   ├── EarthMap.tsx             # Interactive Leaflet map & coordinate picker
│   │   ├── VariableSelector.tsx     # Mission badges, category filters & simple definitions
│   │   ├── TimeSeriesChart.tsx      # Chart.js time series with layers, gap preservation & GIBS
│   │   ├── SignificanceBadge.tsx    # Statistical badges & explainer modal
│   │   ├── StatsSummaryCard.tsx     # Metric cards with provenance & missingness badge
│   │   ├── PlainEnglishSummary.tsx  # Data Detective verdict & physical drivers
│   │   ├── DetectiveMode.tsx        # Gamified student mystery investigation
│   │   ├── RegionalContrastView.tsx # Side-by-side opposite trend solver
│   │   ├── VariableEncyclopedia.tsx # Satellite & model directory & glossary
│   │   ├── CustomDataUploader.tsx   # Connector-routed coordinate query & CSV/JSON uploader
│   │   └── DataExportModal.tsx      # CSV, JSON, and print dossier generator
│   ├── App.tsx                      # Root application layout, provenance & mode routing
│   ├── main.tsx                     # React application entry point
│   ├── index.css                    # Tailwind CSS v4 styling & GEOIRIS dark palette
│   └── vite-env.d.ts                # Vite client environment types
├── index.html                       # HTML5 template with GEOIRIS metadata
├── package.json                     # Dependencies & scripts
├── tsconfig.json                    # TypeScript compiler options
└── vite.config.ts                   # Vite bundler + /api proxy configuration
```

---

## 👥 Audience & Educational Impact
Built specifically for **high school & college students, educators, and science enthusiasts** ("Data Detectives"), translating complex satellite and statistical mechanics into accessible, interactive discoveries.
