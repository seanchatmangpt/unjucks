/**
 * Artifact Validator using SHACL shapes
 * Validates KGEN artifacts against defined constraints
 */

import { SHACLEngine } from '../../kgen-core/src/shacl/validator.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * Validate artifacts in a directory or file
 * @param {Object} options - Validation options
 * @param {string} options.path - Path to validate
 * @param {boolean} options.recursive - Recursively validate directories
 * @param {string} options.shapesFile - Path to SHACL shapes file
 * @param {string} options.format - Output format
 * @returns {Promise<Object>} Validation results
 */
export async function validateArtifacts(options) {
  const {
    path: targetPath,
    recursive = false,
    shapesFile,
    format = 'summary'
  } = options;

  const validator = new SHACLEngine();
  const results = {
    conforms: true,
    violations: [],
    validatedFiles: [],
    timestamp: new Date().toISOString(),
    summary: ''
  };

  try {
    // Determine shapes file
    const shapes = shapesFile || await findDefaultShapesFile();
    
    // Get files to validate
    const files = await getFilesToValidate(targetPath, recursive);
    
    // Validate each file
    for (const file of files) {
      if (await isRDFFile(file)) {
        try {
          const fileResult = await validator.validateFile(file, shapes);
          
          results.validatedFiles.push({
            file,
            conforms: fileResult.conforms,
            violations: fileResult.violations.length
          });
          
          if (!fileResult.conforms) {\n            results.conforms = false;\n            results.violations.push(...fileResult.violations.map(v => ({\n              ...v,\n              file\n            })));\n          }\n        } catch (error) {\n          results.conforms = false;\n          results.violations.push({\n            focusNode: file,\n            path: 'file-access',\n            value: error.message,\n            message: `Failed to validate ${file}: ${error.message}`,\n            severity: 'violation',\n            constraint: 'file-validation',\n            shape: 'file-access'\n          });\n        }\n      }\n    }\n\n    // Generate summary\n    results.summary = generateValidationSummary(results);\n    \n    return results;\n  } catch (error) {\n    throw new Error(`Artifact validation failed: ${error.message}`);\n  }\n}\n\n/**\n * Find default SHACL shapes file\n * @returns {Promise<string>} Path to shapes file\n */\nasync function findDefaultShapesFile() {\n  const possiblePaths = [\n    'ontologies/shacl/artifact-shapes.ttl',\n    '../../../ontologies/shacl/artifact-shapes.ttl',\n    './artifact-shapes.ttl',\n    path.join(process.cwd(), 'ontologies/shacl/artifact-shapes.ttl')\n  ];\n\n  for (const shapesPath of possiblePaths) {\n    try {\n      await fs.access(shapesPath);\n      return shapesPath;\n    } catch {\n      continue;\n    }\n  }\n\n  throw new Error('No SHACL shapes file found. Use --shapes to specify path.');\n}\n\n/**\n * Get list of files to validate\n * @param {string} targetPath - Target path\n * @param {boolean} recursive - Recursive flag\n * @returns {Promise<string[]>} List of file paths\n */\nasync function getFilesToValidate(targetPath, recursive) {\n  const stats = await fs.stat(targetPath);\n  \n  if (stats.isFile()) {\n    return [targetPath];\n  }\n  \n  if (stats.isDirectory()) {\n    const files = [];\n    await collectFiles(targetPath, files, recursive);\n    return files;\n  }\n  \n  throw new Error(`Invalid path: ${targetPath}`);\n}\n\n/**\n * Recursively collect files from directory\n * @param {string} dir - Directory path\n * @param {string[]} files - Files array to populate\n * @param {boolean} recursive - Recursive flag\n */\nasync function collectFiles(dir, files, recursive) {\n  const entries = await fs.readdir(dir, { withFileTypes: true });\n  \n  for (const entry of entries) {\n    const fullPath = path.join(dir, entry.name);\n    \n    if (entry.isFile()) {\n      files.push(fullPath);\n    } else if (entry.isDirectory() && recursive) {\n      await collectFiles(fullPath, files, recursive);\n    }\n  }\n}\n\n/**\n * Check if file is likely an RDF file\n * @param {string} filePath - File path to check\n * @returns {Promise<boolean>} True if RDF file\n */\nasync function isRDFFile(filePath) {\n  const ext = path.extname(filePath).toLowerCase();\n  const rdfExtensions = ['.ttl', '.rdf', '.xml', '.jsonld', '.n3', '.nt'];\n  \n  if (rdfExtensions.includes(ext)) {\n    return true;\n  }\n  \n  // Check content for RDF-like patterns\n  try {\n    const content = await fs.readFile(filePath, 'utf-8');\n    const rdfPatterns = [\n      /@prefix/,\n      /@base/,\n      /rdf:type/,\n      /rdfs:/,\n      /owl:/,\n      /\"@context\"/\n    ];\n    \n    return rdfPatterns.some(pattern => pattern.test(content));\n  } catch {\n    return false;\n  }\n}\n\n/**\n * Generate validation summary text\n * @param {Object} results - Validation results\n * @returns {string} Summary text\n */\nfunction generateValidationSummary(results) {\n  const violationsBySeverity = {\n    violation: 0,\n    warning: 0,\n    info: 0\n  };\n  \n  results.violations.forEach(v => {\n    violationsBySeverity[v.severity] = (violationsBySeverity[v.severity] || 0) + 1;\n  });\n  \n  const summary = [\n    `🔍 KGEN Artifact Validation Results`,\n    `Timestamp: ${results.timestamp}`,\n    ``,\n    `📁 Files Processed: ${results.validatedFiles.length}`,\n    `✅ Files Valid: ${results.validatedFiles.filter(f => f.conforms).length}`,\n    `❌ Files Invalid: ${results.validatedFiles.filter(f => !f.conforms).length}`,\n    ``,\n    `📊 Constraint Violations:`,\n    `- Violations: ${violationsBySeverity.violation || 0}`,\n    `- Warnings: ${violationsBySeverity.warning || 0}`,\n    `- Info: ${violationsBySeverity.info || 0}`,\n    ``,\n    `${results.conforms ? '✅ Overall Status: PASS' : '❌ Overall Status: FAIL'}`\n  ];\n  \n  return summary.join('\\n');\n}\n\nexport default { validateArtifacts };"