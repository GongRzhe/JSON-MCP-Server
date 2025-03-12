# JSON MCP Server (@gongrzhe/server-json-mcp@1.0.3)

A JSON Model Context Protocol (MCP) server implementation for querying and manipulating JSON data. This server enables LLMs to interact with JSON data through a set of standardized tools.

<a href="https://glama.ai/mcp/servers/9g137c4b4k">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/9g137c4b4k/badge" alt="JSON Server MCP server" />
</a>

## Installation & Usage

```bash
# Using npx with specific version (recommended)
npx @gongrzhe/server-json-mcp@1.0.3

# Install specific version globally
npm install -g @gongrzhe/server-json-mcp@1.0.3

# Run after global installation
server-json-mcp
```

## Components

### Tools

- **query**
  - Query JSON data using JSONPath syntax with extended operations
  - Input:
    - `url` (string): URL of the JSON data source
    - `jsonPath` (string): JSONPath expression with optional operations

- **filter**
  - Filter JSON data using conditions
  - Input:
    - `url` (string): URL of the JSON data source
    - `jsonPath` (string): Base JSONPath expression
    - `condition` (string): Filter condition

### Supported Operations

#### Array Operations
- **Slicing**: `$[0:5]`, `$[-3:]`, `$[1:4]`
- **Sorting**: `$.sort(price)`, `$.sort(-price)`
- **Distinct**: `$.distinct()`
- **Transformations**: 
  - Map: `$.map(fieldName)`
  - Flatten: `$.flatten()`
  - Union: `$.union([1,2,3])`
  - Intersection: `$.intersection([1,2,3])`

#### String Operations
- **Case**: `$.toLowerCase()`, `$.toUpperCase()`
- **Tests**: `$.startsWith('test')`, `$.endsWith('test')`
- **Search**: `$.contains('test')`, `$.matches('pattern')`

#### Numeric Operations
- **Math**: `$.math(+10)`, `$.pow2()`
- **Rounding**: `$.round()`, `$.floor()`, `$.ceil()`
- **Functions**: `$.abs()`, `$.sqrt()`

#### Date Operations
- **Format**: `$.format('YYYY-MM-DD')`
- **Check**: `$.isToday()`
- **Modify**: `$.add(1, 'days')`

#### Aggregation Operations
- **Group**: `$.groupBy(category)`
- **Stats**: `$.sum(price)`, `$.avg(price)`, `$.min(price)`, `$.max(price)`

## Configuration

### Usage with Claude Desktop

To use this server with the Claude Desktop app, add the following configuration to your `claude_desktop_config.json`:

```json
{
  "json": {
    "command": "npx",
    "args": [
      "@gongrzhe/server-json-mcp@1.0.3"
    ]
  }
}
```

Alternatively, you can use the node command directly if you have the package installed:

```json
{
  "json": {
    "command": "node",
    "args": [
      "path/to/build/index.js"
    ]
  }
}
```

## Development

### Building from Source

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the project:
   ```bash
   npm run build
   ```

## Notes

1. All JSONPath expressions start with `$` representing the root object
2. Array indices are zero-based
3. String values in operations should be wrapped in quotes
4. Date operations support 'days', 'months', and 'years' units
5. Numeric operations support basic arithmetic operators (+, -, *, /)

## License

MIT