# Template Filters Reference

> **📚 Complete catalog of 65+ available filters in Unjucks with syntax, examples, and use cases.**

Unjucks provides a comprehensive set of filters for template processing, covering string manipulation, date/time formatting, fake data generation, semantic web processing, and utility functions. All filters are production-tested and optimized for performance.

## String Inflection Filters

### Case Conversion

#### `pascalCase` | `PascalCase`
Convert string to PascalCase format.

```njk
{{ "user-profile" | pascalCase }}        <!-- UserProfile -->
{{ "user_profile_data" | pascalCase }}   <!-- UserProfileData -->
```

**Parameters:** None  
**Input:** String  
**Output:** String in PascalCase  
**Use Cases:** Class names, component names, interface definitions

#### `camelCase`
Convert string to camelCase format.

```njk
{{ "user-profile" | camelCase }}         <!-- userProfile -->
{{ "USER_PROFILE" | camelCase }}         <!-- userProfile -->
```

**Parameters:** None  
**Input:** String  
**Output:** String in camelCase  
**Use Cases:** Variable names, function names, object properties

#### `kebabCase` | `kebab-case`
Convert string to kebab-case format.

```njk
{{ "UserProfile" | kebabCase }}          <!-- user-profile -->
{{ "userProfileData" | kebabCase }}      <!-- user-profile-data -->
```

**Parameters:** None  
**Input:** String  
**Output:** String in kebab-case  
**Use Cases:** CSS classes, HTML attributes, file names

#### `snakeCase` | `snake_case`
Convert string to snake_case format.

```njk
{{ "getUserProfile" | snakeCase }}       <!-- get_user_profile -->
{{ "UserProfile" | snakeCase }}          <!-- user_profile -->
```

**Parameters:** None  
**Input:** String  
**Output:** String in snake_case  
**Use Cases:** Database columns, Python variables, constants

#### `constantCase` | `CONSTANT_CASE`
Convert string to CONSTANT_CASE format.

```njk
{{ "apiUrl" | constantCase }}            <!-- API_URL -->
{{ "maxRetryCount" | constantCase }}     <!-- MAX_RETRY_COUNT -->
```

**Parameters:** None  
**Input:** String  
**Output:** String in CONSTANT_CASE  
**Use Cases:** Environment variables, configuration constants

#### `titleCase`
Convert string to Title Case format.

```njk
{{ "hello world" | titleCase }}          <!-- Hello World -->
{{ "user-profile data" | titleCase }}    <!-- User-Profile Data -->
```

**Parameters:** None  
**Input:** String  
**Output:** String in Title Case  
**Use Cases:** Headlines, page titles, display names

#### `sentenceCase`
Convert string to Sentence case format.

```njk
{{ "hello_world" | sentenceCase }}       <!-- Hello world -->
{{ "USER_PROFILE" | sentenceCase }}      <!-- User profile -->
```

**Parameters:** None  
**Input:** String  
**Output:** String in Sentence case  
**Use Cases:** Form labels, descriptions, UI text

#### `slug`
Convert string to URL-safe slug format.

```njk
{{ "Hello World!" | slug }}              <!-- hello-world -->
{{ "Dr. John A. Smith" | slug }}         <!-- dr-john-a-smith -->
```

**Parameters:** `separator` (optional, default: '-')  
**Input:** String  
**Output:** URL-safe slug  
**Use Cases:** URLs, file names, identifiers

#### `humanize`
Convert technical string to human-readable format.

```njk
{{ "user_profile" | humanize }}          <!-- User profile -->
{{ "created-at" | humanize }}            <!-- Created at -->
```

**Parameters:** None  
**Input:** String  
**Output:** Human-readable string  
**Use Cases:** UI labels, form fields, display text

#### `classify`
Convert string to singular PascalCase class name.

```njk
{{ "user_posts" | classify }}            <!-- UserPost -->
{{ "blog-entries" | classify }}          <!-- BlogEntry -->
```

**Parameters:** None  
**Input:** String  
**Output:** Singular PascalCase  
**Use Cases:** Model names, class names

#### `tableize`
Convert string to plural snake_case table name.

```njk
{{ "UserPost" | tableize }}              <!-- user_posts -->
{{ "BlogEntry" | tableize }}             <!-- blog_entries -->
```

