import { getItemPriceDetails } from "./item.price.service.js";

export async function getItemPriceController(req, res, next) {
  try {
    const itemId = req.params.id;

    const time = req.query.time || null;
    const usage = req.query.usage ? Number(req.query.usage) : undefined;

    const addonsRaw = req.query.addons || "";
    const addonIds = addonsRaw
      ? addonsRaw
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean)
      : [];

    const data = await getItemPriceDetails({ itemId, time, usage, addonIds });

    return res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
