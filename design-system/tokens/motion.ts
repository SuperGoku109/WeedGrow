/** Small, interruptible gestures; bounce belongs on controls, not reading content. */
export const growMotion = {
  pressScale: 0.965,
  pressDuration: 90,
  revealDuration: 180,
  expandDuration: 220,
  spring: { stiffness: 380, damping: 22, mass: 0.7 },
  selectionSpring: { stiffness: 320, damping: 25, mass: 0.8 },
  confirmationSpring: { stiffness: 360, damping: 14, mass: 0.65 },
} as const;
