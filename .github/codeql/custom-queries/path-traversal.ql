/**
 * @name Path traversal vulnerability detection
 * @description Detects potential path traversal vulnerabilities in file operations
 * @kind problem
 * @problem.severity error
 * @precision high
 * @id javascript/path-traversal
 * @tags security
 *       external/cwe/cwe-022
 *       external/cwe/cwe-023
 */

import javascript

/**
 * A file system operation that could be vulnerable to path traversal
 */
class FileSystemOperation extends CallExpr {
  FileSystemOperation() {
    exists(MemberAccessExpr mae |
      mae = this.getCallee() and
      mae.getBase().toString() = "fs" and
      (
        mae.getPropertyName() = "readFile" or
        mae.getPropertyName() = "readFileSync" or
        mae.getPropertyName() = "writeFile" or
        mae.getPropertyName() = "writeFileSync" or
        mae.getPropertyName() = "access" or
        mae.getPropertyName() = "accessSync" or
        mae.getPropertyName() = "stat" or
        mae.getPropertyName() = "statSync" or
        mae.getPropertyName() = "open" or
        mae.getPropertyName() = "openSync" or
        mae.getPropertyName() = "unlink" or
        mae.getPropertyName() = "unlinkSync" or
        mae.getPropertyName() = "rmdir" or
        mae.getPropertyName() = "rmdirSync" or
        mae.getPropertyName() = "mkdir" or
        mae.getPropertyName() = "mkdirSync"
      )
    ) or
    exists(CallExpr ce |
      ce = this and
      ce.getCallee().toString().matches("%require%") and
      ce.getArgument(0).toString().matches("%fs%")
    )
  }

  /**
   * Gets the path argument (usually the first argument)
   */
  Expr getPathArgument() {
    result = this.getArgument(0)
  }
}

/**
 * A path manipulation operation
 */
class PathManipulation extends CallExpr {
  PathManipulation() {
    exists(MemberAccessExpr mae |
      mae = this.getCallee() and
      mae.getBase().toString() = "path" and
      (
        mae.getPropertyName() = "join" or
        mae.getPropertyName() = "resolve" or
        mae.getPropertyName() = "normalize"
      )
    )
  }
}

/**
 * A source of user input that could contain path traversal
 */
class UserPathInput extends Expr {
  UserPathInput() {
    // HTTP request parameters
    exists(MemberAccessExpr mae |
      mae = this and
      (
        mae.getPropertyName() = "body" or
        mae.getPropertyName() = "query" or
        mae.getPropertyName() = "params"
      ) and
      mae.getBase().toString().matches("%req%")
    ) or
    // Express.js parameters
    exists(CallExpr ce |
      ce = this and
      ce.getCallee().(MemberAccessExpr).getPropertyName() = "param" and
      ce.getCallee().(MemberAccessExpr).getBase().toString().matches("%req%")
    ) or
    // Command line arguments
    exists(MemberAccessExpr mae |
      mae = this and
      mae.getBase().toString() = "process.argv"
    ) or
    // Environment variables (could be set by attacker)
    exists(MemberAccessExpr mae |
      mae = this and
      mae.getBase().toString() = "process.env"
    )
  }
}

/**
 * A dangerous path pattern that indicates traversal
 */
class DangerousPathPattern extends StringLiteral {
  DangerousPathPattern() {
    this.getValue().matches("%../%") or
    this.getValue().matches("%..\\%") or
    this.getValue().matches("%../../%") or
    this.getValue().matches("%..\\..\\%") or
    this.getValue().matches("%../../../%") or
    this.getValue().matches("%..\\..\\..\\%") or
    // Encoded variations
    this.getValue().matches("%%2e%2e/%") or
    this.getValue().matches("%%2e%2e\\%") or
    // Null byte injection
    this.getValue().matches("%%00%") or
    // Absolute paths that could be dangerous
    this.getValue().matches("%/etc/%") or
    this.getValue().matches("%/root/%") or
    this.getValue().matches("%C:\\Windows\\%") or
    this.getValue().matches("%C:\\Users\\%")
  }
}

/**
 * Checks if user input flows to a file system operation
 */
predicate flowsFromUserInputToFileOp(UserPathInput source, FileSystemOperation sink) {
  exists(DataFlow::Node sourceNode, DataFlow::Node sinkNode |
    sourceNode.asExpr() = source and
    sinkNode.asExpr() = sink.getPathArgument() and
    DataFlow::localFlow(sourceNode, sinkNode)
  )
}

/**
 * Checks for path validation functions
 */
predicate hasPathValidation(Expr pathExpr) {
  exists(CallExpr validation |
    // Common validation functions
    validation.getCallee().toString().matches("%validate%") or
    validation.getCallee().toString().matches("%sanitize%") or
    validation.getCallee().toString().matches("%normalize%") or
    // Specific path validation patterns
    validation.getCallee().(MemberAccessExpr).getPropertyName() = "resolve" or
    validation.getCallee().(MemberAccessExpr).getPropertyName() = "normalize" or
    // Custom validation functions
    validation.getCallee().toString().matches("%checkPath%") or
    validation.getCallee().toString().matches("%validatePath%") or
    validation.getCallee().toString().matches("%isValidPath%")
  ) and
  DataFlow::localFlow(DataFlow::valueNode(pathExpr), DataFlow::valueNode(validation.getAnArgument()))
}

/**
 * Checks for allowlist-based path validation
 */
predicate hasAllowlistValidation(Expr pathExpr) {
  exists(CallExpr check |
    // Methods that check against allowed paths
    check.getCallee().(MemberAccessExpr).getPropertyName() = "startsWith" or
    check.getCallee().(MemberAccessExpr).getPropertyName() = "includes" or
    // Array.includes or similar
    check.getCallee().(MemberAccessExpr).getPropertyName() = "includes" and
    check.getCallee().(MemberAccessExpr).getBase().toString().matches("%allowedPaths%")
  ) and
  DataFlow::localFlow(DataFlow::valueNode(pathExpr), DataFlow::valueNode(check.getReceiver()))
}

/**
 * Checks for dangerous string concatenation that could enable traversal
 */
predicate hasDangerousConcatenation(Expr pathExpr) {
  exists(BinaryExpr concat |
    concat = pathExpr and
    concat.getOperator() = "+" and
    (
      concat.getLeftOperand() instanceof UserPathInput or
      concat.getRightOperand() instanceof UserPathInput
    )
  )
}

from FileSystemOperation fileOp, UserPathInput userInput
where
  flowsFromUserInputToFileOp(userInput, fileOp) and
  (
    // Direct path traversal patterns
    exists(DangerousPathPattern pattern |
      pattern = fileOp.getPathArgument()
    ) or
    // Unvalidated user input
    not hasPathValidation(fileOp.getPathArgument()) or
    // No allowlist checking
    not hasAllowlistValidation(fileOp.getPathArgument()) or
    // Dangerous string concatenation
    hasDangerousConcatenation(fileOp.getPathArgument())
  )
select fileOp,
  "Path traversal vulnerability: User input $@ flows to file operation $@ without proper validation.",
  userInput, "user input",
  fileOp, "file operation"