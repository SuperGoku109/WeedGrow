# Dedicated Edit plant page

The existing /plant/[id]/edit route now renders a full page instead of redirecting to a bottom sheet. The persistent Edit plant action and legacy edit-section links open it.

Panels group plant identity/photo/height/age, container and soil, location/site/exposure, care and reminders, notes/history, and plant management. The current cover photo uses the existing stored-photo adapter. Photo management remains in the Photos tab. Short inputs share responsive rows; the portrait stacks on narrow screens or larger text settings. Save changes remains fixed above the bottom safe area.

The form reuses the existing full-editor draft key, combined field validation, changed-section updates, conflict handling, deletion confirmation and unsaved-navigation guard. No new Firestore schema or save implementation was introduced.

Validation: 28 focused tests pass, including cross-panel edits in one save, page/portrait rendering without a modal, navigation, existing form policies and deletion safeguards. Type checking and targeted lint pass. The live mobile browser was checked for layout and back/forward editor navigation without saving production data.
