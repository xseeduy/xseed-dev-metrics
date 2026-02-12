# CSV Output Format

## Overview

By default, `gdm collect` outputs metrics in CSV format for easy import into spreadsheet applications, databases, or data analysis tools.

## File Naming

Files are saved to `~/.xseed-metrics/data/<CLIENT_NAME>/` with the naming pattern:
- Single user: `<repo>_<date>.csv` (e.g., `myproject_2024-01-30.csv`)
- Multiple users: `<repo>_<username>_<date>.csv` (e.g., `myproject_John_Doe_2024-01-30.csv`)

## CSV Structure

The CSV file has 5 columns:

| Column | Description |
|--------|-------------|
| `metric_type` | Category of metric (metadata, git_summary, git_user, git_activity_day, git_activity_hour, git_trend, jira) |
| `metric_name` | Name of the specific metric |
| `value` | The metric value |
| `unit` | Unit of measurement (count, rate, days, text, email, timestamp, date) |
| `details` | Additional information (optional) |

## Example Output

```csv
metric_type,metric_name,value,unit,details
metadata,collected_at,2024-01-30T10:30:00.000Z,timestamp,
metadata,repository,myproject,text,
metadata,user_name,John Doe,text,
metadata,user_email,john@example.com,email,
metadata,period,Last 7 days,text,
git_summary,total_commits,45,count,
git_summary,total_authors,3,count,
git_summary,lines_added,1250,count,
git_summary,lines_deleted,450,count,
git_summary,net_lines,800,count,
git_summary,files_changed,28,count,
git_summary,active_branches,2,count,
git_summary,current_branch,main,text,
git_user,commits,32,count,
git_user,lines_added,980,count,
git_user,lines_deleted,320,count,
git_user,lines_net,660,count,
git_user,files_changed,22,count,
git_user,active_days,5,count,
git_user,avg_commits_per_day,6.4,rate,
git_activity_day,Monday,8,count,
git_activity_day,Tuesday,12,count,
git_activity_day,Wednesday,6,count,
git_activity_day,Thursday,4,count,
git_activity_day,Friday,2,count,
git_activity_hour,hour_9,5,count,
git_activity_hour,hour_10,8,count,
git_activity_hour,hour_14,12,count,
git_activity_hour,hour_15,7,count,
git_trend,2024-01-22,15,commits,"lines_added:450|lines_deleted:120|authors:2"
git_trend,2024-01-29,17,commits,"lines_added:530|lines_deleted:200|authors:2"
jira,issues_analyzed,8,count,
jira,issues_created,2,count,
jira,issues_in_progress,3,count,
jira,issues_completed,3,count,
jira,cycle_time_avg_days,4.5,days,
jira,cycle_time_median_days,4.0,days,
jira,velocity_story_points,21,points,
jira,velocity_issues_per_week,3.2,rate,
```

## Importing to Excel/Google Sheets

1. Open Excel or Google Sheets
2. Use **File > Import** or **Data > Import data**
3. Select the CSV file
4. The data will be imported with proper column headers
5. You can now:
   - Create pivot tables
   - Generate charts
   - Filter by `metric_type` to see specific categories
   - Calculate custom metrics

## Importing to Database

### PostgreSQL Example

```sql
CREATE TABLE metrics (
    metric_type VARCHAR(50),
    metric_name VARCHAR(100),
    value TEXT,
    unit VARCHAR(20),
    details TEXT
);

COPY metrics FROM '/path/to/file.csv' WITH CSV HEADER;
```

### MySQL Example

```sql
LOAD DATA INFILE '/path/to/file.csv'
INTO TABLE metrics
FIELDS TERMINATED BY ','
ENCLOSED BY '"'
LINES TERMINATED BY '\n'
IGNORE 1 ROWS;
```

## Python Analysis Example

```python
import pandas as pd

# Load the CSV
df = pd.read_csv('myproject_2024-01-30.csv')

# Filter by metric type
git_summary = df[df['metric_type'] == 'git_summary']
git_user = df[df['metric_type'] == 'git_user']

# Get specific metrics
total_commits = df[df['metric_name'] == 'total_commits']['value'].values[0]
lines_added = df[df['metric_name'] == 'lines_added']['value'].values[0]

print(f"Commits: {total_commits}, Lines Added: {lines_added}")
```

## Converting to JSON

If you need JSON format instead:

```bash
# Collect in JSON format
gdm collect --format json

# Or convert existing CSV to JSON using a tool
```

## Notes

- All numeric values are stored as strings in CSV to maintain compatibility
- Dates are in ISO 8601 format
- The `details` column may contain pipe-separated key:value pairs for complex data
- Missing or null values are represented as empty strings
