export const regionSql = (columnName: string): string => {
	return `
CASE
WHEN ${columnName} = 'GB' THEN 'GB'
WHEN ${columnName}= 'US' THEN 'US'
WHEN ${columnName} = 'AU' THEN 'AU'
WHEN ${columnName} = 'NZ' THEN 'NZ'
WHEN ${columnName} = 'CA' THEN 'CA'
WHEN ${columnName} IN (
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
};
