/**
 * KGEN Rules Validation Engine
 * Single validator entry point with JSON reporting and boolean status
 */

import { Parser, Store, Writer } from 'n3';

/**
 * Validates RDF graph against SHACL shapes
 * @param {Object} options - Validation options
 * @param {string} options.ttl - RDF graph in Turtle format
 * @param {string} options.shacl - SHACL shapes in Turtle format
 * @returns {Promise<Object>} Validation report with ok boolean and detailed errors
 */
export async function validateGraph({ ttl, shacl }) {
  const startTime = Date.now();
  
  try {
    // Parse RDF graph
    const dataStore = new Store();
    const parser = new Parser();
    
    const dataQuads = parser.parse(ttl);
    dataStore.addQuads(dataQuads);
    
    // Parse SHACL shapes
    const shaclStore = new Store();
    const shaclQuads = parser.parse(shacl);
    shaclStore.addQuads(shaclQuads);
    
    // Perform basic validation (simplified for now)
    const errors = await performBasicValidation(dataStore, shaclStore);
    const isValid = errors.length === 0;
    
    // Calculate metrics
    const duration = Date.now() - startTime;
    const tripleCount = dataStore.size;
    const shapesCount = shaclStore.size;
    
    return {
      ok: isValid,
      errors: errors,
      graph: {
        tripleCount: tripleCount,
        valid: isValid
      },
      validation: {
        duration: duration,
        shapesCount: shapesCount
      }
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    return {
      ok: false,
      errors: [{
        path: null,
        message: `Validation error: ${error.message}`,
        constraint: 'system-error',
        value: null
      }],
      graph: {
        tripleCount: 0,
        valid: false
      },
      validation: {
        duration: duration,
        shapesCount: 0
      }
    };
  }
}

/**
 * Performs basic validation of RDF graph against SHACL shapes
 * @param {Store} dataStore - RDF data store
 * @param {Store} shaclStore - SHACL shapes store
 * @returns {Promise<Array>} Array of validation errors
 */
async function performBasicValidation(dataStore, shaclStore) {
  const errors = [];
  
  // Basic SHACL validation implementation
  // This is a simplified version - in production you'd use a full SHACL engine
  
  // Find all node shapes
  const nodeShapes = shaclStore.getQuads(null, 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.w3.org/ns/shacl#NodeShape');
  
  for (const nodeShape of nodeShapes) {
    const shapeId = nodeShape.subject;
    
    // Get target nodes
    const targetNodes = getTargetNodes(dataStore, shaclStore, shapeId);
    
    // Get property shapes
    const propertyShapes = shaclStore.getQuads(shapeId, 'http://www.w3.org/ns/shacl#property', null);
    
    for (const targetNode of targetNodes) {
      for (const propertyShape of propertyShapes) {
        const propertyConstraint = propertyShape.object;
        const propertyErrors = validateProperty(dataStore, shaclStore, targetNode, propertyConstraint);
        errors.push(...propertyErrors);
      }
    }
  }
  
  return errors;
}

/**
 * Gets target nodes for a SHACL shape
 * @param {Store} dataStore - RDF data store
 * @param {Store} shaclStore - SHACL shapes store
 * @param {NamedNode} shapeId - Shape identifier
 * @returns {Array} Array of target nodes
 */
function getTargetNodes(dataStore, shaclStore, shapeId) {
  const targetNodes = [];
  
  // targetNode
  const targetNodeQuads = shaclStore.getQuads(shapeId, 'http://www.w3.org/ns/shacl#targetNode', null);
  for (const quad of targetNodeQuads) {
    targetNodes.push(quad.object);
  }
  
  // targetClass
  const targetClassQuads = shaclStore.getQuads(shapeId, 'http://www.w3.org/ns/shacl#targetClass', null);
  for (const quad of targetClassQuads) {
    const classInstances = dataStore.getQuads(null, 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', quad.object);
    for (const instance of classInstances) {
      targetNodes.push(instance.subject);
    }
  }
  
  return targetNodes;
}

/**
 * Validates a property constraint
 * @param {Store} dataStore - RDF data store
 * @param {Store} shaclStore - SHACL shapes store
 * @param {NamedNode} targetNode - Target node
 * @param {NamedNode} propertyConstraint - Property constraint
 * @returns {Array} Array of validation errors
 */
function validateProperty(dataStore, shaclStore, targetNode, propertyConstraint) {
  const errors = [];
  
  // Get property path
  const pathQuads = shaclStore.getQuads(propertyConstraint, 'http://www.w3.org/ns/shacl#path', null);
  if (pathQuads.length === 0) return errors;
  
  const propertyPath = pathQuads[0].object;
  
  // Get property values
  const propertyValues = dataStore.getQuads(targetNode, propertyPath, null);
  
  // Check minCount
  const minCountQuads = shaclStore.getQuads(propertyConstraint, 'http://www.w3.org/ns/shacl#minCount', null);
  if (minCountQuads.length > 0) {
    const minCount = parseInt(minCountQuads[0].object.value);
    if (propertyValues.length < minCount) {
      errors.push({
        path: propertyPath.value,
        message: `Property ${propertyPath.value} has ${propertyValues.length} values, minimum required is ${minCount}`,
        constraint: 'minCount',
        value: propertyValues.length.toString()
      });
    }
  }
  
  // Check maxCount
  const maxCountQuads = shaclStore.getQuads(propertyConstraint, 'http://www.w3.org/ns/shacl#maxCount', null);
  if (maxCountQuads.length > 0) {
    const maxCount = parseInt(maxCountQuads[0].object.value);
    if (propertyValues.length > maxCount) {
      errors.push({
        path: propertyPath.value,
        message: `Property ${propertyPath.value} has ${propertyValues.length} values, maximum allowed is ${maxCount}`,
        constraint: 'maxCount',
        value: propertyValues.length.toString()
      });
    }
  }
  
  // Check datatype
  const datatypeQuads = shaclStore.getQuads(propertyConstraint, 'http://www.w3.org/ns/shacl#datatype', null);
  if (datatypeQuads.length > 0) {
    const expectedDatatype = datatypeQuads[0].object.value;
    for (const propertyValue of propertyValues) {
      if (propertyValue.object.termType === 'Literal') {
        const actualDatatype = propertyValue.object.datatype?.value || 'http://www.w3.org/2001/XMLSchema#string';
        if (actualDatatype !== expectedDatatype) {
          errors.push({
            path: propertyPath.value,
            message: `Property ${propertyPath.value} value has datatype ${actualDatatype}, expected ${expectedDatatype}`,
            constraint: 'datatype',
            value: propertyValue.object.value
          });
        }
      }
    }
  }
  
  return errors;
}

/**
 * Validates multiple graphs against their respective SHACL shapes
 * @param {Array} validations - Array of {ttl, shacl} objects
 * @returns {Promise<Array>} Array of validation reports
 */
export async function validateMultipleGraphs(validations) {
  const results = [];
  
  for (const validation of validations) {
    const result = await validateGraph(validation);
    results.push(result);
  }
  
  return results;
}

/**
 * Validates graph with custom constraint checking
 * @param {Object} options - Validation options
 * @param {string} options.ttl - RDF graph in Turtle format
 * @param {string} options.shacl - SHACL shapes in Turtle format
 * @param {Array} options.customConstraints - Additional constraint checkers
 * @returns {Promise<Object>} Enhanced validation report
 */
export async function validateGraphWithCustomConstraints({ ttl, shacl, customConstraints = [] }) {
  const baseReport = await validateGraph({ ttl, shacl });
  
  // Apply custom constraints
  for (const constraint of customConstraints) {
    try {
      const customErrors = await constraint.validate(ttl);
      if (customErrors && customErrors.length > 0) {
        baseReport.errors.push(...customErrors);
        baseReport.ok = false;
        baseReport.graph.valid = false;
      }
    } catch (error) {
      baseReport.errors.push({
        path: null,
        message: `Custom constraint error: ${error.message}`,
        constraint: 'custom-constraint',
        value: null
      });
      baseReport.ok = false;
      baseReport.graph.valid = false;
    }
  }
  
  return baseReport;
}

/**
 * Creates a summary report from multiple validation results
 * @param {Array} reports - Array of validation reports
 * @returns {Object} Summary report
 */
export function createSummaryReport(reports) {
  const totalGraphs = reports.length;
  const validGraphs = reports.filter(r => r.ok).length;
  const totalErrors = reports.reduce((sum, r) => sum + r.errors.length, 0);
  const totalTriples = reports.reduce((sum, r) => sum + r.graph.tripleCount, 0);
  const totalDuration = reports.reduce((sum, r) => sum + r.validation.duration, 0);
  
  return {
    ok: validGraphs === totalGraphs,
    summary: {
      totalGraphs,
      validGraphs,
      invalidGraphs: totalGraphs - validGraphs,
      totalErrors,
      totalTriples,
      totalDuration,
      averageDuration: totalGraphs > 0 ? Math.round(totalDuration / totalGraphs) : 0
    },
    reports
  };
}