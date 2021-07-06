CREATE EXTERNAL TABLE IF NOT EXISTS acquisition.aggregated-epic-views-prod (
  `url` string,
  `views` int
)
ROW FORMAT SERDE 'org.openx.data.jsonserde.JsonSerDe'
WITH SERDEPROPERTIES (
  'serialization.format' = '1'
) LOCATION 's3://support-aggregated-epic-views/PROD/'
TBLPROPERTIES ('has_encrypted_data'='false');

