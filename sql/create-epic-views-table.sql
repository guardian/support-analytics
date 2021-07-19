CREATE EXTERNAL TABLE IF NOT EXISTS acquisition.epic_views_prod (
  `url` string,
  `countryCode` string
)
PARTITIONED BY (date_hour timestamp)
ROW FORMAT SERDE 'org.openx.data.jsonserde.JsonSerDe'
WITH SERDEPROPERTIES (
  'serialization.format' = '1'
) LOCATION 's3://gu-support-analytics/epic-views/PROD/'
TBLPROPERTIES ('has_encrypted_data'='false');



ALTER TABLE epic_views_prod ADD
PARTITION (date_hour='2021-07-01 13:00:00.000') location 's3://gu-support-analytics/epic-views/CODE/2021/07/01/13/'
