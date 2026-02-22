#!/usr/bin/env python3
"""Fix finalize_fetch calls to include albums_created and collection_hymns_linked parameters."""

import sys

filepath = 'src-tauri/src/commands/legacy_fetch.rs'

with open(filepath, 'r') as f:
    content = f.read()

# Pattern 1: Early exit calls with 12-space indent, 0 for audio/images
old1 = '            albums_fetched,\n            0,\n            0,\n            started,'
new1 = '            albums_fetched,\n            albums_created,\n            collection_hymns_linked,\n            0,\n            0,\n            started,'
c1 = content.count(old1)
content = content.replace(old1, new1)

# Pattern 2: Calls with actual audio/images variables (12-space indent)
old2 = '            albums_fetched,\n            audio_downloaded,\n            images_downloaded,\n            started,'
new2 = '            albums_fetched,\n            albums_created,\n            collection_hymns_linked,\n            audio_downloaded,\n            images_downloaded,\n            started,'
c2 = content.count(old2)
content = content.replace(old2, new2)

# Pattern 3: 8-space indent variants with 0 for audio/images  
old3 = '        albums_fetched,\n        0,\n        0,\n        started,'
new3 = '        albums_fetched,\n        albums_created,\n        collection_hymns_linked,\n        0,\n        0,\n        started,'
c3 = content.count(old3)
content = content.replace(old3, new3)

print(f'Replaced: 12-indent zeros={c1}, 12-indent vars={c2}, 8-indent zeros={c3}')

with open(filepath, 'w') as f:
    f.write(content)

print('Done')
