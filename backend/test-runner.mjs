import { isValidHHMM, toMinutes, isTimeInWindow } from "./src/utils/time.js";
import { generateSlotsFromWindows } from "./src/utils/slot.generator.js";
import { resolvePricing } from "./src/modules/item/pricing/pricing.engine.js";

console.log("isValidHHMM 10:30 ->", isValidHHMM("10:30"));
console.log("toMinutes 02:15 ->", toMinutes("02:15"));
console.log(
  "isTimeInWindow 10:15 in 10:00-11:00 ->",
  isTimeInWindow("10:15", "10:00", "11:00")
);

const slots = generateSlotsFromWindows([{ start: "10:00", end: "11:00" }], 30);
console.log("generateSlotsFromWindows ->", slots);

const staticItem = { pricing: { type: "STATIC", config: { price: 100 } } };
console.log("resolvePricing STATIC ->", resolvePricing({ item: staticItem }));

const discountedItem = {
  pricing: {
    type: "DISCOUNTED",
    config: { basePrice: 200, discountType: "PERCENT", discountValue: 10 },
  },
};
console.log(
  "resolvePricing DISCOUNTED ->",
  resolvePricing({ item: discountedItem })
);

const tieredItem = {
  pricing: {
    type: "TIERED",
    config: {
      tiers: [
        { upto: 5, price: 50 },
        { upto: 10, price: 40 },
      ],
    },
  },
};
console.log(
  "resolvePricing TIERED(usage=3) ->",
  resolvePricing({ item: tieredItem, usage: 3 })
);
console.log(
  "resolvePricing TIERED(usage=7) ->",
  resolvePricing({ item: tieredItem, usage: 7 })
);

const dynamicItem = {
  pricing: {
    type: "DYNAMIC_TIME",
    config: {
      windows: [{ start: "09:00", end: "12:00", price: 150 }],
      unavailableOutside: true,
    },
  },
};
console.log(
  "resolvePricing DYNAMIC_TIME at 10:00 ->",
  resolvePricing({ item: dynamicItem, time: "10:00" })
);

console.log("All tests completed");
