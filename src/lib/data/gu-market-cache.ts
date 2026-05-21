import type { GuMarketCacheEntry, NearbyMarketListing } from "@/lib/types/domain";

export const MOLIT_SALE_MONTHS = 120;
export const MOLIT_RENT_MONTHS = 12;

export function guMarketCacheKey(lawdCode: string): string {
  return lawdCode.trim();
}

export function listingDedupeKey(item: NearbyMarketListing): string {
  return [
    item.tradeType,
    item.dong,
    item.address,
    item.dealDate,
    item.buildingAreaSqm ?? item.areaSqm ?? "",
    item.landAreaSqm ?? "",
    item.dealAmountManwon ?? "",
    item.depositManwon ?? "",
    item.monthlyRentManwon ?? "",
    item.propertyType,
  ].join("|");
}

export function mergeListings(
  existing: NearbyMarketListing[],
  incoming: NearbyMarketListing[],
): NearbyMarketListing[] {
  const map = new Map<string, NearbyMarketListing>();
  for (const item of existing) map.set(listingDedupeKey(item), item);
  for (const item of incoming) map.set(listingDedupeKey(item), item);
  return [...map.values()];
}

export function missingMonths(
  covered: string[],
  required: string[],
): string[] {
  const set = new Set(covered);
  return required.filter((ym) => !set.has(ym));
}

export function buildGuMarketCacheEntry(
  lawdCode: string,
  city: string,
  gu: string,
  listings: NearbyMarketListing[],
  saleMonthsCovered: string[],
  rentMonthsCovered: string[],
): GuMarketCacheEntry {
  return {
    lawdCode,
    city,
    gu,
    saleMonthsCovered,
    rentMonthsCovered,
    listings,
    importedAt: new Date().toISOString(),
  };
}
