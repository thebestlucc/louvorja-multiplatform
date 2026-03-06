# Tasks: Playing Queue Feature

## Task: T-001 - Enhance Queue Store
Enhance the `useQueueStore` to support active playing states and ensure robust queue management.

### Acceptance Criteria
- [x] `addToQueue` adds items and handles `clearExisting`.
- [x] `removeFromQueue` adjusts `currentIndex` properly.
- [x] `next`/`prev` move the `currentIndex` within bounds.
- [x] `clearQueue` resets state to initial values.

## Task: T-002 - Create Playing Queue Component
Create a UI component for the Operator screen that lists the music in the queue.

### Acceptance Criteria
- [x] Renders list of items with titles and types.
- [x] Highlights the active item.
- [x] Integration with `setCurrentIndex`.

## Task: T-003 - Integrate with Operator Screen
Add the `PlayingQueue` component to the Operator layout.

### Acceptance Criteria
- [x] `PlayingQueue` is visible on `/operator`.
- [x] Layout remains responsive.

## Task: T-004 - Update Audio Store for Auto-Next
Enhance `useAudioStore` to notify listeners when a song finishes playing.

### Requirements
- Detect song completion in `startStatusSubscription`.
- Provide a way to register an `onFinished` callback.

### Acceptance Criteria
- [x] Correctly identifies the "Finished" state (not playing, not paused).
- [x] Executes a registered callback when finished.

## Task: T-005 - Create Playback Coordinator Hook
Implement the logic that synchronizes all stores based on the queue.

### Requirements
- React to `queue-store.currentIndex` changes.
- Automatically start audio and slides for the new item.
- Link audio completion back to the queue's `next()` action.

### Acceptance Criteria
- [x] Changing `currentIndex` triggers `audioPlay` with the correct file.
- [x] Slides are automatically updated to the current hymn.
- [x] Reaching the end of a song triggers `queueStore.next()`.