**Parameters:** None  
**Input:** String  
**Output:** Plural snake_case  
**Use Cases:** Database tables, collections

### Basic String Filters

#### `capitalize`
Capitalize first letter, lowercase the rest.

```njk
{{ "hello WORLD" | capitalize }}         <!-- Hello world -->
```

#### `lower` | `lowerCase`
Convert to lowercase.

```njk
{{ "Hello WORLD" | lower }}              <!-- hello world -->
```

#### `upper` | `upperCase`
Convert to uppercase.

```njk
{{ "Hello World" | upper }}              <!-- HELLO WORLD -->
```

### Advanced String Transformations

#### `slug`
Convert to URL-safe slug.

```njk
{{ "Hello World!" | slug }}              <!-- hello-world -->
{{ "Hello World!" | slug('_') }}         <!-- hello_world -->
```

**Parameters:**
- `separator` (string, optional): Separator character (default: '-')

#### `humanize`
Convert to human-readable format.

```njk
{{ "user_name" | humanize }}             <!-- User name -->
{{ "getUserProfile" | humanize }}        <!-- Get user profile -->
```

#### `underscore`
Alias for snakeCase.

```njk
{{ "UserProfile" | underscore }}         <!-- user_profile -->
```

#### `dasherize`
Alias for kebabCase.

```njk
{{ "UserProfile" | dasherize }}          <!-- user-profile -->
```

#### `classify`
Convert to singular PascalCase (for class names).

```njk
{{ "user_posts" | classify }}            <!-- UserPost -->
{{ "categories" | classify }}            <!-- Category -->
```

#### `tableize`
Convert to plural snake_case (for table names).

```njk
{{ "UserPost" | tableize }}              <!-- user_posts -->
{{ "Category" | tableize }}              <!-- categories -->
```

#### `camelize`
Enhanced camelCase with first letter option.

```njk
{{ "user-profile" | camelize }}          <!-- userProfile -->
{{ "user-profile" | camelize(true) }}    <!-- UserProfile -->
```

**Parameters:**
- `firstLetter` (boolean, optional): Capitalize first letter (default: false)

#### `demodulize`
Remove module namespaces.

```njk
{{ "Admin::Users::User" | demodulize }}  <!-- User -->
{{ "App/Models/User" | demodulize }}     <!-- User -->
```

## String Utilities

#### `truncate`
Truncate string to specified length.

```njk
{{ "Hello World" | truncate(5) }}        <!-- Hello... -->
{{ "Hello World" | truncate(5, '…') }}   <!-- Hello… -->
```

**Parameters:**
- `length` (number, default: 30): Maximum length
- `suffix` (string, default: '...'): Suffix to append

#### `wrap`
Word wrap at specified width.

```njk
{{ longText | wrap(40) }}
```

**Parameters:**
- `width` (number, default: 80): Wrap width

#### `pad`
Pad string to specified length.

```njk
{{ "hello" | pad(10) }}                  <!-- "  hello   " -->
{{ "hello" | pad(10, '0') }}             <!-- "00hello000" -->
```

**Parameters:**
- `length` (number): Target length
- `padString` (string, default: ' '): String to pad with

#### `repeat`
Repeat string specified number of times.

```njk
{{ "-" | repeat(5) }}                    <!-- ----- -->
```

**Parameters:**
- `count` (number): Number of repetitions

#### `reverse`
Reverse string character order.

```njk
{{ "hello" | reverse }}                  <!-- olleh -->
```

#### `swapCase`
Swap upper and lower case characters.

```njk
{{ "Hello World" | swapCase }}           <!-- hELLO wORLD -->
```

## Pluralization

#### `pluralize`
Convert to plural form (basic English rules).

```njk
{{ "item" | pluralize }}                 <!-- items -->
{{ "child" | pluralize }}                <!-- children -->
{{ "category" | pluralize }}             <!-- categories -->
```

#### `singular`
Convert to singular form.

```njk
{{ "items" | singular }}                 <!-- item -->
{{ "categories" | singular }}            <!-- category -->
```

## Date/Time Filters (Day.js powered)

### Core Date Formatting

#### `formatDate` | `dateFormat`
Format date using dayjs formatting.

