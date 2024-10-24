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

export const REGION_SQL_v2 = `
CASE
WHEN country_Code = 'GB' THEN 'GB'
WHEN country_Code = 'US' THEN 'US'
WHEN country_Code = 'AU' THEN 'AU'
WHEN country_Code = 'NZ' THEN 'NZ'
WHEN country_Code = 'CA' THEN 'CA'
WHEN country_Code IN (
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

export const REGION_SQL_v3 = `
CASE
WHEN country_key = 'GB' THEN 'GB'
WHEN country_key = 'US' THEN 'US'
WHEN country_key = 'AU' THEN 'AU'
WHEN country_key = 'NZ' THEN 'NZ'
WHEN country_key = 'CA' THEN 'CA'
WHEN country_key IN (
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
