# Legacy File Verification & Download System

> **Source:** `louvorja-desktop/` Delphi project (`DESKTOP.md`)
> **Encoding note:** Most `.pas` files (`fmArquivosFalta.pas`, `fmArquivosExcesso.pas`, `dmComponentes.pas`, `fmMenu.pas`, `fmNovaVersao.pas`) are saved in Windows-1252 (Latin-1) encoding and could not be decoded as UTF-8. Only `fmAtualiza.pas` was readable. UI layout was reverse-engineered from `.dfm` files.

---

## Overview

The legacy Delphi app has a **hymnal collection update system** that:

1. Detects which files are **missing or corrupted** locally compared to what the server expects.
2. Shows the user a list of those files with their path and status.
3. Lets the user select files to download and fetches FTP credentials from a remote API.
4. Downloads the selected files via FTP, with retry logic and per-file/total progress.

A companion flow detects **excess files** (files locally present that should not exist).

---

## Forms & Modules Involved

| File | Class | Title | Purpose |
|------|-------|-------|---------|
| `fmArquivosFalta.pas/.dfm` | `TfArquivosFalta` | "Verificar arquivos em falta" | Lists missing/corrupted files; user selects files to download |
| `fmArquivosExcesso.pas/.dfm` | `TfArquivosExcesso` | "Verificar arquivos em excesso" | Lists excess files that should be removed |
| `fmAtualiza.pas/.dfm` | `TfAtualiza` | "Download de Arquivos..." | Connects to FTP and downloads the selected files |
| `fmNovaVersao.pas/.dfm` | `TfNovaVersao` | "Atualizar Coleção..." | New version prompt; entry point that triggers the whole flow |
| `dmComponentes.pas` | `TDM` | *(Data Module)* | Shared FTP/HTTP components, dataset `qrARQUIVOS_SISTEMA`, encoders |
| `fmMenu.pas` | `TfMenu` / `fmIndex` | *(Main Form)* | Holds app-level state: `url_params`, `api_token`, `loadCol`, `dir_temp`, etc. |

---

## Form: fmArquivosFalta — Missing File Checker

**File:** `fmArquivosFalta.dfm` (`.pas` source not decodable — Windows-1252)

### UI Layout (673×316 px)

```
┌──────────────────────────────────────────────────────────────────────┐
│  Verificação de arquivos da coletânea:  [Marcar Todos][Desmarcar Todos][Inverter Seleção] │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────┬──────────────────────────┬──────────────────┐      │
│  │  Arquivo    │  Diretório               │  Status          │      │
│  ├─────────────┼──────────────────────────┼──────────────────┤      │
│  │  (checked)  │  path/to/dir             │  Faltando/Corrompido │  │
│  │  ...        │  ...                     │  ...             │      │
│  └─────────────┴──────────────────────────┴──────────────────┘      │
│                                                                      │
├──────────────────────────────────────────────────────────────────────┤
│  [progress bar - thin strip]                                         │
├──────────────────────────────────────────────────────────────────────┤
│  [status label]      [Baixar Arquivos Selecionados]  [Verificar Novamente]  [Fechar] │
└──────────────────────────────────────────────────────────────────────┘
```

### Controls

| Control | Type | Purpose |
|---------|------|---------|
| `lvArquivos` | `TbsSkinListView` | Checkable list of missing files with 3 columns: **Arquivo** (200px), **Diretório** (300px), **Status** (150px) |
| `gProgresso` | `TbsSkinGauge` | Thin progress bar (6px height) at bottom, shows verification progress |
| `lblStatus` | `TbsSkinStdLabel` | Status text (bottom-left) |
| `btBaixa` | `TbsSkinButton` | "Baixar Arquivos Selecionados" — **disabled by default**, enabled after scan |
| `btVerifica` | `TbsSkinButton` | "Verificar Novamente" — **disabled by default**, re-runs the scan |
| `bsSkinButton2` | `TbsSkinButton` | "Fechar" — closes the form |
| `bsSkinSpeedButton53` | toolbar button | "Marcar Todos" — check all items |
| `bsSkinSpeedButton54` | toolbar button | "Desmarcar Todos" — uncheck all items |
| `bsSkinSpeedButton55` | toolbar button | "Inverter Seleção" — toggle all checkboxes |
| `tmrFecha` | `TTimer` | Auto-close timer (10ms interval, starts when done) |

### Events

| Event | Handler |
|-------|---------|
| `OnActivate` | `FormActivate` — runs the file verification scan on open |
| `OnKeyUp` | `FormKeyUp` — keyboard shortcut handling |
| `btBaixa.OnClick` | `btBaixaClick` — opens `fAtualiza` with selected files |
| `btVerifica.OnClick` | `btVerificaClick` — re-runs verification |
| `tmrFecha.OnTimer` | `tmrFechaTimer` — closes the form when timer fires |

### How the Scan Works (inferred from .dfm + related code)

The form opens on `FormActivate`, scans files from the `qrARQUIVOS_SISTEMA` dataset (which contains the authoritative file list from the server), and for each entry checks:

1. Does the local file exist at `ExtractFilePath(Application.ExeName) + URL`?
2. If it exists, does its size match the `TAMANHO` (size) column?