```njk
{{ "2023-12-25" | formatDate }}                    <!-- 2023-12-25 -->
{{ "2023-12-25T10:30:00Z" | formatDate('MM/DD/YYYY') }}  <!-- 12/25/2023 -->
{{ now() | formatDate('dddd, MMMM D, YYYY') }}     <!-- Monday, December 25, 2023 -->
```

**Parameters:**
- `format` (string, default: 'YYYY-MM-DD'): Day.js format string

**Common Format Patterns:**
- `YYYY-MM-DD` → 2023-12-25
- `MM/DD/YYYY` → 12/25/2023
- `dddd, MMMM D, YYYY` → Monday, December 25, 2023
- `h:mm A` → 10:30 AM
- `YYYY-MM-DD HH:mm:ss` → 2023-12-25 10:30:00

### Date Manipulation

#### `dateAdd`
Add time to a date.

```njk
{{ now() | dateAdd(1, 'day') | formatDate }}       <!-- Tomorrow -->
{{ "2023-01-01" | dateAdd(2, 'weeks') }}          <!-- Add 2 weeks -->
{{ now() | dateAdd(3, 'months') }}                <!-- Add 3 months -->
```

**Parameters:**
- `amount` (number): Amount to add
- `unit` (string): Unit (day, week, month, year, hour, minute, second)

#### `dateSub` | `dateSubtract`
Subtract time from a date.

```njk
{{ now() | dateSub(1, 'day') | formatDate }}       <!-- Yesterday -->
{{ "2023-12-31" | dateSub(1, 'year') }}           <!-- 2022-12-31 -->
```

### Relative Time

#### `dateFrom` | `fromNow`
Get relative time from now.

```njk
{{ "2023-12-20" | dateFrom }}                      <!-- 5 days ago -->
{{ "2023-12-20" | dateFrom(true) }}                <!-- 5 days (without "ago") -->
```

**Parameters:**
- `withoutSuffix` (boolean, default: false): Remove "ago" suffix

#### `dateTo` | `toNow`
Get relative time to future date.

```njk
{{ "2023-12-30" | dateTo }}                        <!-- in 5 days -->
{{ "2023-12-30" | dateTo(true) }}                  <!-- 5 days (without "in") -->
```

### Start/End of Time Periods

#### `dateStart` | `startOf`
Get start of time unit.

```njk
{{ now() | dateStart('day') | formatDate }}        <!-- Start of today -->
{{ now() | dateStart('month') | formatDate }}      <!-- Start of month -->
{{ now() | dateStart('year') | formatDate }}       <!-- Start of year -->
```

**Parameters:**
- `unit` (string, default: 'day'): Time unit

#### `dateEnd` | `endOf`
Get end of time unit.

```njk
{{ now() | dateEnd('day') | formatDate }}          <!-- End of today -->
{{ now() | dateEnd('week') | formatDate }}         <!-- End of week -->
```

### Date Comparisons

#### `isToday`
Check if date is today.

```njk
{% if someDate | isToday %}Today!{% endif %}
```

#### `isBefore`
Check if date is before another date.

```njk
{% if startDate | isBefore(endDate) %}Valid range{% endif %}
```

**Parameters:**
- `compareDate` (date, optional): Date to compare against (default: now)
- `unit` (string, default: 'millisecond'): Comparison unit

#### `isAfter`
Check if date is after another date.

```njk
{% if eventDate | isAfter(now()) %}Future event{% endif %}
```

#### `dateDiff` | `diff`
Get difference between dates.

```njk
{{ endDate | dateDiff(startDate, 'days') }}        <!-- Days difference -->
{{ now() | dateDiff(birthday, 'years') }}          <!-- Age in years -->
```

### Date Conversions

#### `dateUnix` | `unix`
Get Unix timestamp.

```njk
{{ now() | dateUnix }}                             <!-- 1703512200 -->
```

#### `dateIso` | `iso`
Get ISO string.

```njk
{{ now() | dateIso }}                              <!-- 2023-12-25T10:30:00.000Z -->
```

#### `dateUtc` | `utc`
Convert to UTC.

```njk
{{ localDate | dateUtc | formatDate }}
```

#### `dateTimezone` | `tz`
Convert to timezone.

```njk
{{ utcDate | dateTimezone('America/New_York') | formatDate }}
```

