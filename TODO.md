# TODO:

now just need those fixes:

  - the playing now controls aren't fully controlling the video playing (specially the volume and progressbar), the stop button are not emiting events to clear projection screens.
  - the projection screens have a small delay if compared with the playing now preview.
  - the quality of video in playing now preview should be worse than the projector/return windows.
  - if i play a video, clear it and play again, the controls bugs and doesn't allow play/pause, the progressbar doesn't update anymore, the app don't threat each video reproduction as independent/indempotent.

  Use sub-agents to fix it.