Files that are absent or have a wrong size are added to `lvArquivos` with a status of "Faltando" (missing) or "Corrompido" (corrupted). After the scan, `btBaixa` and `btVerifica` are enabled.

---

## Form: fmArquivosExcesso — Excess File Checker

**File:** `fmArquivosExcesso.dfm` (`.pas` source not decodable — Windows-1252)

Identical layout to `fmArquivosFalta` with the title "Verificar arquivos em excesso". Lists files found locally that are **not** in the server's `qrARQUIVOS_SISTEMA` dataset. The user can then delete them.

---

## Form: fmAtualiza — FTP File Downloader

**File:** `fmAtualiza.pas` (readable) + `fmAtualiza.dfm`

This is the actual download engine. It receives a list of relative file paths and downloads them via FTP.

### Public Fields

```pascal
arquivos: TStringList;        // Relative paths of files to download
arquivos_falha: TStringList;  // Files that failed to download
ftp_url: string;              // FTP host
ftp_dir: string;              // FTP root directory (e.g. "/colecao/")
ftp_porta: integer;           // FTP port
ftp_usuario: string;          // FTP username
ftp_senha: string;            // FTP password
cancela: Boolean;             // Set to true when user clicks Cancel
erro: Boolean;                // Set to true on unrecoverable error
```

### Download Flow (FormActivate)

```
FormActivate
│
├─ 1. HTTP GET → fmIndex.url_params  (with Api-Token header)
│     Returns: key=value text saved to configweb.ja
│     Required key: conn_ftp (URL to fetch FTP credentials)
│
├─ 2. Build credential request URL
│     Parameters sent (MIME-encoded):
│       lang, version, bin_version, datetime, ip, directory, pc_name
│
├─ 3. HTTP GET → conn_ftp?data=<encoded_params>&lang=<lang>
│     Returns: MIME-encoded key=value blob with:
│       host      → FTP server hostname
│       root      → FTP root directory
│       port      → FTP port number
│       username  → FTP username
│       password  → FTP password
│       ftp_msg   → (optional) error message to display before aborting
│
│     Cached in: fmIndex.loadCol.Values['FTP']
│     (avoids re-fetching FTP credentials within same session)
│
├─ 4. Connect to FTP server (passive mode)
│     ftp_conecta() — with retry dialog on failure
│     Handles "too many connections" / server overload message specially
│
├─ 5. Open DM.qrARQUIVOS_SISTEMA dataset (file size lookup table)
│
└─ 6. ftp_baixa() — download loop
```

### Download Loop (ftp_baixa)

```
for each file in arquivos:
  ├─ Check if cancel was requested
  ├─ Reconnect if FTP disconnected
  ├─ Generate temp filename: arquivo_YYYYMMDD_HHNNSSzzz.~tmp
  ├─ Look up expected file size in DM.qrARQUIVOS_SISTEMA (by URL)
  │   └─ If not found or size=0: ask FTP server for size via IdFTP1.Size()
  ├─ Set progress bar style:
  │   ├─ pbstNormal  if size > 0 (known size)
  │   └─ pbstMarquee if size = 0 (unknown size)
  ├─ IdFTP1.Get(ftp_dir + file_path, dir_temp + temp_file)
  │   └─ On failure: retry once after reconnect
  │       └─ On second failure: add to arquivos_falha, continue
  └─ On WorkEnd: CopyFile(temp → final_destination), DeleteFile(temp)
       └─ Creates directories as needed (ForceDirectories)
```

### Progress Display

| Control | Shows |
|---------|-------|
| `pbProgresso` | Per-file bytes downloaded (KB / KB) |
| `sProgresso` | "X KB / Y KB" for current file |
| `pbProgressoT` | Overall file count (file N / total) |
| `sProgressoT` | "Arquivo N / M" |
| `sTitulo` | Current operation description |
| `sStatus` | "Falha no download: N" (count of failed files) |

### Temp File Strategy

Files are first downloaded to `dir_temp` as `arquivo_YYYYMMDD_HHNNSSzzz.~tmp`, then moved to their final location relative to `Application.ExeName`. This prevents partial files from appearing at the target path. The `FormCreate` event cleans up any leftover `*.~tmp` files in `dir_temp` on startup.

### Error Handling

| Scenario | Behavior |
|----------|----------|
| Cannot reach `url_params` API | Retry once, then show error and abort |
| `conn_ftp` param missing | Show error, abort |
| FTP credential fetch fails | Show retry dialog; up to 5 automatic retries before user prompt |
| FTP server overloaded ("too many connections") | Show specific message asking user to try later |
| File download fails | Reconnect FTP and retry once; on second failure add to `arquivos_falha` |
| User clicks Cancel | Sets `cancela = True`, enables `tmrFecha` → disconnects FTP and closes form |

---

## Data Module: dmComponentes (DM)

**File:** `dmComponentes.pas` (not decodable — Windows-1252)

Key components used by the file verification system:

