import os
filepath = 'data/storage/parquet_lake.py'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("pd.Timestamp(start_date, tz='UTC')", "pd.to_datetime(start_date, utc=True)")
content = content.replace("pd.Timestamp(end_date, tz='UTC')", "pd.to_datetime(end_date, utc=True)")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Done")
