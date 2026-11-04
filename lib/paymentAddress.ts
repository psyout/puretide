const COUNTRY_CODES: Record<string, string> = {
	canada: 'CA',
	mexico: 'MX',
	'united states': 'US',
	'united states of america': 'US',
	usa: 'US',
};

const CANADIAN_REGION_CODES: Record<string, string> = {
	alberta: 'AB',
	'british columbia': 'BC',
	manitoba: 'MB',
	'new brunswick': 'NB',
	newfoundland: 'NL',
	'newfoundland and labrador': 'NL',
	'northwest territories': 'NT',
	'nova scotia': 'NS',
	nunavut: 'NU',
	ontario: 'ON',
	'prince edward island': 'PE',
	quebec: 'QC',
	saskatchewan: 'SK',
	yukon: 'YT',
};

/** Normalize checkout address values to the ISO alpha-2 format payment gateways expect. */
export function paymentCountryCode(country: string): string {
	const normalized = country.trim().toLowerCase();
	return COUNTRY_CODES[normalized] || country.trim().toUpperCase().slice(0, 2);
}

export function paymentRegionCode(region: string, countryCode: string): string {
	const normalizedRegion = region.trim().toLowerCase();
	if (countryCode.toUpperCase() === 'CA') {
		return CANADIAN_REGION_CODES[normalizedRegion] || region.trim().toUpperCase().slice(0, 2);
	}
	return region.trim().toUpperCase().slice(0, 2);
}
