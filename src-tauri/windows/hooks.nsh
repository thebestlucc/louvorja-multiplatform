; NSIS installer hooks for LouvorJA
; Generates bible.db from bundled .sqlite source files during installation.

!macro NSIS_HOOK_POSTINSTALL
  ; Create the app data directory if it doesn't exist
  CreateDirectory "$LOCALAPPDATA\com.louvorja"

  ; Generate bible.db from bundled source translations.
  ; $INSTDIR contains the installed app files including resources/bible/*.sqlite
  ; The main binary supports --build-bible for headless bible generation.
  nsExec::ExecToLog '"$INSTDIR\LouvorJA.exe" --build-bible --input "$INSTDIR\resources\bible" --output "$LOCALAPPDATA\com.louvorja\bible.db"'
  Pop $0
  ${If} $0 != "0"
    ; Non-fatal: app will regenerate on first launch if this fails
    DetailPrint "Bible database generation returned exit code $0 (will retry on first launch)"
  ${EndIf}
!macroend
