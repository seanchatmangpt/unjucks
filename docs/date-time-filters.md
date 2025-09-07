# Day.js Date/Time Filters for Nunjucks Templates

## Overview

Unjucks now includes comprehensive date/time filtering powered by Day.js, providing powerful date manipulation capabilities in your templates. All filters handle various input formats (string, timestamp, Date object) with robust error handling.

## Installation

Day.js is automatically included with Unjucks. No additional installation required.

## Available Filters

### Core Date Formatting & Manipulation

#### `formatDate(date, format)`
Format dates using Day.js format strings.

```njk
{{ "2023-12-25" | formatDate }}                    → 2023-12-25
{{ "2023-12-25T10:30:00" | formatDate("YYYY_MM_DD_HHmmss") }} → 2023_12_25_103000
{{ now() | formatDate("dddd, MMMM DD, YYYY") }}     → Saturday, September 07, 2025
```

#### `dateAdd(date, amount, unit)` & `dateSub(date, amount, unit)`
Add or subtract time periods from dates.

```njk
{{ "2023-12-25" | dateAdd(5, "day") | formatDate }} → 2023-12-30
{{ now() | dateSub(1, "month") | formatDate }}      → 2025-08-07
{{ "2023-12-25" | dateAdd(1, "year") | dateSub(6, "month") | formatDate }} → 2024-06-25
```

**Supported units:** `second`, `minute`, `hour`, `day`, `week`, `month`, `year`

### Relative Time

#### `dateFrom(date, withoutSuffix)` & `dateTo(date, withoutSuffix)`
Get relative time strings (e.g., "2 hours ago", "in 3 days").

```njk
{{ yesterday | dateFrom }}           → a day ago
{{ yesterday | dateFrom(true) }}     → a day
{{ tomorrow | dateTo }}              → in a day
{{ future | toNow }}                 → in 2 hours
```

### Start/End of Time Periods

#### `dateStart(date, unit)` & `dateEnd(date, unit)`
Get start or end of time periods.

```njk
{{ "2023-12-25T15:30:45" | dateStart("day") | formatDate("YYYY-MM-DD HH:mm:ss") }}
→ 2023-12-25 00:00:00

{{ "2023-02-15" | dateEnd("month") | formatDate("YYYY-MM-DD") }}
→ 2023-02-28

{{ now() | startOf("week") | formatDate("dddd") }}  → Sunday
{{ now() | endOf("year") | formatDate("YYYY-MM-DD") }} → 2025-12-31
```

**Supported units:** `second`, `minute`, `hour`, `day`, `week`, `month`, `year`

### Date Comparisons

#### `isToday(date)`, `isBefore(date, compareDate)`, `isAfter(date, compareDate)`
Boolean date comparisons.

```njk
{{ now() | isToday }}                        → true
{{ "2023-12-24" | isBefore("2023-12-25") }}  → true
{{ "2023-12-26" | isAfter("2023-12-25") }}   → true
```

#### `dateDiff(date1, date2, unit)`
Calculate difference between dates.

```njk
{{ "2023-12-30" | dateDiff("2023-12-25", "day") }}    → 5
{{ now() | diff(now() | dateStart("year"), "month") }} → 8
```

### Date Conversions

#### `dateUnix(date)`, `dateIso(date)`, `dateUtc(date)`
Convert dates to different formats.

```njk
{{ "2023-12-25" | dateUnix }}    → 1703462400
{{ now() | dateIso }}            → 2025-09-07T20:32:46.574Z
{{ now() | dateUtc | formatDate("YYYY-MM-DD HH:mm:ss [UTC]") }}
→ 2025-09-07 20:32:46 UTC
```

#### `dateTimezone(date, timezone)`
Convert to specific timezone.

```njk
{{ now() | dateTimezone("America/New_York") | formatDate("YYYY-MM-DD HH:mm:ss") }}
{{ now() | tz("Europe/London") | formatDate("HH:mm") }}
```

## Global Functions

### Enhanced Globals (Backwards Compatible)

#### `now()`
Returns current dayjs instance (chainable with filters).

```njk
{{ now() | formatDate("YYYY-MM-DD") }}
{{ now() | dateAdd(1, "week") | formatDate("MMMM DD") }}
```

#### `today()`
Returns start of today (00:00:00).

```njk
{{ today() | formatDate("YYYY-MM-DD HH:mm:ss") }}  → 2025-09-07 00:00:00
```

#### `formatDate(date, format)` (Global)
Enhanced global function using Day.js.

```njk
{{ formatDate("2023-12-25", "YYYY/MM/DD") }}  → 2023/12/25
```

#### `timestamp()` (Legacy)
Original timestamp function for backwards compatibility.

```njk
{{ timestamp() }}  → 20250907133246
```

