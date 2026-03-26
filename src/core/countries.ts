export interface CountryDial {
	code: string;
	name: string;
	dial: string;
}

/** Lista desplegable: país + prefijo (dial sin + en valor interno) */
export const COUNTRY_DIAL_OPTIONS: CountryDial[] = [
	{ code: "CO", name: "Colombia", dial: "57" },
	{ code: "US", name: "Estados Unidos", dial: "1" },
	{ code: "MX", name: "México", dial: "52" },
	{ code: "EC", name: "Ecuador", dial: "593" },
	{ code: "PE", name: "Perú", dial: "51" },
	{ code: "CL", name: "Chile", dial: "56" },
	{ code: "AR", name: "Argentina", dial: "54" },
	{ code: "BR", name: "Brasil", dial: "55" },
	{ code: "ES", name: "España", dial: "34" },
	{ code: "VE", name: "Venezuela", dial: "58" },
	{ code: "PA", name: "Panamá", dial: "507" },
	{ code: "CR", name: "Costa Rica", dial: "506" },
];

export const DEFAULT_COUNTRY_DIAL = COUNTRY_DIAL_OPTIONS[0];
