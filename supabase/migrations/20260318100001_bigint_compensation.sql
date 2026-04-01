-- Change executive_compensation monetary columns from integer to bigint.
-- integer (32-bit) maxes out at ~$21.4M in cents, which overflows for
-- large executive compensation packages. Store values in whole dollars
-- as bigint instead.

ALTER TABLE executive_compensation
  ALTER COLUMN total_compensation TYPE bigint,
  ALTER COLUMN salary TYPE bigint,
  ALTER COLUMN bonus TYPE bigint,
  ALTER COLUMN stock_awards TYPE bigint,
  ALTER COLUMN option_awards TYPE bigint,
  ALTER COLUMN non_equity_incentive TYPE bigint,
  ALTER COLUMN other_compensation TYPE bigint;
