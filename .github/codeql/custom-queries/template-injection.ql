/**
 * @name Template injection vulnerability detection
 * @description Detects potential template injection vulnerabilities in Nunjucks/template systems
 * @kind problem
 * @problem.severity warning
 * @precision medium
 * @id javascript/template-injection
 * @tags security
 *       external/cwe/cwe-094
 *       external/cwe/cwe-079
 */

import javascript

/**
 * A template engine call that might be vulnerable to injection
 */
class TemplateEngineCall extends CallExpr {
  TemplateEngineCall() {
    exists(MemberAccessExpr mae |
      mae = this.getCallee() and
      (
        mae.getPropertyName() = "render" or
        mae.getPropertyName() = "renderString" or
        mae.getPropertyName() = "compile"
      ) and
      (
        mae.getBase().getType().hasQualifiedName("nunjucks", "Environment") or
        mae.getBase().getType().hasQualifiedName("nunjucks", "Template") or
        mae.getBase().toString().matches("%nunjucks%") or
        mae.getBase().toString().matches("%template%")
      )
    )
  }

  /**
   * Gets the template argument (usually the first argument)
   */
  Expr getTemplateArgument() {
    result = this.getArgument(0)
  }

  /**
   * Gets the context/data argument (usually the second argument)
   */
  Expr getContextArgument() {
    result = this.getArgument(1)
  }
}

/**
 * A source of user input that could be used in template injection
 */
class UserInputSource extends Expr {
  UserInputSource() {
    // HTTP request data
    exists(MemberAccessExpr mae |
      mae = this and
      (
        mae.getPropertyName() = "body" or
        mae.getPropertyName() = "query" or
        mae.getPropertyName() = "params" or
        mae.getPropertyName() = "headers"
      ) and
      mae.getBase().toString().matches("%req%")
    ) or
    // Express.js specific
    exists(CallExpr ce |
      ce = this and
      ce.getCallee().(MemberAccessExpr).getPropertyName() = "param" and
      ce.getCallee().(MemberAccessExpr).getBase().toString().matches("%req%")
    ) or
    // Form data
    exists(MemberAccessExpr mae |
      mae = this and
      mae.getPropertyName() = "value" and
      mae.getBase().toString().matches("%form%")
    ) or
    // URL parameters
    exists(MemberAccessExpr mae |
      mae = this and
      mae.getBase().toString().matches("%url%") and
      (
        mae.getPropertyName() = "searchParams" or
        mae.getPropertyName() = "search"
      )
    )
  }
}

/**
 * Checks if an expression flows from user input to a template
 */
predicate flowsFromUserInputToTemplate(UserInputSource source, TemplateEngineCall sink) {
  exists(DataFlow::Node sourceNode, DataFlow::Node sinkNode |
    sourceNode.asExpr() = source and
    (
      sinkNode.asExpr() = sink.getTemplateArgument() or
      sinkNode.asExpr() = sink.getContextArgument()
    ) and
    DataFlow::localFlow(sourceNode, sinkNode)
  )
}

/**
 * Checks if template content comes directly from user input (most dangerous)
 */
predicate userInputDirectlyInTemplate(UserInputSource source, TemplateEngineCall sink) {
  exists(DataFlow::Node sourceNode, DataFlow::Node sinkNode |
    sourceNode.asExpr() = source and
    sinkNode.asExpr() = sink.getTemplateArgument() and
    DataFlow::localFlow(sourceNode, sinkNode)
  )
}

/**
 * Checks for dangerous template patterns
 */
class DangerousTemplatePattern extends StringLiteral {
  DangerousTemplatePattern() {
    // Template expressions that access dangerous globals
    this.getValue().matches("%constructor%") or
    this.getValue().matches("%__proto__%") or
    this.getValue().matches("%process%") or
    this.getValue().matches("%global%") or
    this.getValue().matches("%require%") or
    this.getValue().matches("%eval%") or
    this.getValue().matches("%Function%") or
    // Template expressions with user input placeholders
    this.getValue().matches("%{{%user%}}%") or
    this.getValue().matches("%{{%input%}}%") or
    this.getValue().matches("%{{%req.%}}%") or
    this.getValue().matches("%{%%set%user%}%")
  }
}

/**
 * Checks for missing input validation before template rendering
 */
predicate lacksSanitization(TemplateEngineCall call, Expr input) {
  input = call.getContextArgument() and
  not exists(CallExpr sanitize |
    sanitize.getCallee().toString().matches("%sanitize%") or
    sanitize.getCallee().toString().matches("%escape%") or
    sanitize.getCallee().toString().matches("%validate%")
  )
}

from TemplateEngineCall call, UserInputSource userInput
where
  (
    // Direct template injection (user input in template)
    userInputDirectlyInTemplate(userInput, call) or
    // Context injection with dangerous patterns
    (flowsFromUserInputToTemplate(userInput, call) and
     exists(DangerousTemplatePattern pattern |
       pattern = call.getTemplateArgument()
     )) or
    // Unsanitized user input in context
    (flowsFromUserInputToTemplate(userInput, call) and
     lacksSanitization(call, userInput))
  )
select call,
  "Template injection vulnerability: User input $@ flows to template rendering at $@ without proper sanitization.",
  userInput, "user input",
  call, "template call"