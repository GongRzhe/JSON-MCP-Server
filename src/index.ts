import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import fetch from 'node-fetch';
import JSONPath from 'jsonpath';

// Helper function to fetch data
async function fetchData(url: string) {
    const response = await fetch(url, {
        headers: {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0'
        }
    });
    
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
}

// Handle array operations
function handleArrayOperations(data: any[], expression: string): any[] {
    let result = [...data];

    // Handle sorting
    const sortMatch = expression.match(/\.sort\(([-]?\w+)\)/);
    if (sortMatch) {
        const field = sortMatch[1];
        const isDesc = field.startsWith('-');
        const sortField = isDesc ? field.slice(1) : field;
        
        result.sort((a, b) => {
            const aVal = a[sortField];
            const bVal = b[sortField];
            return isDesc ? 
                (bVal > aVal ? 1 : -1) :
                (aVal > bVal ? 1 : -1);
        });
        return result;
    }

    // Handle distinct
    if (expression.includes('.distinct()')) {
        return Array.from(new Set(result));
    }

    // Handle reverse and slice operations
    if (expression.includes("-1")) {
        result = result.reverse();
    }

    const sliceMatch = expression.match(/\[(\d+):(\d+)\]/);
    if (sliceMatch) {
        const start = parseInt(sliceMatch[1]);
        const end = parseInt(sliceMatch[2]);
        result = result.slice(start, end);
    }

    return result;
}

// Handle aggregation operations
function handleAggregation(data: any[], operation: string): number {
    if (!Array.isArray(data) || data.length === 0) return 0;

    const sumMatch = operation.match(/\.sum\((\w+)\)/);
    if (sumMatch) {
        const field = sumMatch[1];
        return data.reduce((sum, item) => sum + (Number(item[field]) || 0), 0);
    }

    const avgMatch = operation.match(/\.avg\((\w+)\)/);
    if (avgMatch) {
        const field = avgMatch[1];
        const sum = data.reduce((acc, item) => acc + (Number(item[field]) || 0), 0);
        return sum / data.length;
    }

    const minMatch = operation.match(/\.min\((\w+)\)/);
    if (minMatch) {
        const field = minMatch[1];
        return Math.min(...data.map(item => Number(item[field]) || 0));
    }

    const maxMatch = operation.match(/\.max\((\w+)\)/);
    if (maxMatch) {
        const field = maxMatch[1];
        return Math.max(...data.map(item => Number(item[field]) || 0));
    }

    return 0;
}

// Handle array length calculation
function getArrayLength(data: any): number {
    if (Array.isArray(data)) {
        return data.length;
    }
    if (typeof data === 'object' && data !== null) {
        return Object.keys(data).length;
    }
    return 0;
}

