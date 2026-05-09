import { z } from "zod";

// Define schema for parameter properties
const parameterPropertySchema = z
  .object({
    type: z.string(),
    description: z.string().optional(),
    items: z
      .object({
        type: z.string(),
      })
      .optional(),
    enum: z.array(z.string()).optional(),
    format: z.string().optional(),
  })
  .catchall(z.any());

// Define the parameter schema for tool inputs
const parameterSchema = z
  .object({
    type: z.string(),
    description: z.string().optional(),
    properties: z.record(parameterPropertySchema).optional(),
    required: z.array(z.string()).optional(),
    additionalProperties: z.boolean().optional(),
  })
  .catchall(z.any());

// Define the tool schema
const toolSchema = z.object({
  name: z.string(),
  description: z.string(),
  parameters: z
    .object({
      type: z.literal("object"),
      properties: z.record(parameterPropertySchema),
      required: z.array(z.string()).optional(),
    })
    .optional(),
  paramsSchema: parameterSchema.optional(),
});

// Validate if input matches either schema format
export function validateToolDefinition(tool: any): boolean {
  try {
    // Try validating against the toolSchema
    const result = toolSchema.safeParse(tool);
    if (result.success) {
      // If tool has parameters property, ensure it's properly formatted
      if (tool.parameters) {
        if (tool.parameters.type !== "object") {
          console.error(
            `Invalid tool parameters type for tool: ${tool?.name}. Expected 'object', got '${tool.parameters.type}'`,
          );
          return false;
        }
        if (
          !tool.parameters.properties ||
          typeof tool.parameters.properties !== "object"
        ) {
          console.error(
            `Invalid tool parameters properties for tool: ${tool?.name}`,
          );
          return false;
        }
      }
      return true;
    }

    // Log validation errors for debugging
    if (result.error) {
      console.error(`Tool validation failed for tool: ${tool?.name}`, {
        errors: result.error.errors,
        invalidData: tool,
      });
    }

    return false;
  } catch (error) {
    console.error(`Unexpected error validating tool: ${tool?.name}`, error);
    return false;
  }
}

export function validateAndFilterTools(
  tools: Record<string, any>,
): Record<string, any> {
  const validTools: Record<string, any> = {};

  for (const [name, tool] of Object.entries(tools)) {
    // Skip if tool is not an object
    if (!tool || typeof tool !== "object") {
      console.error(`Invalid tool definition: ${name} is not an object`);
      continue;
    }

    // Ensure tool has a name property that matches the key
    const toolWithName = {
      ...tool,
      name: name,
    };

    if (validateToolDefinition(toolWithName)) {
      validTools[name] = toolWithName;
    } else {
      console.error(`Tool validation failed for: ${name}`);
    }
  }

  return validTools;
}