| Component | Type | Purpose |
|-----------|------|---------|
| `IdHTTP1` | `TIdHTTP` | HTTP client for API calls (credential fetch, params) |
| `IdFTP1` | `TIdFTP` | FTP client (on `fmAtualiza`, not DM) |
| `IdEncoderMIME` | `TIdEncoderMIME` | Base64/MIME encode for request params |
| `IdDecoderMIME` | `TIdDecoderMIME` | Base64/MIME decode for FTP credential response |
| `qrARQUIVOS_SISTEMA` | dataset | File registry: fields `URL` (relative path), `TAMANHO` (size bytes), `ARQUIVO` (filename) |
| `bsSkinData1` | skin data | UI theming component |
| `ico_24x24`, `ico_16x16` | image lists | Button icons |

---

## Main Form State (fmIndex / fmMenu)

The main form (`TfMenu`, referenced as `fmIndex`) holds global app state used by the verification system:

| Field | Type | Description |
|-------|------|-------------|
| `url_params` | string | API endpoint for fetching app parameters and `conn_ftp` URL |
| `api_token` | string | Bearer token sent as `Api-Token` HTTP header |
| `loadCol` | `TValueListEditor` | Key-value store; `loadCol.Values['FTP']` caches FTP credentials for the session |
| `dir_temp` | string | Temp directory path for staging downloaded files |
| `dir_dados` | string | Data directory; `configweb.ja` (param cache) is saved here |
| `lblVersao.Caption` | string | Collection version string |
| `VersaoExe` | string | Binary/exe version string |
| `paramtemp` | memo | Temporary storage for PC name and other params |
| `param` | `TValueListEditor` | Parsed response from `url_params` API |
| `erro_log` | memo | Error log accumulator |
| `TITULO` | string | App title string used in dialogs |
| `gravaLog(msg)` | procedure | Writes to app log file |

---

## Configuration File: configweb.ja

Saved to `dir_dados + 'configweb.ja'`. Contains the raw key=value response from the `url_params` API endpoint. Re-fetched on each update initiation.

Key entries:

| Key | Description |
|-----|-------------|
| `conn_ftp` | URL to request FTP credentials |
| *(other keys)* | Additional app parameters returned by the API |

---

## FTP Credential Response Format

The `conn_ftp` endpoint returns a MIME-encoded (Base64) string that decodes to a key=value list:

```ini
host=ftp.example.com
root=/colecao/arquivos/
port=21
username=ftpuser
password=secret
ftp_msg=              ; (optional) If set, shown as error and download aborts
```

---

## Form: fmNovaVersao — New Version / Update Trigger

**File:** `fmNovaVersao.dfm` (`.pas` not decodable — Windows-1252)

Caption: "Atualizar Coleção..." — acts as the user-visible entry point for the update flow. Likely shown when a newer collection version is detected (compares `lblVersao.Caption` with server version). Has an "Atualizar Coleção" quick button visible in `fmAtualiza`'s title bar (initially hidden).

---

## Overall Flow Diagram

```
User triggers update / app detects outdated collection
        │
        ▼
fmNovaVersao shown
  "New collection available, update now?"
        │  [Yes]
        ▼
fmArquivosFalta.FormActivate
  ├─ Scans local files vs qrARQUIVOS_SISTEMA
  ├─ Lists missing/wrong-size files in lvArquivos (checkboxes)
  └─ Enables "Baixar Arquivos Selecionados" button
        │  [User selects files, clicks Baixar]
        ▼
fmAtualiza.FormActivate
  ├─ GET url_params → parse conn_ftp
  ├─ GET conn_ftp?data=<encoded> → decode FTP credentials
  ├─ Connect to FTP (passive mode)
  ├─ Loop: for each selected file
  │    ├─ GET from FTP → dir_temp/*.~tmp
  │    └─ CopyFile to final path (creates dirs if needed)
  └─ Close (tmrFecha fires)
        │
        ▼
fmArquivosFalta reopens or user clicks "Verificar Novamente"
  Re-scans → if all files OK, enables only "Fechar"

─── Parallel flow ───────────────────────────────────
fmArquivosExcesso (similar flow, but for excess files to delete)
```

---

## Migration Notes for Tauri Rewrite

The current Tauri app already implements the FTP sync system (`src-tauri/src/ftp_sync/`). Key differences to be aware of:

| Legacy Behavior | Modern Equivalent |
|-----------------|-------------------|
| `qrARQUIVOS_SISTEMA` DB dataset | SQLite table via `rusqlite` |
| `TIdFTP` (Indy FTP component) | `ftp_sync/client.rs` (suppftp or similar) |
| FTP credentials via MIME-encoded API response | `ftp_sync/credentials.rs` |
| Temp file + CopyFile pattern | Same pattern should be used in Rust |
| `configweb.ja` key-value cache | Stored in SQLite settings table |
| `dir_temp` staging directory | Equivalent temp dir in Tauri's app data path |
| Windows-only (Delphi) | Cross-platform (Tauri) |
| No checksum verification (size only) | Consider MD5/SHA256 for corruption detection |
| FTP passive mode only | Already configured in Rust client |
| Retry on disconnect (1 retry) | Should preserve retry logic |
| `arquivos_falha` list (user-visible) | Map to `ContentSyncReport` errors |
