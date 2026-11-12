# BudBuddy motion

BudBuddy uses gentle, responsive movement on small controls. Reading content
settles smoothly, with no bounce on text or long lists.

## Options considered

| Approach | Decision |
| --- | --- |
| Spring feedback for taps and selections | Use: tactile and a good fit for the friendly garden theme. |
| Short expansion and surface transitions | Use: helps explain where details and dialogs come from. |
| Small confirmation animation | Use once when watering becomes confirmed; never for historical records. |
| Confetti, idle pulsing, parallax, and staggered animations on every list item | Omit from this pass: distracting during everyday care and unnecessary on small screens. |

## Shared behavior

`design-system/tokens/motion.ts` defines the tuning. `ui/GrowMotion.tsx` owns
the reusable behavior, using React Native Animated without new dependencies.

- Buttons compress to 96.5% over 90 ms and spring back on release.
- Selected pills glide to the measured item bounds with a restrained spring.
  This covers setup choices, profile tabs, and the plant detail tabs.
- Disclosure and weather panels open and close in 220 ms. Their arrows rotate.
  Closing content becomes inaccessible to screen readers and pointer interaction
  immediately, then unmounts when the animation finishes.
- Dialogs and existing reveal surfaces settle over 180 ms.
- Bottom navigation icons lift 1.5 px and grow 8% when selected.
- A newly confirmed watering icon springs into place once. Merely loading a
  previously watered plant never triggers it.

Animations never delay actions or determine whether a save succeeded. Repeated
taps interrupt the current transition. Disabling a pressed control resets it.
The existing system Reduce Motion subscription disables movement, including
changes to that preference while the app is open. Selected colors, labels,
expanded states, and success icons still communicate the result.

Opacity and transforms use the native driver on mobile. Measured height and
selection width transitions use the JS driver; keep these confined to small,
user-triggered controls. Native device performance still needs device testing.

## Research

- [Material Design motion](https://m3.material.io/styles/motion/overview/how-it-works): spring-based spatial motion informed the selection treatment.
- [Apple motion guidelines](https://developer.apple.com/design/human-interface-guidelines/motion): brief, purposeful, interruptible feedback.
- [W3C animation from interactions](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions): honor reduced motion and retain non-motion feedback.
- [React Native Animated](https://reactnative.dev/docs/animated): interruption, spring configuration, and native-driver constraints.

## Presentation and loading

`ui/AppNotice.tsx` replaces default light snackbars with an elevated green notice.
A watering confirmation has a title, a plant name, and Undo. Notification actions
are locked while running; their dismiss timer pauses during work and after a
failure. Failures remain visible with Retry. Exiting notices retain their text
until the fade completes.

`ui/AnimatedModal.tsx` separates scrim and content movement. Dialogs enter with a
small scale and lift, then finish their exit before unmounting. Editor sheets
lift into place, but pass close requests directly to existing draft guards and
persistence. They never disappear before those guards accept the close.

The root and plant stacks use short native transitions. Web routes receive a
260 ms fade/lift fallback; bottom tabs use a 180 ms crossfade with navigation
anchored. These transitions do not remount business forms or wait to run actions.

Loading placeholders match plant rows and photo tiles, and breathe for at most
three cycles. They stop when content arrives or Reduce Motion is enabled; no
artificial loading delay or fabricated percentage is added. Inline refresh and
save feedback retain meaningful labels and use the app's surface colors.
