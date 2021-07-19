export const REGION_SQL = `
CASE
WHEN countryCode = 'GB' THEN 'GB'
WHEN countryCode = 'US' THEN 'US'
WHEN countryCode = 'AU' THEN 'AU'
WHEN countryCode = 'NZ' THEN 'NZ'
WHEN countryCode = 'CA' THEN 'CA'
WHEN countryCode IN (
	'AD', 'AL', 'AT', 'BA', 'BE', 'BG', 'BL',
	'CH', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES',
	'FI', 'FO', 'FR', 'GF', 'GL', 'GP', 'GR',
	'HR', 'HU', 'IE', 'IT', 'LI', 'LT', 'LU',
	'LV', 'MC', 'ME', 'MF', 'IS', 'MQ', 'MT',
	'NL', 'NO', 'PF', 'PL', 'PM', 'PT', 'RE',
	'RO', 'RS', 'SE', 'SI', 'SJ', 'SK', 'SM',
	'TF', 'TR', 'WF', 'YT', 'VA', 'AX'
	) THEN 'EU'
ELSE
'ROW'
END
AS region
`;