// Handle string operations
function handleStringOperations(value: string, operation: string): any {
    // String case operations
    if (operation === '.toLowerCase()') return value.toLowerCase();
    if (operation === '.toUpperCase()') return value.toUpperCase();
    
    // String test operations
    const startsWithMatch = operation.match(/\.startsWith\(['"](.+)['"]\)/);
    if (startsWithMatch) return value.startsWith(startsWithMatch[1]);
    
    const endsWithMatch = operation.match(/\.endsWith\(['"](.+)['"]\)/);
    if (endsWithMatch) return value.endsWith(endsWithMatch[1]);
    
    const containsMatch = operation.match(/\.contains\(['"](.+)['"]\)/);
    if (containsMatch) return value.includes(containsMatch[1]);
    
    const matchesMatch = operation.match(/\.matches\(['"](.+)['"]\)/);
    if (matchesMatch) return new RegExp(matchesMatch[1]).test(value);
    
    return value;
}

// Handle array transformations
function handleArrayTransformations(data: any[], expression: string): any[] {
    // Map operation
    const mapMatch = expression.match(/\.map\((\w+)\)/);
    if (mapMatch) {
        const field = mapMatch[1];
        return data.map(item => item[field]);
    }
    
    // Flatten operation
    if (expression === '.flatten()') {
        return data.flat();
    }
    
    // Union operation
    const unionMatch = expression.match(/\.union\((\[.*?\])\)/);
    if (unionMatch) {
        const otherArray = JSON.parse(unionMatch[1]);
        return Array.from(new Set([...data, ...otherArray]));
    }
    
    // Intersection operation
    const intersectionMatch = expression.match(/\.intersection\((\[.*?\])\)/);
    if (intersectionMatch) {
        const otherArray = JSON.parse(intersectionMatch[1]);
        return data.filter(item => otherArray.includes(item));
    }
    
    return data;
}

// Handle grouping operations
function handleGrouping(data: any[], expression: string): Record<string, any> {
    // Group by field
    const groupMatch = expression.match(/\.groupBy\((\w+)\)/);
    if (!groupMatch) return {};
    
    const field = groupMatch[1];
    const groups = data.reduce((acc: Record<string, any[]>, item) => {
        const key = item[field]?.toString() || 'null';
        if (!acc[key]) acc[key] = [];
        acc[key].push(item);
        return acc;
    }, {});
    
    // Handle aggregation after grouping
    const aggMatch = expression.match(/\.(\w+)\((\w+)\)$/);
    if (!aggMatch) return groups;
    
    const [_, aggFunc, aggField] = aggMatch;
    const result: Record<string, number> = {};
    
    for (const [key, group] of Object.entries(groups)) {
        switch (aggFunc) {
            case 'count':
                result[key] = group.length;
                break;
            case 'sum':
                result[key] = group.reduce((sum, item) => sum + (Number(item[aggField]) || 0), 0);
                break;
            case 'avg':
                const sum = group.reduce((acc, item) => acc + (Number(item[aggField]) || 0), 0);
                result[key] = sum / group.length;
                break;
            case 'max':
                result[key] = Math.max(...group.map(item => Number(item[aggField]) || 0));
                break;
            case 'min':
                result[key] = Math.min(...group.map(item => Number(item[aggField]) || 0));
                break;
        }
    }
    
    return result;
}

// Handle numeric operations
function handleNumericOperations(data: any[], expression: string): number[] | number {
    // Extract field name if it exists
    const fieldMatch = expression.match(/^(\w+)\.math/);
    const field = fieldMatch ? fieldMatch[1] : null;
    
    // Get numeric values to operate on
    const values = field 
        ? data.map(item => Number(item[field]) || 0)
        : data.map(Number);

    const mathMatch = expression.match(/\.math\(([\+\-\*\/\d\s]+)\)/);
    if (mathMatch) {
        const expr = mathMatch[1].trim();
        return values.map(num => {
            try {
                // Safe eval for basic math operations
                return Function(`'use strict'; return ${num}${expr}`)();
            } catch {
                return 0;
            }
        });
    }
    
    // Rounding operations
    if (expression.endsWith('.round()')) {
        return values.map(num => Math.round(num));
    }
    if (expression.endsWith('.floor()')) {
        return values.map(num => Math.floor(num));
    }
    if (expression.endsWith('.ceil()')) {
        return values.map(num => Math.ceil(num));
    }
    
    // Math functions
    if (expression.endsWith('.abs()')) {
        return values.map(num => Math.abs(num));
    }
    if (expression.endsWith('.sqrt()')) {
        return values.map(num => Math.sqrt(num));
    }
    if (expression.endsWith('.pow2()')) {
        return values.map(num => Math.pow(num, 2));
    }
    
    return values;
}

// Handle date operations
function handleDateOperations(data: any[], expression: string): any[] {
    // Date formatting
    const formatMatch = expression.match(/\.format\(['"](.+)['"]\)/);
    if (formatMatch) {
        const format = formatMatch[1];
        return data.map(date => {
            const d = new Date(date);
            return format
                .replace('YYYY', d.getFullYear().toString())
                .replace('MM', (d.getMonth() + 1).toString().padStart(2, '0'))
                .replace('DD', d.getDate().toString().padStart(2, '0'))
                .replace('HH', d.getHours().toString().padStart(2, '0'))
                .replace('mm', d.getMinutes().toString().padStart(2, '0'))
                .replace('ss', d.getSeconds().toString().padStart(2, '0'));
        });
    }
    
    // Date comparison
    if (expression === '.isToday()') {
        const today = new Date();
        return data.map(date => {
            const d = new Date(date);
            return d.getDate() === today.getDate() &&
                   d.getMonth() === today.getMonth() &&
                   d.getFullYear() === today.getFullYear();
        });
    }
    
    // Date calculations
    const addMatch = expression.match(/\.add\((\d+),\s*['"](\w+)['"]\)/);
    if (addMatch) {
        const [_, amount, unit] = addMatch;
        return data.map(date => {
            const d = new Date(date);
            switch (unit) {
                case 'days':
                    d.setDate(d.getDate() + Number(amount));
                    break;
                case 'months':
                    d.setMonth(d.getMonth() + Number(amount));
                    break;
                case 'years':
                    d.setFullYear(d.getFullYear() + Number(amount));
                    break;
            }
            return d.toISOString();
        });
    }
    
    return data;
}

// Handle complex filtering
function handleComplexFilter(data: any[], condition: string): any[] {
    // Handle string operations in filter
    if (condition.includes('.contains(')) {
        const match = condition.match(/@\.(\w+)\.contains\(['"](.+)['"]\)/);
        if (match) {
            const [_, field, searchStr] = match;
            return data.filter(item => String(item[field]).includes(searchStr));
        }
    }
    
    if (condition.includes('.startsWith(')) {
        const match = condition.match(/@\.(\w+)\.startsWith\(['"](.+)['"]\)/);
        if (match) {
            const [_, field, searchStr] = match;
            return data.filter(item => String(item[field]).startsWith(searchStr));
        }
    }
    
    if (condition.includes('.endsWith(')) {
        const match = condition.match(/@\.(\w+)\.endsWith\(['"](.+)['"]\)/);
        if (match) {
            const [_, field, searchStr] = match;
            return data.filter(item => String(item[field]).endsWith(searchStr));
        }
    }
    
    if (condition.includes('.matches(')) {
        const match = condition.match(/@\.(\w+)\.matches\(['"](.+)['"]\)/);
        if (match) {
            const [_, field, pattern] = match;
            const regex = new RegExp(pattern);
            return data.filter(item => regex.test(String(item[field])));
        }
    }
    
    // Handle comparison operations
    const compMatch = condition.match(/@\.(\w+)\s*([><=!]+)\s*(.+)/);
    if (compMatch) {
        const [_, field, op, value] = compMatch;
        const compareValue = value.startsWith('"') || value.startsWith("'") 
            ? value.slice(1, -1) 
            : Number(value);
            
        return data.filter(item => {
            const itemValue = item[field];
            switch (op) {
                case '>': return itemValue > compareValue;
                case '>=': return itemValue >= compareValue;
                case '<': return itemValue < compareValue;
                case '<=': return itemValue <= compareValue;
                case '==': return itemValue == compareValue;
                case '!=': return itemValue != compareValue;
                default: return false;
            }
        });
    }
    
    return data;
}

const server = new Server(
    {
        name: "json",
        version: "1.0.0"
    },
    {
        capabilities: {
            tools: {
                listChanged: false
            }
        }
    }
);

// Schema definitions
const QueryArgumentsSchema = z.object({
    url: z.string().url(),
    jsonPath: z.string(),
});

const FilterArgumentsSchema = z.object({
    url: z.string().url(),
    jsonPath: z.string(),
    condition: z.string(),
});

// Tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "query",
                description: "Query JSON data using JSONPath syntax",
                inputSchema: {
                    type: "object",
                    properties: {
                        url: {
                            type: "string",
                            description: "URL of the JSON data source",
                        },
                        jsonPath: {
                            type: "string",
                            description: "JSONPath expression (e.g. $.store.book[*].author)",
                        }
                    },
                    required: ["url", "jsonPath"],
                },
            },
            {
                name: "filter",
                description: "Filter JSON data using conditions",
                inputSchema: {
                    type: "object",
                    properties: {
                        url: {
                            type: "string",
                            description: "URL of the JSON data source",
                        },
                        jsonPath: {
                            type: "string",
                            description: "Base JSONPath expression",
                        },
                        condition: {
                            type: "string",
                            description: "Filter condition (e.g. @.price < 10)",
                        }
                    },
                    required: ["url", "jsonPath", "condition"],
                },
            }
        ],
    };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
        if (name === "query") {
            const { url, jsonPath } = QueryArgumentsSchema.parse(args);
            const jsonData = await fetchData(url);
            
            // Handle complex filtering with string operations
            const filterMatch = jsonPath.match(/\[\?\((.+?)\)\]/);
            if (filterMatch) {
                const condition = filterMatch[1];
                let baseData = Array.isArray(jsonData) ? jsonData : [jsonData];
                
                // Get the base path before the filter
                const basePath = jsonPath.split('[?')[0];
                if (basePath !== '$') {
                    baseData = JSONPath.value(jsonData, basePath);
                }
                
                // Apply filter
                let result = handleComplexFilter(baseData, condition);
                
                // Handle operations after filter
                const afterFilter = jsonPath.split(')]')[1];
                if (afterFilter) {
                    if (afterFilter.includes('.{')) {
                        // Handle projection
                        const projectionMatch = afterFilter.match(/\.\{(.+?)\}/);
                        if (projectionMatch) {
                            const fieldPairs = projectionMatch[1].split(',')
                                .map(pair => {
                                    const [key, value] = pair.split(':').map(s => s.trim());
                                    return { key, value: value || key };
                                });
                            
                            result = result.map((item: Record<string, any>) => {
                                const obj: Record<string, any> = {};
                                fieldPairs.forEach(({ key, value }) => {
                                    obj[key] = item[value];
                                });
                                return obj;
                            });
                        }
                    }
                }
                
                return {
                    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                };
            }

            // Handle numeric operations
            if (jsonPath.match(/\.(math|round|floor|ceil|abs|sqrt|pow2)/)) {
                let baseData;
                const basePath = jsonPath.split('.math')[0].split('.round')[0]
                    .split('.floor')[0].split('.ceil')[0]
                    .split('.abs')[0].split('.sqrt')[0].split('.pow2')[0];
                
                if (basePath === '$') {
                    baseData = Array.isArray(jsonData) ? jsonData : [jsonData];
                } else {
                    baseData = JSONPath.value(jsonData, basePath);
                    if (!Array.isArray(baseData)) {
                        baseData = [baseData];
                    }
                }
                
                const numericOp = jsonPath.slice(basePath.length);
                const result = handleNumericOperations(baseData, numericOp);
                return {
                    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                };
            }
            
            // Handle date operations
            if (jsonPath.match(/\.(format|isToday|add)\(/)) {
                const baseData = Array.isArray(jsonData) ? jsonData : [jsonData];
                const dateOp = jsonPath.slice(jsonPath.indexOf('.'));
                const result = handleDateOperations(baseData, dateOp);
                return {
                    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                };
            }
            
            // Handle string operations
            if (jsonPath.match(/\.(toLowerCase|toUpperCase|startsWith|endsWith|contains|matches)\(/)) {
                const baseData = JSONPath.value(jsonData, jsonPath.split('.')[0]);
                const stringOp = jsonPath.slice(jsonPath.indexOf('.') + 1);
                const result = handleStringOperations(baseData, stringOp);
                return {
                    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                };
            }
            
            // Handle array transformations
            if (jsonPath.match(/\.(map|flatten|union|intersection)\(/)) {
                const baseData = Array.isArray(jsonData) ? jsonData : [jsonData];
                const transformOp = jsonPath.slice(jsonPath.indexOf('.'));
                const result = handleArrayTransformations(baseData, transformOp);
                return {
                    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                };
            }
            
            // Handle grouping operations
            if (jsonPath.includes('.groupBy(')) {
                const baseData = Array.isArray(jsonData) ? jsonData : [jsonData];
                const result = handleGrouping(baseData, jsonPath);
                return {
                    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                };
            }

            // Handle aggregation functions
            if (jsonPath.match(/\.(sum|avg|min|max)\(\w+\)/)) {
                const result = handleAggregation(
                    Array.isArray(jsonData) ? jsonData : [jsonData],
                    jsonPath
                );
                return {
                    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                };
            }

            // Handle array operations (sort, distinct)
            if (jsonPath.includes('.sort(') || jsonPath.includes('.distinct()')) {
                let result = Array.isArray(jsonData) ? jsonData : [jsonData];
                const operations = jsonPath.split(/(?=\.(?:sort|distinct))/);
                
                for (const op of operations) {
                    if (op.startsWith('.sort') || op.startsWith('.distinct')) {
                        result = handleArrayOperations(result, op);
                    }
                }
                
                return {
                    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                };
            }

            // Handle length() function
            if (jsonPath === "$.length()") {
                return {
                    content: [{ type: "text", text: JSON.stringify(getArrayLength(jsonData), null, 2) }],
                };
            }
            
            // Handle complex array operations (reverse, slice)
            if (jsonPath.includes("-1") || jsonPath.includes(":")) {
                let result = Array.isArray(jsonData) ? jsonData : [jsonData];
                
                // Split multiple operations
                const operations = jsonPath.match(/\[.*?\]/g) || [];
                
                for (const op of operations) {
                    result = handleArrayOperations(result, op);
                }
                
                // Handle field selection
                if (jsonPath.includes(".")) {
                    const fieldMatch = jsonPath.match(/\.([^.\[]+)$/);
                    if (fieldMatch) {
                        const field = fieldMatch[1];
                        result = result.map(item => item[field]);
                    }
                }
                
                return {
                    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                };
            }
            
            // Handle object projection
            if (jsonPath.includes(".{")) {
                const allData = Array.isArray(jsonData) ? jsonData : [jsonData];
                const projectionMatch = jsonPath.match(/\.\{(.+?)\}/);
                if (projectionMatch) {
                    const fieldPairs = projectionMatch[1].split(',')
                        .map(pair => {
                            const [key, value] = pair.split(':').map(s => s.trim());
                            return { key, value: value || key };
                        });
                    
                    const result = allData.map((item: Record<string, any>) => {
                        const obj: Record<string, any> = {};
                        fieldPairs.forEach(({ key, value }) => {
                            obj[key] = item[value];
                        });
                        return obj;
                    });
                    
                    return {
                        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                    };
                }
            }
            
            // Default JSONPath evaluation
            const result = JSONPath.value(jsonData, jsonPath);
            return {
                content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
            };
        }
        else if (name === "filter") {
            const { url, jsonPath, condition } = FilterArgumentsSchema.parse(args);
            const jsonData = await fetchData(url);
            
            // Get base data using jsonPath
            let baseData = JSONPath.value(jsonData, jsonPath);
            if (!Array.isArray(baseData)) {
                baseData = [baseData];
            }
            
            // Apply filter condition
            const result = baseData.filter((item: Record<string, any>) => {
                try {
                    // Handle common comparison operators
                    if (condition.includes(' > ')) {
                        const [field, value] = condition.split(' > ').map(s => s.trim());
                        const fieldName = field.replace('@.', '');
                        return Number(item[fieldName]) > Number(value);
                    }
                    if (condition.includes(' < ')) {
                        const [field, value] = condition.split(' < ').map(s => s.trim());
                        const fieldName = field.replace('@.', '');
                        return Number(item[fieldName]) < Number(value);
                    }
                    if (condition.includes(' >= ')) {
                        const [field, value] = condition.split(' >= ').map(s => s.trim());
                        const fieldName = field.replace('@.', '');
                        return Number(item[fieldName]) >= Number(value);
                    }
                    if (condition.includes(' <= ')) {
                        const [field, value] = condition.split(' <= ').map(s => s.trim());
                        const fieldName = field.replace('@.', '');
                        return Number(item[fieldName]) <= Number(value);
                    }
                    if (condition.includes(' == ')) {
                        const [field, value] = condition.split(' == ').map(s => s.trim());
                        const fieldName = field.replace('@.', '');
                        const compareValue = value.startsWith('"') || value.startsWith("'") 
                            ? value.slice(1, -1) 
                            : Number(value);
                        return item[fieldName] == compareValue;
                    }
                    if (condition.includes(' != ')) {
                        const [field, value] = condition.split(' != ').map(s => s.trim());
                        const fieldName = field.replace('@.', '');
                        const compareValue = value.startsWith('"') || value.startsWith("'") 
                            ? value.slice(1, -1) 
                            : Number(value);
                        return item[fieldName] != compareValue;
                    }
                    
                    return false;
                } catch {
                    return false;
                }
            });

            return {
                content: [{ 
                    type: "text", 
                    text: JSON.stringify(result, null, 2)
                }]
            };
        }
        else {
            throw new Error(`Unknown tool: ${name}`);
        }
    } catch (error) {
        if (error instanceof z.ZodError) {
            throw new Error(
                `Invalid arguments: ${error.errors
                    .map((e) => `${e.path.join(".")}: ${e.message}`)
                    .join(", ")}`
            );
        }
        throw error;
    }
});

// Start the server
async function main() {
    try {
        const transport = new StdioServerTransport();
        await server.connect(transport);
        console.error("JSON MCP Server running on stdio");
    } catch (error) {
        console.error("Error during startup:", error);
        process.exit(1);
    }
}

main().catch((error) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
}); 