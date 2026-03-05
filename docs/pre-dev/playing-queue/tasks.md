# Tasks: Playing Queue Feature

## Task: T-001 - Enhance Queue Store
Enhance the `useQueueStore` to support active playing states and ensure robust queue management.

### Requirements
- Support adding, removing, and clear operations.
- Support `next` and `prev` navigation with bounds checking.
- Ensure `currentIndex` is correctly updated on deletions.

### Acceptance Criteria
- [ ] `addToQueue` adds items and handles `clearExisting`.
- [ ] `removeFromQueue` adjusts `currentIndex` properly (if removed item is before, after, or is the current one).
- [ ] `next`/`prev` move the `currentIndex` within bounds.
- [ ] `clearQueue` resets state to initial values.

## Task: T-002 - Create Playing Queue Component
Create a UI component for the Operator screen that lists the music in the queue.

### Requirements
- List items from `useQueueStore`.
- Highlight the current item based on `currentIndex`.
- Allow clicking an item to set it as current.

### Acceptance Criteria
- [ ] Renders list of items with titles and types.
- [ ] Highlights the active item.
- [ ] Integration with `setCurrentIndex`.

## Task: T-003 - Integrate with Operator Screen
Add the `PlayingQueue` component to the Operator layout.

### Requirements
- Responsive layout with sidebar or bottom section for the queue.
- Maintain existing slide preview and navigation controls.

### Acceptance Criteria
- [ ] `PlayingQueue` is visible on `/operator`.
- [ ] Layout remains responsive.
