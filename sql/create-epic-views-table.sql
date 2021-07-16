CREATE EXTERNAL TABLE IF NOT EXISTS acquisition.epic_views_prod (
  `url` string,
  `countryCode` string
)
ROW FORMAT SERDE 'org.openx.data.jsonserde.JsonSerDe'
WITH SERDEPROPERTIES (
  'serialization.format' = '1'
) LOCATION 's3://gu-support-analytics/epic-views/PROD/'
TBLPROPERTIES ('has_encrypted_data'='false');

