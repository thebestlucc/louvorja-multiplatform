# Legacy File Verification & Download Logic

This document details how the legacy Delphi application (LouvorJA Desktop) identifies missing or corrupted files and performs the download process via FTP.

## Overview

The file verification system is split into two primary forms:
1. **`fmArquivosFalta`**: Detects files that are required by the system but are missing or have an incorrect size (corrupted).
2. **`fmArquivosExcesso`**: Detects files present in the local directory that are not part of the official system file list (system "bloat" or excess).

Both forms use a central database table, `ARQUIVOS_SISTEMA`, which serves as the authoritative manifest of all files.

---

## 1. File Verification System (`fmArquivosFalta`)

**Source:** `fmArquivosFalta.pas` / `fmArquivosFalta.dfm`

### Logic for Missing/Corrupted Files
When the form is activated (`FormActivate`), it performs the following steps:

1.  **Open Manifest:** It opens the `DM.qrARQUIVOS_SISTEMA` dataset (located in the DataModule).
    *   **SQL Query:** `SELECT TIPO, ARQUIVO, URL, TAMANHO FROM ARQUIVOS_SISTEMA`
2.  **Local Iteration:** For each record in the dataset:
    *   **Construct Path:** `LocalPath = ExtractFilePath(Application.ExeName) + URL`
    *   **Check Existence:** `if not FileExists(LocalPath)` then the file is marked as **"Faltando" (Missing)**.
    *   **Check Integrity (Size):** `if FileExists(LocalPath)` and `FileSize(LocalPath) <> TAMANHO` then the file is marked as **"Corrompido" (Corrupted)**.
3.  **Display:** All missing or corrupted files are added to a `TbsSkinListView` (`lvArquivos`) with their path and status.
4.  **Action:** The user selects the desired files and clicks "Baixar Arquivos Selecionados", which opens the `fmAtualiza` form.

---

## 2. Excess File Detection (`fmArquivosExcesso`)

**Source:** `fmArquivosExcesso.pas` / `fmArquivosExcesso.dfm`

### Logic for Unnecessary Files
This form identifies files that should be deleted to keep the installation clean.

1.  **Load Reference:** It uses the `qrVERIFICA` query:
    ```sql
    SELECT TIPO, ARQUIVO, URL FROM ARQUIVOS_SISTEMA
    UNION
    SELECT 'IGNORAR', 'unins000.dat', 'unins000.dat' AS URL FROM ARQUIVOS_SISTEMA
    UNION
    SELECT 'IGNORAR', 'unins000.exe', 'unins000.exe' AS URL FROM ARQUIVOS_SISTEMA
    ORDER BY URL
    ```
    *(Note: It explicitly ignores the uninstaller files.)*
2.  **Scan Disk:** It likely performs a recursive scan of the application's subdirectories (using `FindFirst`/`FindNext`).
3.  **Cross-Reference:** For each file found on disk:
    *   If the file's relative path is **not** found in the `qrVERIFICA` dataset, it is added to the list as an "excess" file.
4.  **Action:** The user can select and delete these files directly from the form.

---

## 3. Download Process (`fmAtualiza`)

**Source:** `fmAtualiza.pas` / `fmAtualiza.dfm`

When files are identified for download, `fmAtualiza` manages the connection and transfer.

### Step 1: Authentication & Connection
1.  **Fetch Parameters:** Calls a web API (`url_params`) with an `Api-Token` to get the `conn_ftp` endpoint.
2.  **Request Credentials:** Sends a MIME-encoded (Base64) block of client info (version, IP, PC name) to the `conn_ftp` URL.
3.  **Decode Response:** Receives a MIME-encoded key-value pair containing:
    *   `host`, `root`, `port`, `username`, `password`
4.  **FTP Connect:** Connects using `IdFTP1` in **Passive Mode**.

### Step 2: Download Loop (`ftp_baixa`)
For each file in the target list:
1.  **Prepare Temp File:** Creates a unique temporary filename (e.g., `arquivo_20260317_153000123.~tmp`) in the temp directory.
2.  **Transfer:** Executes `IdFTP1.Get(RemotePath, TempPath)`.
    *   If the file size is unknown, it queries the FTP server using `IdFTP1.Size()`.
3.  **Finalize:**
    *   Ensures target directory exists (`ForceDirectories`).
    *   Moves the file: `CopyFile(TempPath, FinalPath, false)`.
    *   Deletes the temp file.

### Step 3: Progress & Retries
*   **Progress:** Updates two progress bars: `pbProgresso` (current file bytes) and `pbProgressoT` (total file count).
*   **Error Handling:** If a download fails, it attempts to reconnect and retry the same file once. If it fails again, it adds the file to `arquivos_falha` and continues.

---

## Key Data Components

| Component | Usage |
|-----------|-------|
| `ARQUIVOS_SISTEMA` | SQLite table acting as the central manifest for all system files. |
| `qrARQUIVOS_SISTEMA` | Query component that reads the manifest with file sizes. |
| `qrVERIFICA` | Query component used to identify which files are *not* system files. |
| `IdFTP1` | Indy FTP client used for binary transfers in Passive Mode. |
| `IdHTTP1` | Used to fetch dynamic FTP credentials from the management server. |
| `IdEncoderMIME` | Base64 encoder for secure data transmission in API requests. |
