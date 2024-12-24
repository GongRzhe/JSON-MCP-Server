# JSON Query Service

A service that provides powerful JSON querying capabilities using JSONPath syntax and additional features.

## Features

### 1. Basic JSONPath Queries
```json
{
  "url": "https://api.example.com/data",
  "jsonPath": "$[0]",              // Get first element
  "jsonPath": "$[*]",              // Get all elements
  "jsonPath": "$.fieldName",       // Get specific field
  "jsonPath": "$[*].fieldName"     // Get field from all elements
}
```

### 2. Array Operations

#### Array Slicing
```json
{
  "jsonPath": "$[0:5]",            // Get first 5 elements
  "jsonPath": "$[-3:]",            // Get last 3 elements
  "jsonPath": "$[1:4]"             // Get elements from index 1 to 3
}
```

#### Array Length
```json
{
  "jsonPath": "$.length()"         // Get array length
}
```

### 3. Field Selection
```json
{
  "jsonPath": "$[*].title",                // Select single field
  "jsonPath": "$[*][title,body]",          // Select multiple fields
  "jsonPath": "$[0,1,2].title"             // Select field from specific indices
}
```

### 4. Filtering

#### Using JSONPath Filter
```json
{
  "jsonPath": "$[?(@.id > 95)]",           // Greater than
  "jsonPath": "$[?(@.id >= 95)]",          // Greater than or equal
  "jsonPath": "$[?(@.id < 5)]",            // Less than
  "jsonPath": "$[?(@.userId == 1)]"        // Equal to
}
```

#### Using Filter Tool
```json
{
  "url": "https://api.example.com/data",
  "jsonPath": "$[*]",
  "condition": "@.id < 5"                   // Numeric comparison
}
```

```json
{
  "jsonPath": "$[*]",
  "condition": "@.title == 'example'"       // String comparison
}
```

### 5. Combining Operations
```json
{
  "jsonPath": "$[0:5][?(@.id > 2)]",       // Slice then filter
  "jsonPath": "$[?(@.userId == 1)].title",  // Filter then select field
  "jsonPath": "$[-3:][title,body]"         // Get last 3 items with specific fields
}
```

## Usage

### Query Tool
```json
{
  "url": "https://api.example.com/data",
  "jsonPath": "<your-jsonpath-expression>"
}
```

### Filter Tool
```json
{
  "url": "https://api.example.com/data",
  "jsonPath": "<base-jsonpath>",
  "condition": "<filter-condition>"
}
```

## Examples

1. **Get first 5 posts**
```json
{
  "url": "https://jsonplaceholder.typicode.com/posts",
  "jsonPath": "$[0:5]"
}
```

2. **Get titles of posts by user 1**
```json
{
  "url": "https://jsonplaceholder.typicode.com/posts",
  "jsonPath": "$[?(@.userId == 1)].title"
}
```

3. **Get last 3 posts with specific fields**
```json
{
  "url": "https://jsonplaceholder.typicode.com/posts",
  "jsonPath": "$[-3:][title,body]"
}
```

4. **Filter posts with ID less than 5**
```json
{
  "url": "https://jsonplaceholder.typicode.com/posts",
  "jsonPath": "$[*]",
  "condition": "@.id < 5"
}
```

## Notes

1. All JSONPath expressions start with `$` representing the root object
2. Array indices are zero-based
3. Filter conditions in the filter tool support basic comparison operators (`>`, `>=`, `<`, `<=`, `==`, `!=`)
4. String values in filter conditions should be wrapped in quotes
5. The service supports both JSONPath filtering and a separate filter tool for more complex conditions 