#### `dayjs`
Direct access to Day.js instance for advanced usage.

```njk
{{ dayjs().add(1, 'month').format('MMMM YYYY') }}
```

## Practical Examples

### Migration Files
```njk
---
to: migrations/{{ timestamp() }}_create_{{ tableName | snakeCase }}.sql
---
-- Migration created on {{ now() | formatDate('YYYY-MM-DD [at] HH:mm:ss') }}
-- File: {{ timestamp() }}_create_{{ tableName | snakeCase }}.sql

CREATE TABLE {{ tableName | snakeCase }} (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMP DEFAULT '{{ now() | iso }}',
  updated_at TIMESTAMP DEFAULT '{{ now() | iso }}'
);
```

### API Documentation
```njk
---
to: docs/api/{{ apiName | kebabCase }}-{{ now() | formatDate('YYYY-MM-DD') }}.md
---
# {{ apiName }} API

Generated: {{ now() | formatDate('MMMM DD, YYYY [at] h:mm A') }}
Version: {{ version | default('1.0.0') }}
Expires: {{ now() | dateAdd(6, 'month') | formatDate('YYYY-MM-DD') }}

## Endpoints

### Authentication
- Token expires: {{ now() | dateAdd(24, 'hour') | iso }}
- Refresh needed: {{ now() | dateAdd(23, 'hour') | formatDate('h:mm A') }}
```

### Backup Scripts
```njk
---
to: scripts/backup-{{ now() | formatDate('YYYY-MM-DD') }}.sh
chmod: +x
---
#!/bin/bash
# Backup script generated on {{ now() | formatDate('dddd, MMMM DD, YYYY') }}

BACKUP_DIR="/backups/{{ now() | formatDate('YYYY/MM') }}"
BACKUP_FILE="backup_{{ now() | formatDate('YYYY-MM-DD_HH-mm-ss') }}.tar.gz"
LOG_FILE="/logs/backup_{{ now() | formatDate('YYYY-MM-DD') }}.log"

echo "Backup started at {{ now() | formatDate('YYYY-MM-DD HH:mm:ss') }}" >> $LOG_FILE
```

### Configuration Files
```njk
---
to: config/{{ env | default('production') }}.json
---
{
  "environment": "{{ env | default('production') }}",
  "generated": "{{ now() | iso }}",
  "cache": {
    "ttl": {{ now() | dateAdd(1, 'hour') | unix }},
    "expires": "{{ now() | dateAdd(24, 'hour') | iso }}"
  },
  "scheduler": {
    "daily_backup": "{{ now() | dateAdd(1, 'day') | dateStart('day') | formatDate('HH:mm') }}",
    "weekly_report": "{{ now() | dateAdd(1, 'week') | dateStart('week') | formatDate('dddd [at] HH:mm') }}",
    "monthly_cleanup": "{{ now() | dateAdd(1, 'month') | dateStart('month') | formatDate('YYYY-MM-DD') }}"
  }
}
```

## Filter Aliases

Many filters have convenient aliases:

- `dateFormat` → `formatDate`
- `dateSubtract` → `dateSub`
- `fromNow` → `dateFrom`
- `toNow` → `dateTo`
- `startOf` → `dateStart`
- `endOf` → `dateEnd`
- `diff` → `dateDiff`
- `unix` → `dateUnix`
- `iso` → `dateIso`
- `utc` → `dateUtc`
- `tz` → `dateTimezone`

## Error Handling

All filters handle invalid inputs gracefully:

```njk
{{ "invalid-date" | formatDate }}     → (empty string)
{{ null | isToday }}                  → false
{{ undefined | dateAdd(1, "day") }}   → (empty string)
```

## Performance Notes

- Day.js is lightweight (~2KB gzipped)
- Filters are optimized for template usage
- All operations are timezone-aware when needed
- Caching is handled internally by Day.js

## Migration from Legacy Functions

The new filters are fully backwards compatible:

```njk
<!-- Legacy (still works) -->
{{ timestamp() }}
{{ formatDate(now(), 'YYYY-MM-DD') }}

<!-- New (recommended) -->
{{ now() | formatDate('YYYY_MM_DD_HHmmss') }}
{{ now() | formatDate('YYYY-MM-DD') }}
```

## Common Format Patterns

```njk
YYYY-MM-DD          → 2025-09-07
YYYY_MM_DD_HHmmss   → 2025_09_07_133246
dddd, MMMM DD, YYYY → Saturday, September 07, 2025
h:mm A              → 1:32 PM
HH:mm:ss            → 13:32:46
MMM DD, YYYY        → Sep 07, 2025
YYYY/MM/DD          → 2025/09/07
```

For complete format reference, see [Day.js Format Documentation](https://day.js.org/docs/en/display/format).