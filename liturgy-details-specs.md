
- Category selector;
- Save only when clicking in "Save" (not auto-save);
- Date selector (datepicker) or a day week picker (that will sets that service for every selected day week in the future, it's only allwoed one service per day week);

- Add items that could be:
  - Category/Section. It's not the service category, it's items category, and should be added by the users, but with some pre-defined (items below are written in pt-br, needs translate to other languages), this item should be collapsable and have sub-items (that are service items except Category/Section):
    - "Regencia";
    - "Escola Sabatina";
    - "Intervalo entre momentos;
    - "Doxologia";
    - "Pregação".
  - Musics (hymnals or collection songs, basically every registered music on the app);
  - Bible verse;
  - Scheduled items;
  - Local files: music, video, presentations (.pptx);
  - Online videos (youtube URL);
  - Anotação;

Required:

 - All items can be reordered by dragging and dropping it, should also be possible to move an existing item into an existing category/section if dragging it on top of a category/section. (this should have some colored visual feedback during dragging).


claude --resume 770963d2-6edb-4733-9e5b-2f74737c05e5


fix with subagents and appropriate skill: 

- The sections should be draggable for better UX, and when dragging it, the items inside of it should be moved with the section to the new place;
- Items should be draggable to outside of a section;
- Items should be draggable to be reordered when inside a section;
- Items should be draggable to be placed after or before a section;

- the items inside a section should be indented

drag and drop section: --resume 916e2f40-bf75-4af1-be4d-a3e06ca08b57
list all musics section: --resume 702ab26b-16f7-4460-9ff9-0e90e64ba2b3