**Parameters:**
- `tz` (string): Timezone string (e.g., 'America/New_York')

## Fake Data Generation (Faker.js powered)

### Personal Data

#### `fakeName`
Generate fake full name.

```njk
{{ '' | fakeName }}                                <!-- John Doe -->
```

#### `fakeEmail`
Generate fake email address.

```njk
{{ '' | fakeEmail }}                               <!-- user@example.com -->
```

#### `fakePhone`
Generate fake phone number.

```njk
{{ '' | fakePhone }}                               <!-- (555) 123-4567 -->
```

### Location Data

#### `fakeAddress`
Generate fake street address.

```njk
{{ '' | fakeAddress }}                             <!-- 123 Main St -->
```

#### `fakeCity`
Generate fake city name.

```njk
{{ '' | fakeCity }}                                <!-- Springfield -->
```

### Business Data

#### `fakeCompany`
Generate fake company name.

```njk
{{ '' | fakeCompany }}                             <!-- Acme Corp -->
```

### Technical Data

#### `fakeUuid`
Generate fake UUID.

```njk
{{ '' | fakeUuid }}                                <!-- 550e8400-e29b-41d4-a716-446655440000 -->
```

#### `fakeNumber`
Generate fake number within range.

```njk
{{ '' | fakeNumber }}                              <!-- Random 1-100 -->
{{ '' | fakeNumber(10, 50) }}                      <!-- Random 10-50 -->
```

**Parameters:**
- `min` (number, default: 1): Minimum value
- `max` (number, default: 100): Maximum value

### Text Data

#### `fakeText`
Generate fake text with specified sentences.

```njk
{{ '' | fakeText }}                                <!-- 3 sentences -->
{{ '' | fakeText(5) }}                             <!-- 5 sentences -->
```

**Parameters:**
- `sentences` (number, default: 3): Number of sentences

#### `fakeParagraph`
Generate fake paragraph.

```njk
{{ '' | fakeParagraph }}                           <!-- Lorem ipsum... -->
```

### Time Data

#### `fakeDate`
Generate fake date between dates.

```njk
{{ '' | fakeDate }}                                <!-- Random date past year -->
{{ '' | fakeDate('2023-01-01', '2023-12-31') }}   <!-- Random date in 2023 -->
```

**Parameters:**
- `from` (date, optional): Start date
- `to` (date, optional): End date

#### `fakeBoolean`
Generate fake boolean.

```njk
{{ '' | fakeBoolean }}                             <!-- true or false -->
```

### Array Utilities

#### `fakeArrayElement`
Pick random element from array.

```njk
{{ ['red', 'blue', 'green'] | fakeArrayElement }} <!-- Random color -->
```

### Faker Configuration

#### `fakeSeed`
Set faker seed for deterministic output.

```njk
{{ 12345 | fakeSeed }}                             <!-- Sets seed -->
```

#### `fakeLocale`
Set faker locale.

```njk
{{ 'es' | fakeLocale }}                            <!-- Spanish locale -->
```

#### `fakeSchema`
Generate complex objects from schema.

```njk
---
to: users/{{ name | slug }}.json
---
{{ {
  name: 'name',
  email: 'email',
  age: { type: 'number', min: 18, max: 65 },
  active: 'boolean'
} | fakeSchema | dump }}
```

## Utility Filters

#### `dump`
JSON stringify with pretty formatting.

```njk
{{ object | dump }}                                <!-- Pretty JSON -->
```

#### `join`
Join array elements with separator.

```njk
{{ ['a', 'b', 'c'] | join(', ') }}                <!-- a, b, c -->
```

**Parameters:**
- `separator` (string, default: ''): Join separator

#### `default`
Provide default value for empty/null values.

```njk
{{ value | default('DefaultValue') }}              <!-- Uses default if empty -->
```

**Parameters:**
- `defaultValue` (any): Value to use if input is empty

## Semantic/RDF Filters

### RDF Query Filters

#### `rdfSubject`
Find subjects with predicate-object pair.

```njk
{{ 'foaf:Person' | rdfSubject('rdf:type', 'foaf:Person') }}
```

#### `rdfObject`
Get objects for subject-predicate pair.

```njk
{{ 'ex:john' | rdfObject('foaf:name') }}
```

#### `rdfPredicate`
Find predicates connecting subject-object.

