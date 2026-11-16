; Extra uninstall steps (electron-builder includes this file; see nsis.include in electron-builder.yml).
;
; 1. The app is run once with --disconnect-all. It takes Helo's hooks and status line out of
;    Claude Code, Codex, Gemini CLI and Cursor's config files, so they do not keep calling an
;    app that is gone, and removes the "start with Windows" entry.
; 2. The user is asked whether the data folder goes too (settings, clipboard history, notes,
;    shelf, license). Default: keep. A silent uninstall (/S) keeps it.
;
; Neither step runs when the uninstaller is called by an update.

!macro customUnInstall
  ${ifNot} ${isUpdated}
    DetailPrint "Removing Helo's hooks from your coding agents"
    ; Files are still in place here: this macro runs before they are deleted.
    nsExec::Exec '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" --disconnect-all'
    Pop $0

    MessageBox MB_YESNO|MB_ICONQUESTION|MB_DEFBUTTON2 "Also delete Helo's data on this PC?$\r$\n$\r$\nThat is your settings, clipboard history, notes, shelf and license. Choose No to keep them for a later install." /SD IDNO IDNO helo_keep_data
      ; Electron keeps its data per user, whichever way the app was installed.
      SetShellVarContext current
      RMDir /r "$APPDATA\${APP_FILENAME}"
      !ifdef APP_PRODUCT_FILENAME
        RMDir /r "$APPDATA\${APP_PRODUCT_FILENAME}"
      !endif
      !ifdef APP_PACKAGE_NAME
        RMDir /r "$APPDATA\${APP_PACKAGE_NAME}"
      !endif
      ${if} $installMode == "all"
        SetShellVarContext all
      ${endif}
    helo_keep_data:
  ${endIf}
!macroend
