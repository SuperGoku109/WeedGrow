# Care suggestion panel

Care today groups the existing algorithm suggestions in a rounded panel inside the Journal. Each has an appropriate journal action and a Learn why toggle. Explanations stay inline and are independent per suggestion.

The card adapter now retains the engine recommendation evidence. Explanations format actual weather signals, rainfall estimates, journal timestamps, soil reports and relevant previous observations; missing data is not replaced by invented readings.

Water opens the watering activity; Check soil opens the soil-check activity; inspections and weather checks open the appropriate observation form. Buttons do not create completion records until the user saves. Existing algorithm reevaluation determines whether a suggestion changes or resolves. Read-only plants retain explanations without recording actions. No decision rules or thresholds changed.

Validated with care interaction, journal navigation, presentation and algorithm integration tests, type checking, lint and a mobile browser review.