```njk
{{ 'ex:john' | rdfPredicate('ex:alice') }}
```

#### `rdfQuery`
Execute SPARQL-like pattern query.

```njk
{{ '?s rdf:type foaf:Person' | rdfQuery }}
```

#### `rdfLabel`
Get best available label for resource.

```njk
{{ 'ex:john' | rdfLabel }}                         <!-- John Smith -->
```

#### `rdfType`
Get all types for resource.

```njk
{{ 'ex:john' | rdfType }}                          <!-- [foaf:Person] -->
```

### RDF Utilities

#### `rdfNamespace`
Resolve namespace prefix.

```njk
{{ 'foaf' | rdfNamespace }}                        <!-- http://xmlns.com/foaf/0.1/ -->
```

#### `rdfExpand`
Expand prefixed URI to full URI.

```njk
{{ 'foaf:Person' | rdfExpand }}                    <!-- http://xmlns.com/foaf/0.1/Person -->
```

#### `rdfCompact`
Compact full URI to prefixed form.

```njk
{{ 'http://xmlns.com/foaf/0.1/Person' | rdfCompact }}  <!-- foaf:Person -->
```

#### `rdfCount`
Count matching triples.

```njk
{{ null | rdfCount('rdf:type', 'foaf:Person') }}   <!-- Number of people -->
```

#### `rdfExists`
Check if triple exists.

```njk
{% if 'ex:john' | rdfExists('foaf:name') %}Has name{% endif %}
```

### Semantic Value Processing

#### `semanticValue`
Convert value to RDF literal/resource.

```njk
{{ "John Smith" | semanticValue }}                 <!-- "John Smith" -->
{{ 42 | semanticValue }}                           <!-- "42"^^xsd:integer -->
{{ true | semanticValue }}                         <!-- "true"^^xsd:boolean -->
```

#### `literalOrResource`
Convert to literal or resource based on context.

```njk
{{ "http://example.org/john" | literalOrResource }}  <!-- <http://example.org/john> -->
{{ "John Smith" | literalOrResource }}               <!-- "John Smith" -->
```

#### `prefixedName`
Convert to prefixed name if possible.

```njk
{{ "http://xmlns.com/foaf/0.1/name" | prefixedName }}  <!-- foaf:name -->
```

## Global Functions

These functions are available in templates without needing a filter:

### Date/Time Globals

```njk
{{ now() }}                                        <!-- Current moment -->
{{ today() }}                                      <!-- Start of today -->
{{ timestamp() }}                                  <!-- YYYYMMDDHHMMSS format -->
{{ formatDate() }}                                 <!-- Today in YYYY-MM-DD -->
{{ dayjs() }}                                      <!-- Raw dayjs instance -->
```

### Faker Globals

```njk
{{ fakeName() }}                                   <!-- John Doe -->
{{ fakeEmail() }}                                  <!-- user@example.com -->
{{ fakeUuid() }}                                   <!-- UUID -->
{{ configureFaker({seed: 12345, locale: 'es'}) }} <!-- Configure faker -->
```

## Filter Chaining

Filters can be chained for complex transformations:

```njk
---
to: src/components/{{ componentName | pascalCase }}/{{ componentName | kebabCase }}.vue
inject: true
skip_if: '{{ not withTests }}'
---
<template>
  <div class="{{ componentName | kebabCase }}">
    <h1>{{ title | titleCase | truncate(50) }}</h1>
    <p>Created: {{ now() | formatDate('MMMM D, YYYY') }}</p>
    <span>ID: {{ '' | fakeUuid }}</span>
    <div>{{ description | default('No description') | capitalize }}</div>
  </div>
</template>

<script>
export default {
  name: '{{ componentName | pascalCase }}',
  props: {
    title: {
      type: String,
      default: '{{ componentName | humanize }}'
    }
  }
}
</script>

<style scoped>
.{{ componentName | kebabCase }} {
  /* Component styles */
}
</style>
```

## Performance Notes

- String filters are generally fast for reasonable input sizes
- Date filters using dayjs are optimized for common operations
- Faker filters generate random data each time (use `fakeSeed` for deterministic results)
- RDF filters require loaded RDF data store
- Filter chaining is processed left-to-right
- Complex regex operations may impact performance on large strings